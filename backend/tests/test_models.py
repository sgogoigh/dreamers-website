"""T1 — schema round-trips + DB-level constraint enforcement (TODO §1)."""
from __future__ import annotations

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from conftest import make_user

from app.models.base import new_id
from app.models.credit import CreditHold, CreditLedgerEntry
from app.models.dream import Dream, GenerationJob
from app.models.payment import Payment


def test_all_models_round_trip(client, db):
    user = make_user(db, credits=10)

    dream = Dream(id=new_id(), user_id=user.id, title="t", prompt="p")
    job = GenerationJob(id=new_id(), dream_id=dream.id, segments=[{"beat_no": 1}])
    payment = Payment(id=new_id(), user_id=user.id, stripe_session_id="cs_x",
                      amount_usd=25, credits=25)
    hold = CreditHold(id=new_id(), user_id=user.id, dream_id=dream.id, amount=5)
    db.add_all([dream, job, payment, hold])
    db.commit()

    assert db.get(Dream, dream.id).status == "queued"
    assert db.get(GenerationJob, job.id).segments == [{"beat_no": 1}]
    assert db.get(Payment, payment.id).status == "pending"
    assert db.get(CreditHold, hold.id).status == "held"
    ledger = db.execute(select(CreditLedgerEntry)).scalars().all()
    assert len(ledger) == 1 and ledger[0].balance_after == 10


def test_balance_check_rejects_negative(client, db):
    """T1.b — the DB CHECK is the last line of defense against race bugs."""
    user = make_user(db)
    with pytest.raises(IntegrityError):
        db.execute(
            text("UPDATE users SET credit_balance = -1 WHERE id = :uid"),
            {"uid": user.id},
        )
        db.commit()
    db.rollback()


def test_ledger_idempotency_key_unique(client, db):
    """T1.c — exactly-once crediting is enforced by the schema itself."""
    user = make_user(db)
    db.add(CreditLedgerEntry(user_id=user.id, delta=5, reason="purchase",
                             balance_after=5, idempotency_key="purchase:dup"))
    db.commit()
    db.add(CreditLedgerEntry(user_id=user.id, delta=5, reason="purchase",
                             balance_after=10, idempotency_key="purchase:dup"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_one_active_hold_per_dream(client, db):
    """T1.d — the partial unique index allows retries (released holds) but at
    most ONE active hold per dream."""
    user = make_user(db)
    dream_id = new_id()
    db.add(CreditHold(id=new_id(), user_id=user.id, dream_id=dream_id,
                      amount=5, status="released"))
    db.add(CreditHold(id=new_id(), user_id=user.id, dream_id=dream_id, amount=5))
    db.commit()  # released + held coexist (retry scenario)

    db.add(CreditHold(id=new_id(), user_id=user.id, dream_id=dream_id, amount=5))
    with pytest.raises(IntegrityError):
        db.commit()  # second ACTIVE hold refused
    db.rollback()
