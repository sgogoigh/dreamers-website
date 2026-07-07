"""One-shot generation orchestration (PLAN §9): prompt → script → Veo prompts →
chained clips → stitched mp4, with credit capture on success and automatic
refund on ANY failure.

`run()` executes in a worker thread (spawned by app.jobs.JobManager via
`asyncio.to_thread`) and owns its DB session. Every stage transition and every
segment event is persisted immediately, so plain polling of GET /dreams/{id}
always reflects reality even if the SSE stream drops.

Stage → status → progress bands:
    scripting   0.05        Gemini structured script
    prompting   0.15        Gemini chained Veo prompts
    rendering   0.18–0.92   one Veo clip per beat (per-segment events)
    stitching   0.95        ffmpeg concat + fades + title card
    completed   1.00        capture 5-credit hold
    failed      —           release hold (refund), error stored
"""
from __future__ import annotations

import shutil
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import storage
from ..config import settings
from ..db import SessionLocal
from ..models.base import utcnow
from ..models.dream import (
    DREAM_COMPLETED,
    DREAM_FAILED,
    DREAM_PROMPTING,
    DREAM_RENDERING,
    DREAM_SCRIPTING,
    DREAM_STITCHING,
    DREAM_TERMINAL,
    JOB_COMPLETED,
    JOB_FAILED,
    JOB_PENDING,
    JOB_RUNNING,
    Dream,
    GenerationJob,
)
from ..pipeline.schema import TrailerBlueprint, default_blueprint
from . import credit_service, gemini_service, veo_service

Emit = Callable[[dict], None]

RENDER_START, RENDER_END = 0.18, 0.92


def video_url(dream_id: str) -> str:
    return f"/api/v1/dreams/{dream_id}/video"


def build_blueprint() -> TrailerBlueprint:
    """The canonical 8-shot blueprint, optionally trimmed (keeping the title
    card) via DREAMERS_TRAILER_SLOTS for fast dev/test renders."""
    bp = default_blueprint()
    n = settings.TRAILER_SLOTS
    if n and 2 <= n < len(bp.slots):
        slots = bp.slots[: n - 1] + [bp.slots[-1]]
        for i, slot in enumerate(slots, start=1):
            slot.beat_no = i
        slots[0].continues_previous = False
        return TrailerBlueprint(slots=slots)
    return bp


def _get_job(db: Session, dream_id: str) -> GenerationJob:
    return db.execute(
        select(GenerationJob).where(GenerationJob.dream_id == dream_id)
    ).scalar_one()


def _set_stage(
    db: Session, dream: Dream, job: GenerationJob, emit: Emit,
    *, status: str, progress: float, message: str,
) -> None:
    dream.status = status
    job.progress = progress
    job.message = message
    db.commit()
    emit({"type": "stage", "stage": status, "progress": progress, "message": message})


