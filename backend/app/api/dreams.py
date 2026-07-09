"""Dreams — the heart of the product (PLAN §10).

`POST /dreams` is the single point of no return (business rule B5): the
frontend's confirm modal is the only gate before it, and once it returns 201
there is no cancel endpoint. It atomically: validates the prompt → checks the
per-user concurrency guard → places the 5-credit hold → creates dream + job →
spawns the worker.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import storage
from ..config import settings
from ..db import SessionLocal, get_db
from ..errors import AppError
from ..jobs import job_manager
from ..models.base import new_id
from ..models.dream import (
    DREAM_ACTIVE,
    DREAM_FAILED,
    DREAM_QUEUED,
    DREAM_TERMINAL,
    JOB_PENDING,
    Dream,
    GenerationJob,
)
from ..models.user import User
from ..rate_limit import rate_limit
from ..schemas.common import MessageOut
from ..schemas.dream import (
    DreamCreateRequest,
    DreamListItem,
    DreamOut,
    DreamPageOut,
    JobOut,
)
from ..security import get_current_user
from ..services import credit_service
from ..services.credit_service import InsufficientCreditsError

router = APIRouter(prefix="/dreams", tags=["dreams"])


# --- helpers -----------------------------------------------------------------
def _make_title(prompt: str) -> str:
    words = prompt.split()
    title = " ".join(words[:8])
    if len(words) > 8:
        title += "…"
    return title[:120]


def _video_url(dream: Dream) -> Optional[str]:
    if dream.video_path and Path(dream.video_path).exists():
        return f"/api/v1/dreams/{dream.id}/video"
    return None


def _thumb_url(dream: Dream) -> Optional[str]:
    if dream.thumbnail_path and Path(dream.thumbnail_path).exists():
        return f"/api/v1/dreams/{dream.id}/thumbnail"
    return None


def _dream_out(dream: Dream, job: Optional[GenerationJob]) -> DreamOut:
    return DreamOut(
        id=dream.id,
        title=dream.title,
        prompt=dream.prompt,
        status=dream.status,
        error=dream.error,
        credits_charged=dream.credits_charged,
        duration_secs=dream.duration_secs,
        created_at=dream.created_at,
        updated_at=dream.updated_at,
        completed_at=dream.completed_at,
        job=JobOut.model_validate(job) if job is not None else None,
        video_url=_video_url(dream),
        thumbnail_url=_thumb_url(dream),
    )


def _get_job(db: Session, dream_id: str) -> Optional[GenerationJob]:
    return db.execute(
        select(GenerationJob).where(GenerationJob.dream_id == dream_id)
    ).scalar_one_or_none()


async def get_owned_dream(
    dream_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dream:
    """Ownership scope: foreign/unknown ids are a uniform 404 (no enumeration)."""
    dream = db.get(Dream, dream_id)
    if dream is None or dream.user_id != user.id:
        raise AppError(404, "NOT_FOUND", "Dream not found.")
    return dream


def _guard_user_concurrency(db: Session, user_id: str) -> None:
    """One active generation per user (PLAN §9). DB is the authority; the
    in-process job map is a belt-and-braces second check."""
    active = db.execute(
        select(func.count(Dream.id)).where(
            Dream.user_id == user_id, Dream.status.in_(DREAM_ACTIVE)
        )
    ).scalar_one()
    if active or job_manager.user_has_running(user_id):
        raise AppError(
            409, "GENERATION_IN_PROGRESS",
            "Your current dream is still rendering — one at a time.",
        )


def _hold_or_402(db: Session, user_id: str, dream_id: str) -> None:
    try:
        credit_service.hold(db, user_id=user_id, dream_id=dream_id)
    except InsufficientCreditsError as e:
        db.rollback()
        raise AppError(
            402, "INSUFFICIENT_CREDITS",
            f"You need {e.required} credits to dream — you have {e.balance}. "
            f"Top up from ${settings.MIN_PURCHASE_USD}.",
            details={"balance": e.balance, "required": e.required},
        )


# --- create (the point of no return) -------------------------------------------
@router.post(
    "",
    response_model=DreamOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("dreams", *settings.DREAMS_RATE_LIMIT))],
)
async def create_dream(
    body: DreamCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DreamOut:
    _guard_user_concurrency(db, user.id)

    dream = Dream(
        id=new_id(),  # explicit: the id is needed for the hold before flush
        user_id=user.id,
        title=_make_title(body.prompt),
        prompt=body.prompt,
        status=DREAM_QUEUED,
    )
    _hold_or_402(db, user.id, dream.id)
    job = GenerationJob(dream_id=dream.id)
    db.add(dream)
    db.add(job)
    db.commit()

    await job_manager.start(dream.id, user.id)
    return _dream_out(dream, job)


# --- read ---------------------------------------------------------------------
@router.get("", response_model=DreamPageOut)
def list_dreams(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    cursor: int = Query(default=0, ge=0),
) -> DreamPageOut:
    rows = db.execute(
        select(Dream)
        .where(Dream.user_id == user.id)
        .order_by(Dream.created_at.desc(), Dream.id.desc())
        .offset(cursor)
        .limit(limit)
    ).scalars().all()
    return DreamPageOut(
        items=[
            DreamListItem(
                id=d.id, title=d.title, status=d.status,
                created_at=d.created_at, thumbnail_url=_thumb_url(d),
            )
            for d in rows
        ],
        next_cursor=cursor + limit if len(rows) == limit else None,
    )


@router.get("/{dream_id}", response_model=DreamOut)
def get_dream(
    dream: Dream = Depends(get_owned_dream), db: Session = Depends(get_db)
) -> DreamOut:
    return _dream_out(dream, _get_job(db, dream.id))


# --- delete (terminal dreams only — no cancel semantics, B5) --------------------
@router.delete("/{dream_id}", response_model=MessageOut)
def delete_dream(
    dream: Dream = Depends(get_owned_dream), db: Session = Depends(get_db)
) -> MessageOut:
    if dream.status not in DREAM_TERMINAL or job_manager.is_running(dream.id):
        raise AppError(
            409, "DREAM_RUNNING",
            "This dream is still rendering and cannot be deleted (generation "
            "cannot be terminated once started).",
        )
    job = _get_job(db, dream.id)
    if job is not None:
        db.delete(job)
        db.flush()  # delete the job before the dream so the FK cascade can't race it
    db.delete(dream)
    db.commit()
    storage.delete_artifacts(dream.id)
    return MessageOut(detail="Dream deleted.")


# --- retry (failed dreams; segments on disk are reused, so retries are cheap) ---
@router.post("/{dream_id}/retry", response_model=DreamOut)
async def retry_dream(
    dream: Dream = Depends(get_owned_dream),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DreamOut:
    if dream.status != DREAM_FAILED:
        raise AppError(409, "INVALID_STATE", "Only failed dreams can be retried.")
    _guard_user_concurrency(db, user.id)
    _hold_or_402(db, user.id, dream.id)

    dream.status = DREAM_QUEUED
    dream.error = None
    job = _get_job(db, dream.id)
    if job is None:
        job = GenerationJob(dream_id=dream.id)
        db.add(job)
    job.status = JOB_PENDING
    job.progress = 0.0
    job.message = ""
    job.segments = []
    job.error = None
    job.started_at = None
    job.finished_at = None
    db.commit()

    await job_manager.start(dream.id, user.id)
    return _dream_out(dream, job)


# --- live progress (SSE) ---------------------------------------------------------
def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.get("/{dream_id}/events")
async def dream_events(dream: Dream = Depends(get_owned_dream)):
    """Server-Sent Events: current snapshot first, then live events, closing on
    terminal state. EventSource can't set headers — pass `?token=`."""
    dream_id = dream.id
    queue = job_manager.subscribe(dream_id)

    async def event_gen():
        # Fresh session: the request-scoped one closes when the handler returns.
        db = SessionLocal()
        try:
            d = db.get(Dream, dream_id)
            job = _get_job(db, dream_id)
            snapshot = {
                "type": "snapshot",
                "status": d.status,
                "progress": job.progress if job else 0.0,
                "message": job.message if job else "",
                "segments": job.segments if job else [],
                "error": d.error,
                "video_url": _video_url(d),
            }
            terminal = d.status in DREAM_TERMINAL
        finally:
            db.close()

        yield _sse(snapshot)
        if terminal:
            yield _sse({"type": "close"})
            job_manager.unsubscribe(dream_id, queue)
            return
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"  # comment frame keeps the connection open
                    continue
                yield _sse(event)
                if event.get("type") == "close":
                    break
        finally:
            job_manager.unsubscribe(dream_id, queue)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# --- artifacts --------------------------------------------------------------------
@router.get("/{dream_id}/video")
def get_video(
    dream: Dream = Depends(get_owned_dream),
    download: int = Query(default=0),
) -> FileResponse:
    if not dream.video_path or not Path(dream.video_path).exists():
        raise AppError(404, "VIDEO_NOT_READY", "The video has not been generated yet.")
    if download:
        return FileResponse(
            dream.video_path,
            media_type="video/mp4",
            filename=f"dreamers_{dream.id[:12]}.mp4",
        )
    return FileResponse(dream.video_path, media_type="video/mp4")


@router.get("/{dream_id}/thumbnail")
def get_thumbnail(dream: Dream = Depends(get_owned_dream)) -> FileResponse:
    if not dream.thumbnail_path or not Path(dream.thumbnail_path).exists():
        raise AppError(404, "NOT_FOUND", "No thumbnail for this dream yet.")
    return FileResponse(dream.thumbnail_path, media_type="image/png")
