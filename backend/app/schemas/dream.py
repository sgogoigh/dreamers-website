from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..config import settings


class DreamCreateRequest(BaseModel):
    prompt: str = Field(
        min_length=settings.PROMPT_MIN_LEN,
        max_length=settings.PROMPT_MAX_LEN,
        description="Natural-language description of the video to generate",
    )

    @field_validator("prompt")
    @classmethod
    def _strip_and_check(cls, v: str) -> str:
        v = v.strip()
        if len(v) < settings.PROMPT_MIN_LEN:
            raise ValueError(
                f"prompt must be at least {settings.PROMPT_MIN_LEN} characters after trimming"
            )
        return v


class SegmentOut(BaseModel):
    beat_no: int
    status: str = "pending"
    duration_seconds: int = 8
    is_title_card: bool = False
    detail: str = ""


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str
    progress: float
    message: str
    segments: List[Any]
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class DreamOut(BaseModel):
    id: str
    title: str
    prompt: str
    status: str
    error: Optional[str] = None
    credits_charged: int
    duration_secs: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    job: Optional[JobOut] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class DreamListItem(BaseModel):
    id: str
    title: str
    status: str
    created_at: datetime
    thumbnail_url: Optional[str] = None


class DreamPageOut(BaseModel):
    items: List[DreamListItem]
    next_cursor: Optional[int] = None