def run(dream_id: str, emit: Emit) -> None:
    """Full pipeline for one dream. Never raises — terminal state (and the
    credit consequence) is always persisted."""
    db = SessionLocal()
    try:
        try:
            dream = db.get(Dream, dream_id)
            job = _get_job(db, dream_id)
            job.status = JOB_RUNNING
            job.started_at = utcnow()

            # --- step 2: script ------------------------------------------------
            _set_stage(db, dream, job, emit,
                       status=DREAM_SCRIPTING, progress=0.05, message="writing the film")
            script = gemini_service.generate_script(
                concept=dream.prompt, blueprint=build_blueprint()
            )
            dream.script_json = script.model_dump()

            # --- step 3: prompts -----------------------------------------------
            _set_stage(db, dream, job, emit,
                       status=DREAM_PROMPTING, progress=0.15, message="directing the shots")
            prompts = gemini_service.build_prompts(script=script)
            dream.prompts_json = prompts.model_dump()

            # --- step 4: render ------------------------------------------------
            job.segments = [
                {
                    "beat_no": s.beat_no,
                    "status": "pending",
                    "duration_seconds": s.duration_seconds,
                    "is_title_card": s.is_title_card,
                    "detail": "",
                }
                for s in prompts.segments
            ]
            _set_stage(db, dream, job, emit,
                       status=DREAM_RENDERING, progress=RENDER_START, message="rendering segments")

            total = max(len(prompts.segments), 1)

            def progress_cb(event: dict) -> None:
                # Same worker thread as run() → safe to reuse this session.
                etype = event.get("type")
                if etype == "segment":
                    segs = [dict(s) for s in job.segments]
                    for s in segs:
                        if s["beat_no"] == event["beat_no"]:
                            s["status"] = (
                                "completed" if event["status"] == "completed" else "running"
                            )
                            s["detail"] = event.get("detail", "")
                    job.segments = segs
                    done = sum(1 for s in segs if s["status"] == "completed")
                    job.progress = round(
                        RENDER_START + (RENDER_END - RENDER_START) * done / total, 3
                    )
                    job.message = f"beat {event['beat_no']}: {event.get('detail', '')}"
                    db.commit()
                    emit({
                        "type": "segment",
                        "beat_no": event["beat_no"],
                        "status": event["status"],
                        "detail": event.get("detail", ""),
                        "progress": job.progress,
                        "message": job.message,
                    })
                elif etype == "stitch":
                    dream.status = DREAM_STITCHING
                    job.progress = 0.95
                    job.message = "stitching the trailer"
                    db.commit()
                    emit({"type": "stage", "stage": DREAM_STITCHING,
                          "progress": 0.95, "message": job.message})

            out_dir = storage.artifacts_dir(dream_id)
            final_path = veo_service.run_generation(
                prompts=prompts, out_dir=out_dir, progress_cb=progress_cb
            )

            # --- completion ----------------------------------------------------
            thumb_src = out_dir / "_lastframe_01.png"
            if thumb_src.exists():
                shutil.copyfile(thumb_src, out_dir / "thumbnail.png")
                dream.thumbnail_path = str(out_dir / "thumbnail.png")
            dream.video_path = str(final_path)
            dream.duration_secs = sum(s.duration_seconds for s in prompts.segments)
            dream.status = DREAM_COMPLETED
            dream.completed_at = utcnow()
            job.status = JOB_COMPLETED
            job.progress = 1.0
            job.message = "completed"
            job.finished_at = utcnow()

            hold = credit_service.active_hold_for_dream(db, dream_id)
            if hold is not None and credit_service.capture(db, hold):
                dream.credits_charged = hold.amount
            db.commit()
            emit({"type": "status", "status": "completed", "progress": 1.0,
                  "video_url": video_url(dream_id)})

        except Exception as exc:  # noqa: BLE001 — any stage failure refunds
            db.rollback()
            err = f"{type(exc).__name__}: {exc}"
            dream = db.get(Dream, dream_id)
            job = _get_job(db, dream_id)
            dream.status = DREAM_FAILED
            dream.error = err
            job.status = JOB_FAILED
            job.error = err
            job.message = "failed"
            job.finished_at = utcnow()
            hold = credit_service.active_hold_for_dream(db, dream_id)
            if hold is not None:
                credit_service.release(db, hold)  # B6: never pay for a failed video
            db.commit()
            emit({"type": "status", "status": "failed", "error": err})
    finally:
        db.close()


def recover_interrupted(db: Session) -> int:
    """Startup recovery (E2): any job still pending/running belongs to a dead
    process — fail it and release its hold so no credits are stranded.
    Returns the number of jobs recovered. Caller commits."""
    recovered = 0
    stale = db.execute(
        select(GenerationJob).where(GenerationJob.status.in_((JOB_PENDING, JOB_RUNNING)))
    ).scalars().all()
    for job in stale:
        job.status = JOB_FAILED
        job.error = "interrupted by server restart"
        job.message = "failed"
        job.finished_at = utcnow()
        dream = db.get(Dream, job.dream_id)
        if dream is not None and dream.status not in DREAM_TERMINAL:
            dream.status = DREAM_FAILED
            dream.error = "interrupted by server restart"
        hold = credit_service.active_hold_for_dream(db, job.dream_id)
        if hold is not None:
            credit_service.release(db, hold)
        recovered += 1
    return recovered
