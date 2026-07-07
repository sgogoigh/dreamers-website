"""T2 — JWT bridge, upsert, signup bonus (TODO §2)."""
from __future__ import annotations

from conftest import auth_headers, make_token


def test_missing_token_401(client):
    r = client.get("/api/v1/users/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_malformed_header_401(client):
    r = client.get("/api/v1/users/me", headers={"Authorization": "Bearer"})
    assert r.status_code == 401
    r = client.get("/api/v1/users/me", headers={"Authorization": "garbage"})
    assert r.status_code == 401


def test_tampered_signature_401(client):
    token = make_token(secret="wrong-secret")
    r = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_expired_token_401(client):
    token = make_token(expires_in=-10)
    r = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "TOKEN_EXPIRED"


def test_token_missing_claims_401(client):
    import time

    import jwt as pyjwt

    now = int(time.time())
    token = pyjwt.encode({"sub": "s", "iat": now, "exp": now + 600}, "test-secret", algorithm="HS256")
    r = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_first_login_creates_user_with_signup_bonus(client):
    r = client.get("/api/v1/users/me", headers=auth_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "user1@example.com"
    assert body["credit_balance"] == 10  # B1
    assert body["dreams_count"] == 0


def test_replayed_login_no_duplicate_bonus(client):
    for _ in range(3):
        r = client.get("/api/v1/users/me", headers=auth_headers())
        assert r.json()["credit_balance"] == 10

    ledger = client.get("/api/v1/credits/ledger", headers=auth_headers()).json()
    bonus_rows = [e for e in ledger["items"] if e["reason"] == "signup_bonus"]
    assert len(bonus_rows) == 1
    assert bonus_rows[0]["delta"] == 10


def test_two_google_accounts_are_separate_users(client):
    a = client.get("/api/v1/users/me", headers=auth_headers(sub="sub-a", email="a@example.com"))
    b = client.get("/api/v1/users/me", headers=auth_headers(sub="sub-b", email="b@example.com"))
    assert a.json()["id"] != b.json()["id"]
    assert a.json()["credit_balance"] == b.json()["credit_balance"] == 10


def test_profile_refresh_on_return_login(client):
    client.get("/api/v1/users/me", headers=auth_headers(name="Old Name"))
    r = client.get("/api/v1/users/me", headers=auth_headers(name="New Name"))
    assert r.json()["name"] == "New Name"


def test_query_param_token_fallback(client):
    """EventSource/<video> can't set headers — ?token= must work (PLAN §6)."""
    token = make_token()
    r = client.get(f"/api/v1/credits/balance?token={token}")
    assert r.status_code == 200
    assert r.json()["balance"] == 10
