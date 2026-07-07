from __future__ import annotations

from pydantic import BaseModel


class MessageOut(BaseModel):
    detail: str


class HealthOut(BaseModel):
    status: str
    mock: bool


class VideoSpecOut(BaseModel):
    n_segments: int
    approx_duration_secs: int
    resolution: str
    aspect_ratio: str


class ConfigOut(BaseModel):
    """Pricing + capabilities. The frontend reads this so pricing copy never
    needs a frontend deploy to change."""
    mock: bool
    payments_mock: bool
    signup_bonus_credits: int
    credit_cost_per_video: int
    usd_per_credit: int
    min_purchase_usd: int
    prompt_min_len: int
    prompt_max_len: int
    video: VideoSpecOut
