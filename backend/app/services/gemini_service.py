"""Gemini-backed services: trailer script (step 2) + Veo prompts (step 3).

Vendored from dreamers-ai/backend/app/services/gemini_service.py with two
changes: content models import from the pipeline schema directly (this app's
`models` package is the ORM), and the interactive script-revision capability is
dropped — the consumer product is one-shot (PLAN §9).

In MOCK mode every function returns deterministic, schema-valid fixtures — no
network, no key, no cost.
"""
from __future__ import annotations

from ..config import settings
from ..pipeline.schema import (
    CastMember,
    SegmentPrompt,
    TrailerBeat,
    TrailerBlueprint,
    TrailerPrompts,
    TrailerScript,
    default_blueprint,
)

# Vendored pipeline functions (steps 2 & 3).
from ..pipeline.constants import snap_duration
from ..pipeline.prompt_builder import build_segment_prompts
from ..pipeline.script_writer import _stamp_structure, refine_to_trailer_script


# ---------------------------------------------------------------------------
# MOCK fixtures
# ---------------------------------------------------------------------------
def _mock_script(concept: str, genre: str, tone: str, blueprint: TrailerBlueprint) -> TrailerScript:
    """A schema-valid script shaped exactly by the blueprint (structure stamped)."""
    beats = []
    for slot in blueprint.slots:
        i = slot.beat_no
        beats.append(
            TrailerBeat(
                beat_no=i,
                section=slot.section,
                setting=f"Mock setting {i} for '{concept[:40]}'",
                visual=f"Mock visual beat {i} ({slot.pace}): {slot.intent}",
                voiceover="In a world..." if i == 1 else "",
                dialogue="We have to move. Now." if slot.section == "escalation" else "",
                mood=tone or "tense",
            )
        )
    script = TrailerScript(
        title=f"MOCK: {concept[:30].strip().upper() or 'UNTITLED'}",
        logline=f"A mock logline derived from: {concept}",
        genre=genre or "Drama",
        tone=tone or "tense",
        cast=[
            CastMember(name="Alex", description="early-30s, lean, dark cropped hair, grey field jacket"),
            CastMember(name="Mara", description="late-20s, tall, auburn braid, navy overcoat"),
        ],
        beats=beats,
    )
    return _stamp_structure(script, blueprint)  # same deterministic stamping as the real path


def _mock_prompts(script: TrailerScript) -> TrailerPrompts:
    segs = []
    for b in script.beats:
        segs.append(
            SegmentPrompt(
                beat_no=b.beat_no,
                prompt=(
                    f"[MOCK PROMPT beat {b.beat_no}, {b.pace}] Cinematic shot. {b.visual} "
                    f"Setting: {b.setting}. Mood: {b.mood}. Audio: trailer score swell."
                ),
                negative_prompt="no watermark, no subtitles, no distorted faces",
                continues_previous=b.continues_previous,
                pace=b.pace,
                duration_seconds=snap_duration(b.target_seconds),
                transition_in=b.transition_in,
                transition_out=b.transition_out,
                is_title_card=b.is_title_card,
                title_text=(script.title if b.is_title_card else ""),
            )
        )
    if segs:
        segs[0].continues_previous = False
    return TrailerPrompts(segments=segs)


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------
def generate_script(
    *, concept: str, draft: str = "", genre: str = "", tone: str = "",
    blueprint: TrailerBlueprint | None = None,
) -> TrailerScript:
    """Step 2 — structured trailer script from the user's concept, shaped by the
    trailer blueprint."""
    bp = blueprint or default_blueprint()
    if settings.MOCK:
        return _mock_script(concept, genre, tone, bp)
    return refine_to_trailer_script(
        concept=concept, draft=draft, genre=genre, tone=tone, blueprint=bp
    )


def build_prompts(*, script: TrailerScript, seg_seconds: int | None = None) -> TrailerPrompts:
    """Step 3 — expand the script into chained Veo 3.1 segment prompts."""
    if settings.MOCK:
        return _mock_prompts(script)
    return build_segment_prompts(script, seg_seconds=seg_seconds)
