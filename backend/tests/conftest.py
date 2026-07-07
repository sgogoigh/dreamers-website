"""Test bootstrap.

The env is pinned BEFORE the app is imported: mock pipeline (zero API cost),
throwaway SQLite file, 3-slot blueprint for fast renders, rate limiting off,
periodic sweep off. Every test gets a fresh schema.
"""
from __future__ import annotations

import os
import sys
import tempfile
import time
from pathlib import Path

_TEST_ROOT = Path(tempfile.mkdtemp(prefix="dreamers-test-"))
os.environ["DREAMERS_MOCK"] = "1"
os.environ["DATABASE_URL"] = "sqlite:///" + (_TEST_ROOT / "test.db").as_posix()
os.environ["DREAMERS_DATA_DIR"] = str(_TEST_ROOT / "data")
os.environ["AUTH_SECRET"] = "test-secret"
os.environ["STRIPE_SECRET_KEY"] = ""            # payments mock mode
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_testsecret"
os.environ["RATE_LIMIT_ENABLED"] = "0"
os.environ["SWEEP_INTERVAL_SECONDS"] = "0"
os.environ["FRONTEND_URL"] = "http://localhost:3000"
os.environ["DREAMERS_TRAILER_SLOTS"] = "3"      # fast mock renders (8+8+4s)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ importable

import jwt as pyjwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import rate_limit  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.jobs import job_manager  # noqa: E402
from app.main import app  # noqa: E402
from app.models.base import Base, new_id  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services import credit_service  # noqa: E402

AUTH_SECRET = "test-secret"


# ---------------------------------------------------------------------------
# tokens
# ---------------------------------------------------------------------------
def make_token(
    sub: str = "google-sub-1",
    email: str = "user1@example.com",
    name: str = "User One",
    picture: str = "https://example.com/a.png",
    expires_in: int = 3600,
    secret: str = AUTH_SECRET,
) -> str:
    now = int(time.time())
    return pyjwt.encode(
        {"sub": sub, "email": email, "name": name, "picture": picture,
         "iat": now, "exp": now + expires_in},
        secret,
        algorithm="HS256",
    )


def auth_headers(**kwargs) -> dict:
    return {"Authorization": f"Bearer {make_token(**kwargs)}"}


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    job_manager.reset()
    rate_limit.reset()
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db():
    session = SessionLocal()
    yield session
    session.close()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def make_user(db, *, sub: str = "sub-x", email: str = "x@example.com", credits: int = 0) -> User:
    """Direct-DB user for service-level tests (API tests sign in via JWT)."""
    user = User(id=new_id(), google_sub=sub, email=email, name="X", avatar_url="")
    db.add(user)
    db.commit()
    if credits:
        credit_service.grant(
            db, user_id=user.id, delta=credits, reason="signup_bonus",
            idempotency_key=f"signup:{user.id}",
        )
        db.commit()
    return user


def wait_terminal(client, headers: dict, dream_id: str, timeout: float = 120.0) -> dict:
    """Poll GET /dreams/{id} until completed/failed. Returns the final body."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/api/v1/dreams/{dream_id}", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        if body["status"] in ("completed", "failed"):
            return body
        time.sleep(0.25)
    raise AssertionError(f"dream {dream_id} did not reach a terminal state in {timeout}s")
