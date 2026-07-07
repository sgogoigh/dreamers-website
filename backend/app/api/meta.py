"""Liveness + capability discovery (drives frontend pricing copy)."""
from __future__ import annotations

from fastapi import APIRouter

from ..config import settings
from ..pipeline.constants import ASPECT_RATIO, RESOLUTION
from ..schemas.common import ConfigOut, HealthOut, VideoSpecOut
from ..services.generation_service import build_blueprint

router = APIRouter(tags=["meta"])


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    return HealthOut(status="ok", mock=settings.MOCK)


@router.get("/config", response_model=ConfigOut)
def config() -> ConfigOut:
    bp = build_blueprint()
    return ConfigOut(
        mock=settings.MOCK,
        payments_mock=settings.payments_mock,
        signup_bonus_credits=settings.SIGNUP_BONUS_CREDITS,
        credit_cost_per_video=settings.CREDITS_PER_VIDEO,
        usd_per_credit=settings.USD_PER_CREDIT,
        min_purchase_usd=settings.MIN_PURCHASE_USD,
        prompt_min_len=settings.PROMPT_MIN_LEN,
        prompt_max_len=settings.PROMPT_MAX_LEN,
        video=VideoSpecOut(
            n_segments=len(bp.slots),
            approx_duration_secs=sum(s.target_seconds for s in bp.slots),
            resolution=RESOLUTION,
            aspect_ratio=ASPECT_RATIO,
        ),
    )
