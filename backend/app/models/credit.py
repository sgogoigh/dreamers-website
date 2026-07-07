from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, new_id, utcnow

# Ledger reasons (append-only audit trail).
REASON_SIGNUP_BONUS = "signup_bonus"
REASON_GENERATION = "generation"
REASON_GENERATION_REFUND = "generation_refund"
REASON_PURCHASE = "purchase"

# Hold lifecycle.
HOLD_HELD = "held"
HOLD_CAPTURED = "captured"
HOLD_RELEASED = "released"


class CreditLedgerEntry(Base):
    """Append-only credit audit trail. Invariant (tested):
    sum(delta) == users.credit_balance + sum(active holds.amount)."""

    __tablename__ = "credit_ledger"
    __table_args__ = (
        Index("ix_ledger_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    reference_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class CreditHold(Base):
    """A 5-credit reservation while a generation runs (PLAN §7).

    The partial unique index allows retries (a dream accumulates released
    holds) while guaranteeing at most ONE active hold per dream.
    """

    __tablename__ = "credit_holds"
    __table_args__ = (
        Index(
            "uq_credit_holds_active_dream",
            "dream_id",
            unique=True,
            sqlite_where=text("status = 'held'"),
            postgresql_where=text("status = 'held'"),
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    dream_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=HOLD_HELD)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
