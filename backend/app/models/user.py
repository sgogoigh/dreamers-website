from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, new_id, utcnow


class User(Base):
    """Account row. `credit_balance` is a denormalized cache of the ledger —
    every balance mutation happens in credit_service inside the same
    transaction as its ledger/hold row, keeping the two in sync."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("credit_balance >= 0", name="ck_users_balance_nonneg"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    google_sub: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    avatar_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    credit_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
