"""T6 (non-render paths) — validation, guards, ownership, delete, recovery,
rate limiting (TODO §6)."""
from __future__ import annotations

from sqlalchemy import select, update

from conftest import auth_headers

from app.config import settings
from app.models.base import new_id
from app.models.credit import CreditHold
from app.models.dream import Dream, GenerationJob
from app.models.user import User
from app.services import credit_service
from app.services.generation_service import recover_interrupted


def _me(client, **kw) -> dict:
    return client.get("/api/v1/users/me", headers=auth_headers(**kw)).json()


def _set_balance(db, user_id: str, balance: int) -> None:
    db.execute(update(User).where(User.id == user_id).values(credit_balance=balance))
    db.commit()


def _insert_dream(db, user_id: str, status: str = "queued", **kw) -> Dream:
    dream = Dream(id=new_id(), user_id=user_id, title="t", prompt="a test prompt",
                  status=status, **kw)
    db.add(dream)
    db.commit()
    return dream


# --- prompt validation (T6.b) ----------------------------------------------------
def test_prompt_empty_rejected(client):
    r = client.post("/api/v1/dreams", json={"prompt": ""}, headers=auth_headers())
    assert r.status_code == 422


def test_prompt_too_short_rejected(client):
    r = client.post("/api/v1/dreams", json={"prompt": "ab"}, headers=auth_headers())
    assert r.status_code == 422


def test_prompt_whitespace_only_rejected(client):
    r = client.post("/api/v1/dreams", json={"prompt": "  a  "}, headers=auth_headers())
    assert r.status_code == 422


def test_prompt_too_long_rejected(client, db):
    r = client.post("/api/v1/dreams", json={"prompt": "x" * 2001}, headers=auth_headers())
    assert r.status_code == 422
    # no dream row, no hold — validation happens before any money moves
    assert db.execute(select(Dream)).scalars().all() == []
    assert db.execute(select(CreditHold)).scalars().all() == []


# --- insufficient credits (T6.c, B3) ------------------------------------------------
def test_insufficient_credits_402_no_dream_row(client, db):
    me = _me(client)
    _set_balance(db, me["id"], 4)  # 1-4 leftover credits cannot generate

    r = client.post("/api/v1/dreams", json={"prompt": "a beautiful dream"},
                    headers=auth_headers())
    assert r.status_code == 402
    err = r.json()["error"]
    assert err["code"] == "INSUFFICIENT_CREDITS"
    assert err["details"] == {"balance": 4, "required": 5}
    assert db.execute(select(Dream)).scalars().all() == []
    assert db.execute(select(CreditHold)).scalars().all() == []


# --- per-user concurrency (T6.d) ------------------------------------------------------
def test_second_dream_while_active_409(client, db):
    me = _me(client)
    _insert_dream(db, me["id"], status="rendering")

    r = client.post("/api/v1/dreams", json={"prompt": "another dream"},
                    headers=auth_headers())
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "GENERATION_IN_PROGRESS"
    # only the pre-existing dream; no new hold placed
    assert len(db.execute(select(Dream)).scalars().all()) == 1
    assert db.execute(select(CreditHold)).scalars().all() == []


# --- ownership (T6.g) --------------------------------------------------------------------
def test_foreign_dream_is_404_not_403(client, db):
    me_a = _me(client, sub="sub-a", email="a@example.com")
    dream = _insert_dream(db, me_a["id"])

    headers_b = auth_headers(sub="sub-b", email="b@example.com")
    assert client.get(f"/api/v1/dreams/{dream.id}", headers=headers_b).status_code == 404
    assert client.delete(f"/api/v1/dreams/{dream.id}", headers=headers_b).status_code == 404
    assert client.get(f"/api/v1/dreams/{dream.id}/video", headers=headers_b).status_code == 404

    listing = client.get("/api/v1/dreams", headers=headers_b).json()
    assert listing["items"] == []


def test_unknown_dream_404(client):
    _me(client)
    r = client.get(f"/api/v1/dreams/{new_id()}", headers=auth_headers())
    assert r.status_code == 404


# --- delete (T6.h, B5: no cancel) ------------------------------------------------------------
def test_delete_running_dream_409(client, db):
    me = _me(client)
    dream = _insert_dream(db, me["id"], status="rendering")
    r = client.delete(f"/api/v1/dreams/{dream.id}", headers=auth_headers())
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "DREAM_RUNNING"


def test_delete_terminal_dream(client, db):
    me = _me(client)
    dream = _insert_dream(db, me["id"], status="failed")
    db.add(GenerationJob(id=new_id(), dream_id=dream.id, status="failed"))
    db.commit()

    r = client.delete(f"/api/v1/dreams/{dream.id}", headers=auth_headers())
    assert r.status_code == 200
    assert client.get(f"/api/v1/dreams/{dream.id}", headers=auth_headers()).status_code == 404


# --- artifacts before completion (T6.j) ---------------------------------------------------------
def test_video_404_before_completion(client, db):
    me = _me(client)
    dream = _insert_dream(db, me["id"], status="rendering")
    r = client.get(f"/api/v1/dreams/{dream.id}/video", headers=auth_headers())
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "VIDEO_NOT_READY"
    assert client.get(
        f"/api/v1/dreams/{dream.id}/thumbnail", headers=auth_headers()
    ).status_code == 404


# --- retry guard --------------------------------------------------------------------------------
def test_retry_requires_failed_state(client, db):
    me = _me(client)
    dream = _insert_dream(db, me["id"], status="completed")
    r = client.post(f"/api/v1/dreams/{dream.id}/retry", headers=auth_headers())
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "INVALID_STATE"


# --- startup recovery (T6.l, E2) ------------------------------------------------------------------
def test_recover_interrupted_fails_jobs_and_refunds(client, db):
    me = _me(client)
    dream = _insert_dream(db, me["id"], status="rendering")
    db.add(GenerationJob(id=new_id(), dream_id=dream.id, status="running", progress=0.4))
    db.commit()
    credit_service.hold(db, user_id=me["id"], dream_id=dream.id)
    db.commit()
    assert client.get("/api/v1/credits/balance", headers=auth_headers()).json()["balance"] == 5

    recovered = recover_interrupted(db)
    db.commit()
    assert recovered == 1

    body = client.get(f"/api/v1/dreams/{dream.id}", headers=auth_headers()).json()
    assert body["status"] == "failed"
    assert "restart" in body["error"]
    assert body["job"]["status"] == "failed"
    assert client.get("/api/v1/credits/balance", headers=auth_headers()).json()["balance"] == 10


# --- rate limiting (T6.m) ----------------------------------------------------------------------------
def test_dreams_rate_limit_429(client, db, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    me = _me(client)
    _set_balance(db, me["id"], 0)  # 402s, so no jobs actually spawn

    for _ in range(5):
        r = client.post("/api/v1/dreams", json={"prompt": "a dream"}, headers=auth_headers())
        assert r.status_code == 402
    r = client.post("/api/v1/dreams", json={"prompt": "a dream"}, headers=auth_headers())
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "RATE_LIMITED"
    assert "retry_after_seconds" in r.json()["error"]["details"]
