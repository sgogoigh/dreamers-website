"""T5 — vendored pipeline: blueprint stamping, duration snapping (TODO §5)."""
from __future__ import annotations

import conftest  # noqa: F401  (pins env before app imports)

from app.pipeline.constants import snap_duration
from app.pipeline.schema import default_blueprint
from app.services import gemini_service
from app.services.generation_service import build_blueprint


def test_snap_duration_edges():
    assert snap_duration(5) == 6   # tie goes UP (V5 in LIMITATIONS.md)
    assert snap_duration(3) == 4
    assert snap_duration(4) == 4
    assert snap_duration(6) == 6
    assert snap_duration(8) == 8
    assert snap_duration(9) == 8
    assert snap_duration(0) == 4


def test_mock_script_is_blueprint_stamped():
    bp = default_blueprint()
    script = gemini_service.generate_script(concept="a test concept", blueprint=bp)
    assert len(script.beats) == 8
    assert [b.target_seconds for b in script.beats] == [8, 8, 8, 6, 8, 8, 8, 4]
    assert script.beats[0].continues_previous is False
    assert script.beats[0].transition_in == "fade_in"
    assert script.beats[1].continues_previous is True
    assert script.beats[7].is_title_card is True
    assert script.beats[7].on_screen_text == script.title
    assert script.title and script.logline
    assert len(script.cast) >= 2


def test_mock_prompts_carry_structure():
    script = gemini_service.generate_script(concept="x", blueprint=default_blueprint())
    prompts = gemini_service.build_prompts(script=script)
    assert len(prompts.segments) == 8
    assert prompts.segments[0].continues_previous is False
    assert prompts.segments[1].continues_previous is True
    assert [s.duration_seconds for s in prompts.segments] == [8, 8, 8, 6, 8, 8, 8, 4]
    title_card = prompts.segments[-1]
    assert title_card.is_title_card is True
    assert title_card.title_text == script.title
    assert all(s.prompt for s in prompts.segments)


def test_trimmed_test_blueprint_keeps_title_card():
    """DREAMERS_TRAILER_SLOTS=3 (test env) → 3 slots, title card preserved."""
    bp = build_blueprint()
    assert len(bp.slots) == 3
    assert [s.beat_no for s in bp.slots] == [1, 2, 3]
    assert bp.slots[0].continues_previous is False
    assert bp.slots[-1].is_title_card is True
    assert sum(s.target_seconds for s in bp.slots) == 20
