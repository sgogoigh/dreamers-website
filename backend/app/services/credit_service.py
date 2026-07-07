"""Credit system — the ONLY module allowed to mutate balances/ledger/holds.

Design (PLAN §7):
  * `users.credit_balance` is a denormalized cache; the ledger is the audit
    trail. Invariant: sum(ledger.delta) == balance + sum(active holds).
  * All balance mutations are atomic compare-and-swap UPDATEs
    (`UPDATE ... WHERE balance >= amount` / `WHERE status = 'held'`), which are
    race-proof on both SQLite and Postgres without relying on row locks, and
    make capture/release idempotent by construction.
  * Functions flush but do NOT commit — transaction control stays with the
    caller (router / job worker), so a hold + dream insert commit together.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Iterable, Optional

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..models.base import utcnow
from ..models.credit import (
    HOLD_CAPTURED,
    HOLD_HELD,
    HOLD_RELEASED,
    REASON_GENERATION,
    REASON_GENERATION_REFUND,
    CreditHold,
    CreditLedgerEntry,
)
from ..models.user import User


class InsufficientCreditsError(Exception):
    def __init__(self, balance: int, required: int) -> None:
        super().__init__(f"balance {balance} < required {required}")
        self.balance = balance
        self.required = required


def _balance(db: Session, user_id: str) -> int:
    return db.execute(select(User.credit_balance).where(User.id == user_id)).scalar_one()


def _add_ledger(
    db: Session,
    *,
    user_id: str,
    delta: int,
    reason: str,
    balance_after: int,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> CreditLedgerEntry:
    entry = CreditLedgerEntry(
        user_id=user_id,
        delta=delta,
        reason=reason,
        reference_type=reference_type,
        reference_id=reference_id,
        balance_after=balance_after,
        idempotency_key=idempotency_key,
    )
    db.add(entry)
    return entry


# ---------------------------------------------------------------------------
# grant — signup bonus / purchases (positive deltas)
# ---------------------------------------------------------------------------
def grant(
    db: Session,
    *,
    user_id: str,
    delta: int,
    reason: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Optional[CreditLedgerEntry]:
    """Credit a user. With an idempotency_key, replays are exact no-ops
    (balance untouched, existing ledger row returned)."""
    if delta <= 0:
        raise ValueError("grant() is for positive deltas only")

    if idempotency_key:
        existing = db.execute(
            select(CreditLedgerEntry).where(CreditLedgerEntry.idempotency_key == idempotency_key)
        ).scalar_one_or_none()
        if existing is not None:
            return existing

    try:
        # SAVEPOINT so an idempotency-key race rolls back the balance bump too.
        with db.begin_nested():
            db.execute(
                update(User)
                .where(User.id == user_id)
                .values(credit_balance=User.credit_balance + delta)
            )
            balance = _balance(db, user_id)
            _add_ledger(
                db,
                user_id=user_id,
                delta=delta,
                reason=reason,
                balance_after=balance,
                reference_type=reference_type,
                reference_id=reference_id,
                idempotency_key=idempotency_key,
            )
            db.flush()
    except IntegrityError:
        return db.execute(
            select(CreditLedgerEntry).where(CreditLedgerEntry.idempotency_key == idempotency_key)
        ).scalar_one_or_none()

    return db.execute(
        select(CreditLedgerEntry)
        .where(CreditLedgerEntry.user_id == user_id)
        .order_by(CreditLedgerEntry.id.desc())
    ).scalars().first()


# ---------------------------------------------------------------------------
# hold / capture / release — the generation reservation lifecycle
# ---------------------------------------------------------------------------
def hold(db: Session, *, user_id: str, dream_id: str, amount: Optional[int] = None) -> CreditHold:
    """Reserve credits atomically. The conditional UPDATE is the entire race
    story: it only decrements when the balance suffices, so concurrent holds
    can never drive the balance negative."""
    amount = amount if amount is not None else settings.CREDITS_PER_VIDEO
    res = db.execute(
        update(User)
        .where(User.id == user_id, User.credit_balance >= amount)
        .values(credit_balance=User.credit_balance - amount)
    )
    if res.rowcount != 1:
        raise InsufficientCreditsError(balance=_balance(db, user_id), required=amount)

    h = CreditHold(user_id=user_id, dream_id=dream_id, amount=amount, status=HOLD_HELD)
    db.add(h)
    db.flush()
    return h


def capture(db: Session, hold_obj: CreditHold) -> bool:
    """Finalize the charge after a successful generation. Balance was already
    decremented at hold time — this is bookkeeping. Returns False if the hold
    was already resolved (idempotent)."""
    res = db.execute(
        update(CreditHold)
        .where(CreditHold.id == hold_obj.id, CreditHold.status == HOLD_HELD)
        .values(status=HOLD_CAPTURED, resolved_at=utcnow())
    )
    if res.rowcount != 1:
        return False
    balance = _balance(db, hold_obj.user_id)
    _add_ledger(
        db,
        user_id=hold_obj.user_id,
        delta=-hold_obj.amount,
        reason=REASON_GENERATION,
        balance_after=balance,
        reference_type="dream",
        reference_id=hold_obj.dream_id,
        idempotency_key=f"capture:{hold_obj.id}",
    )
    db.flush()
    return True


def release(db: Session, hold_obj: CreditHold) -> bool:
    """Refund a hold after a failed generation. Writes an explicit −N/+N ledger
    pair so the audit trail shows both the attempt and the refund (PLAN §7).
    Returns False if the hold was already resolved (idempotent)."""
    res = db.execute(
        update(CreditHold)
        .where(CreditHold.id == hold_obj.id, CreditHold.status == HOLD_HELD)
        .values(status=HOLD_RELEASED, resolved_at=utcnow())
    )
    if res.rowcount != 1:
        return False
    db.execute(
        update(User)
        .where(User.id == hold_obj.user_id)
        .values(credit_balance=User.credit_balance + hold_obj.amount)
    )
    balance = _balance(db, hold_obj.user_id)
    _add_ledger(
        db,
        user_id=hold_obj.user_id,
        delta=-hold_obj.amount,
        reason=REASON_GENERATION,
        balance_after=balance - hold_obj.amount,
        reference_type="dream",
        reference_id=hold_obj.dream_id,
        idempotency_key=f"charge:{hold_obj.id}",
    )
    _add_ledger(
        db,
        user_id=hold_obj.user_id,
        delta=hold_obj.amount,
        reason=REASON_GENERATION_REFUND,
        balance_after=balance,
        reference_type="dream",
        reference_id=hold_obj.dream_id,
        idempotency_key=f"refund:{hold_obj.id}",
    )
    db.flush()
    return True


def active_hold_for_dream(db: Session, dream_id: str) -> Optional[CreditHold]:
    return db.execute(
        select(CreditHold).where(CreditHold.dream_id == dream_id, CreditHold.status == HOLD_HELD)
    ).scalar_one_or_none()


# ---------------------------------------------------------------------------
# balances / info
# ---------------------------------------------------------------------------
def balance_info(db: Session, user_id: str) -> dict:
    balance = _balance(db, user_id)
    held = sum(
        h.amount
        for h in db.execute(
            select(CreditHold).where(CreditHold.user_id == user_id, CreditHold.status == HOLD_HELD)
        ).scalars()
    )
    return {
        "balance": balance,
        "held": held,
        "videos_remaining": balance // settings.CREDITS_PER_VIDEO,
        "credits_per_video": settings.CREDITS_PER_VIDEO,
    }


# ---------------------------------------------------------------------------
# orphan sweep — users never lose credits to a crash (PLAN §7, E2)
# ---------------------------------------------------------------------------
def sweep_orphaned_holds(db: Session, *, active_dream_ids: Iterable[str] = ()) -> int:
    """Release any active hold whose dream is terminal, or that is older than
    the orphan max age — skipping dreams currently being generated in-process.
    Returns the number of holds released."""
    from ..models.dream import DREAM_TERMINAL, Dream  # local import: avoid cycle

    active = set(active_dream_ids)
    cutoff = utcnow() - timedelta(seconds=settings.HOLD_ORPHAN_MAX_AGE_SECONDS)
    released = 0
    holds = db.execute(select(CreditHold).where(CreditHold.status == HOLD_HELD)).scalars().all()
    for h in holds:
        if h.dream_id in active:
            continue
        dream = db.get(Dream, h.dream_id)
        terminal = dream is None or dream.status in DREAM_TERMINAL
        created = h.created_at.replace(tzinfo=None)
        stale = created < cutoff.replace(tzinfo=None)
        if terminal or stale:
            if release(db, h):
                released += 1
    return released
