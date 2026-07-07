"""T4 — checkout validation, webhook signature + exactly-once fulfillment (TODO §4)."""
from __future__ import annotations

import hashlib
import hmac
import json
import time

import pytest

from conftest import auth_headers

WEBHOOK_SECRET = "whsec_testsecret"


def _sign(payload: bytes, *, secret: str = WEBHOOK_SECRET, timestamp: int | None = None) -> str:
    t = int(time.time()) if timestamp is None else timestamp
    mac = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={t},v1={mac}"


def _completed_event(session_id: str, event_id: str = "evt_1") -> bytes:
    return json.dumps({
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {"object": {"id": session_id, "payment_intent": "pi_test_123"}},
    }).encode()


def _post_webhook(client, payload: bytes, header: str | None = None):
    return client.post(
        "/api/v1/payments/webhook",
        content=payload,
        headers={
            "Stripe-Signature": header if header is not None else _sign(payload),
            "Content-Type": "application/json",
        },
    )


def _checkout(client, amount: int) -> dict:
    r = client.post("/api/v1/payments/checkout", json={"amount_usd": amount},
                    headers=auth_headers())
    assert r.status_code == 200, r.text
    return r.json()


def _balance(client) -> int:
    return client.get("/api/v1/credits/balance", headers=auth_headers()).json()["balance"]


# --- checkout amounts (B4) ------------------------------------------------------
@pytest.mark.parametrize("amount", [0, 4, 7, -5, 12, 3])
def test_invalid_amounts_rejected(client, amount):
    r = client.post("/api/v1/payments/checkout", json={"amount_usd": amount},
                    headers=auth_headers())
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_AMOUNT"


@pytest.mark.parametrize("amount", [5, 10, 25, 50])
def test_valid_amounts_accepted(client, amount):
    body = _checkout(client, amount)
    assert body["checkout_url"].startswith("http://localhost:3000/credits/success")
    history = client.get("/api/v1/payments/history", headers=auth_headers()).json()
    assert history["items"][0]["amount_usd"] == amount
    assert history["items"][0]["credits"] == amount  # 1 credit = $1
    assert history["items"][0]["status"] == "pending"
    assert _balance(client) == 10  # NOT credited before the webhook


def test_non_integer_amount_is_validation_error(client):
    r = client.post("/api/v1/payments/checkout", json={"amount_usd": "ten"},
                    headers=auth_headers())
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


# --- webhook signature ------------------------------------------------------------
def _session_id_of(client) -> str:
    """Create a $25 pending payment and pull its session id from the mock URL."""
    body = _checkout(client, 25)
    return body["checkout_url"].split("session_id=")[1]


def test_webhook_bad_signature_rejected(client):
    session_id = _session_id_of(client)
    payload = _completed_event(session_id)
    r = _post_webhook(client, payload, header=_sign(payload, secret="whsec_wrong"))
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_SIGNATURE"
    assert _balance(client) == 10  # nothing credited


def test_webhook_missing_header_rejected(client):
    r = client.post("/api/v1/payments/webhook", content=b"{}",
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 400


def test_webhook_stale_timestamp_rejected(client):
    session_id = _session_id_of(client)
    payload = _completed_event(session_id)
    stale = int(time.time()) - 3600
    r = _post_webhook(client, payload, header=_sign(payload, timestamp=stale))
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "STALE_TIMESTAMP"


def test_webhook_tampered_payload_rejected(client):
    session_id = _session_id_of(client)
    payload = _completed_event(session_id)
    header = _sign(payload)
    tampered = payload.replace(b"25", b"99") if b"25" in payload else payload + b" "
    r = _post_webhook(client, tampered, header=header)
    assert r.status_code == 400


# --- fulfillment --------------------------------------------------------------------
def test_completed_event_credits_exactly_once(client):
    session_id = _session_id_of(client)
    payload = _completed_event(session_id)

    r = _post_webhook(client, payload)
    assert r.status_code == 200 and r.json()["handled"] is True
    assert _balance(client) == 35  # 10 signup + 25 purchased

    history = client.get("/api/v1/payments/history", headers=auth_headers()).json()
    assert history["items"][0]["status"] == "succeeded"
    assert history["items"][0]["fulfilled_at"] is not None

    ledger = client.get("/api/v1/credits/ledger", headers=auth_headers()).json()
    purchases = [e for e in ledger["items"] if e["reason"] == "purchase"]
    assert len(purchases) == 1 and purchases[0]["delta"] == 25


def test_duplicate_webhook_delivery_is_noop(client):
    """E3: Stripe retries — same event id twice must credit once."""
    session_id = _session_id_of(client)
    payload = _completed_event(session_id, event_id="evt_dup")
    assert _post_webhook(client, payload).status_code == 200
    assert _post_webhook(client, payload).status_code == 200
    assert _balance(client) == 35
    # a retry with a DIFFERENT event id for the same session is also a no-op
    payload2 = _completed_event(session_id, event_id="evt_dup_2")
    assert _post_webhook(client, payload2).status_code == 200
    assert _balance(client) == 35


def test_expired_event_marks_payment_no_credits(client):
    session_id = _session_id_of(client)
    payload = json.dumps({
        "id": "evt_exp",
        "type": "checkout.session.expired",
        "data": {"object": {"id": session_id}},
    }).encode()
    r = _post_webhook(client, payload)
    assert r.status_code == 200
    history = client.get("/api/v1/payments/history", headers=auth_headers()).json()
    assert history["items"][0]["status"] == "expired"
    assert _balance(client) == 10


def test_unknown_session_is_acked_noop(client):
    """E-webhook: unknown sessions must be 200-acked or Stripe retries forever."""
    payload = _completed_event("cs_never_seen")
    r = _post_webhook(client, payload)
    assert r.status_code == 200
    assert r.json()["handled"] is False


def test_history_scoped_to_user(client):
    _checkout(client, 5)  # user1
    other = {"sub": "sub-other", "email": "other@example.com"}
    r = client.get("/api/v1/payments/history", headers=auth_headers(**other))
    assert r.json()["items"] == []
