"""T3 — credit service invariants, races, sweep (TODO §3)."""
from __future__ import annotations

import threading

import pytest
from sqlalchemy import func, select

from conftest import auth_headers, make_user

from app.db import SessionLocal
from app.models.base import new_id
from app.models.credit import CreditHold, CreditLedgerEntry
from app.models.dream import Dream
from app.models.user import User
from app.services import credit_service
from app.services.credit_service import InsufficientCreditsError


def _ledger_sum(db, user_id: str) -> int:
    return db.execute(
        select(func.coalesce(func.sum(CreditLedgerEntry.delta), 0)).where(
            CreditLedgerEntry.user_id == user_id
        )
    ).scalar_one()


def _held(db, user_id: str) -> int:
    return db.execute(
        select(func.coalesce(func.sum(CreditHold.amount), 0)).where(
            CreditHold.user_id == user_id, CreditHold.status == "held"
        )
    ).scalar_one()


def _balance(db, user_id: str) -> int:
    db.expire_all()
    return db.execute(select(User.credit_balance).where(User.id == user_id)).scalar_one()


def _assert_invariant(db, user_id: str):
    """sum(ledger) == balance + active holds — the PLAN §7 accounting identity."""
    assert _ledger_sum(db, user_id) == _balance(db, user_id) + _held(db, user_id)


# --- grant --------------------------------------------------------------------
def test_grant_is_idempotent_on_key(client, db):
    user = make_user(db)
    for _ in range(3):
        credit_service.grant(
            db, user_id=user.id, delta=25, reason="purchase", idempotency_key="purchase:evt_1"
        )
        db.commit()
    assert _balance(db, user.id) == 25
    rows = db.execute(
        select(func.count(CreditLedgerEntry.id)).where(CreditLedgerEntry.user_id == user.id)
    ).scalar_one()
    assert rows == 1
    _assert_invariant(db, user.id)


def test_grant_rejects_nonpositive(client, db):
    user = make_user(db)
    with pytest.raises(ValueError):
        credit_service.grant(db, user_id=user.id, delta=0, reason="purchase")
    with pytest.raises(ValueError):
        credit_service.grant(db, user_id=user.id, delta=-5, reason="purchase")


# --- hold / capture / release ---------------------------------------------------
def test_hold_insufficient_raises_and_balance_unchanged(client, db):
    user = make_user(db, credits=4)
    with pytest.raises(InsufficientCreditsError):
        credit_service.hold(db, user_id=user.id, dream_id=new_id())
    db.rollback()
    assert _balance(db, user.id) == 4
    _assert_invariant(db, user.id)


def test_hold_decrements_then_capture_charges(client, db):
    user = make_user(db, credits=10)
    hold = credit_service.hold(db, user_id=user.id, dream_id=new_id())
    db.commit()
    assert _balance(db, user.id) == 5  # decremented at hold time (B2)
    _assert_invariant(db, user.id)

    assert credit_service.capture(db, hold) is True
    db.commit()
    assert _balance(db, user.id) == 5  # capture is bookkeeping only
    charge = db.execute(
        select(CreditLedgerEntry).where(
            CreditLedgerEntry.user_id == user.id, CreditLedgerEntry.reason == "generation"
        )
    ).scalars().all()
    assert len(charge) == 1 and charge[0].delta == -5
    _assert_invariant(db, user.id)


def test_release_refunds_with_ledger_pair(client, db):
    user = make_user(db, credits=10)
    hold = credit_service.hold(db, user_id=user.id, dream_id=new_id())
    db.commit()
    assert credit_service.release(db, hold) is True
    db.commit()
    assert _balance(db, user.id) == 10  # B6: full refund on failure
    reasons = [
        (e.reason, e.delta)
        for e in db.execute(
            select(CreditLedgerEntry)
            .where(CreditLedgerEntry.user_id == user.id)
            .order_by(CreditLedgerEntry.id)
        ).scalars()
    ]
    assert ("generation", -5) in reasons and ("generation_refund", 5) in reasons
    _assert_invariant(db, user.id)


