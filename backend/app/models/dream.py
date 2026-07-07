from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, new_id, utcnow

# Dream lifecycle (PLAN §9 stage table).
DREAM_QUEUED = "queued"
DREAM_SCRIPTING = "scripting"
DREAM_PROMPTING = "prompting"
DREAM_RENDERING = "rendering"
DREAM_STITCHING = "stitching"
DREAM_COMPLETED = "completed"
DREAM_FAILED = "failed"

DREAM_TERMINAL = (DREAM_COMPLETED, DREAM_FAILED)
DREAM_ACTIVE = (DREAM_QUEUED, DREAM_SCRIPTING, DREAM_PROMPTING, DREAM_RENDERING, DREAM_STITCHING)

JOB_PENDING = "pending"
JOB_RUNNING = "running"
JOB_COMPLETED = "completed"
JOB_FAILED = "failed"


class Dream(Base):
    """One prompt → one video. A 'chat' in the studio sidebar is one dream."""

    __tablename__ = "dreams"
    __table_args__ = (
        Index("ix_dreams_user_created", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default=DREAM_QUEUED)
    script_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    prompts_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    video_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thumbnail_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_secs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    credits_charged: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class GenerationJob(Base):
    """Progress detail for a dream's (single) generation job.

    `segments` mirrors the pipeline beats:
    [{beat_no, status, duration_seconds, is_title_card, detail}, ...]
    """

    __tablename__ = "generation_jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    dream_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("dreams.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=JOB_PENDING)
    progress: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    segments: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