def test_double_capture_release_are_noops(client, db):
    user = make_user(db, credits=10)
    hold = credit_service.hold(db, user_id=user.id, dream_id=new_id())
    db.commit()

    assert credit_service.capture(db, hold) is True
    db.commit()
    assert credit_service.capture(db, hold) is False   # double capture
    assert credit_service.release(db, hold) is False   # release after capture
    db.commit()
    assert _balance(db, user.id) == 5
    _assert_invariant(db, user.id)

    hold2 = credit_service.hold(db, user_id=user.id, dream_id=new_id())
    db.commit()
    assert credit_service.release(db, hold2) is True
    assert credit_service.release(db, hold2) is False  # double release
    assert credit_service.capture(db, hold2) is False  # capture after release
    db.commit()
    assert _balance(db, user.id) == 5
    _assert_invariant(db, user.id)


def test_invariant_after_mixed_sequence(client, db):
    user = make_user(db, credits=10)
    credit_service.grant(db, user_id=user.id, delta=15, reason="purchase",
                         idempotency_key="purchase:evt_seq")
    db.commit()
    h1 = credit_service.hold(db, user_id=user.id, dream_id=new_id())
    h2 = credit_service.hold(db, user_id=user.id, dream_id=new_id())
    db.commit()
    _assert_invariant(db, user.id)
    credit_service.capture(db, h1)
    credit_service.release(db, h2)
    db.commit()
    assert _balance(db, user.id) == 20  # 25 - 5 captured
    _assert_invariant(db, user.id)


# --- concurrency -----------------------------------------------------------------
def test_concurrent_holds_never_go_negative(client, db):
    """T3.g: 6 threads race a 10-credit user → exactly 2 holds succeed."""
    user = make_user(db, credits=10)
    results: list[bool] = []
    lock = threading.Lock()

    def worker():
        session = SessionLocal()
        try:
            credit_service.hold(session, user_id=user.id, dream_id=new_id())
            session.commit()
            ok = True
        except InsufficientCreditsError:
            session.rollback()
            ok = False
        finally:
            session.close()
        with lock:
            results.append(ok)

    threads = [threading.Thread(target=worker) for _ in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sum(results) == 2  # exactly two 5-credit holds fit in 10
    assert _balance(db, user.id) == 0
    assert _balance(db, user.id) >= 0  # CHECK constraint would refuse anyway
    _assert_invariant(db, user.id)


# --- API endpoints -----------------------------------------------------------------
def test_balance_endpoint(client):
    r = client.get("/api/v1/credits/balance", headers=auth_headers())
    assert r.status_code == 200
    assert r.json() == {
        "balance": 10, "held": 0, "videos_remaining": 2, "credits_per_video": 5,
    }


def test_ledger_pagination(client, db):
    client.get("/api/v1/users/me", headers=auth_headers())  # signup (+10)
    user_id = db.execute(select(User.id)).scalar_one()
    for i in range(4):
        credit_service.grant(db, user_id=user_id, delta=5, reason="purchase",
                             idempotency_key=f"purchase:evt_pg_{i}")
    db.commit()

    page1 = client.get("/api/v1/credits/ledger?limit=3", headers=auth_headers()).json()
    assert len(page1["items"]) == 3 and page1["next_cursor"] == 3
    page2 = client.get("/api/v1/credits/ledger?limit=3&cursor=3", headers=auth_headers()).json()
    assert len(page2["items"]) == 2 and page2["next_cursor"] is None
    # newest first, no overlap
    ids = [e["id"] for e in page1["items"] + page2["items"]]
    assert ids == sorted(ids, reverse=True) and len(set(ids)) == 5


# --- sweep -------------------------------------------------------------------------
def test_sweep_releases_orphaned_holds(client, db):
    user = make_user(db, credits=10)
    dream = Dream(id=new_id(), user_id=user.id, title="t", prompt="p", status="failed")
    db.add(dream)
    db.commit()
    credit_service.hold(db, user_id=user.id, dream_id=dream.id)
    db.commit()
    assert _balance(db, user.id) == 5

    released = credit_service.sweep_orphaned_holds(db)
    db.commit()
    assert released == 1
    assert _balance(db, user.id) == 10
    _assert_invariant(db, user.id)


def test_sweep_skips_in_flight_dreams(client, db):
    user = make_user(db, credits=10)
    dream = Dream(id=new_id(), user_id=user.id, title="t", prompt="p", status="rendering")
    db.add(dream)
    db.commit()
    credit_service.hold(db, user_id=user.id, dream_id=dream.id)
    db.commit()

    released = credit_service.sweep_orphaned_holds(db, active_dream_ids={dream.id})
    db.commit()
    assert released == 0
    assert _balance(db, user.id) == 5
