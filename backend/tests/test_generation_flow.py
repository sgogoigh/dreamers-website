"""T6 (render paths) — full mock generation: happy path, two-free-runs, failure
refunds, retry, SSE (TODO §6). Runs the REAL job machinery (thread worker +
ffmpeg placeholder clips); only Gemini/Veo are stubbed by mock mode."""
from __future__ import annotations

import json
import time

from sqlalchemy import select

from conftest import auth_headers, wait_terminal

from app.models.credit import CreditHold
from app.services import gemini_service, veo_service

PROMPT = "a lighthouse keeper who befriends a storm, cinematic and melancholic"


def _me(client) -> dict:
    return client.get("/api/v1/users/me", headers=auth_headers()).json()


def _balance(client) -> int:
    return client.get("/api/v1/credits/balance", headers=auth_headers()).json()["balance"]


def _create(client) -> dict:
    r = client.post("/api/v1/dreams", json={"prompt": PROMPT}, headers=auth_headers())
    assert r.status_code == 201, r.text
    return r.json()


# --- happy path (T6.a) -------------------------------------------------------------
def test_happy_path_end_to_end(client, db):
    _me(client)
    created = _create(client)
    assert created["status"] == "queued"
    assert created["title"].startswith("a lighthouse keeper")
    assert _balance(client) == 5  # 5-credit hold placed at submit

    body = wait_terminal(client, auth_headers(), created["id"])
    assert body["status"] == "completed", body.get("error")
    assert body["credits_charged"] == 5
    assert body["duration_secs"] == 20  # 8 + 8 + 4 (3-slot test blueprint)
    assert body["job"]["progress"] == 1.0
    assert len(body["job"]["segments"]) == 3
    assert all(s["status"] == "completed" for s in body["job"]["segments"])
    assert body["video_url"] and body["thumbnail_url"]

    # balance: captured, not refunded
    assert _balance(client) == 5
    ledger = client.get("/api/v1/credits/ledger", headers=auth_headers()).json()
    reasons = [e["reason"] for e in ledger["items"]]
    assert "generation" in reasons and "generation_refund" not in reasons

    # hold resolved
    holds = db.execute(select(CreditHold)).scalars().all()
    assert len(holds) == 1 and holds[0].status == "captured"

    # video playback + download (B7)
    r = client.get(f"/api/v1/dreams/{created['id']}/video", headers=auth_headers())
    assert r.status_code == 200
    assert r.headers["content-type"] == "video/mp4"
    assert "attachment" not in r.headers.get("content-disposition", "")
    assert len(r.content) > 10_000

    r = client.get(f"/api/v1/dreams/{created['id']}/video?download=1", headers=auth_headers())
    assert r.status_code == 200
    assert "attachment" in r.headers.get("content-disposition", "")

    r = client.get(f"/api/v1/dreams/{created['id']}/thumbnail", headers=auth_headers())
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"

    # sidebar list shows it
    listing = client.get("/api/v1/dreams", headers=auth_headers()).json()
    assert [d["id"] for d in listing["items"]] == [created["id"]]
    assert listing["items"][0]["status"] == "completed"

    # SSE snapshot path for a terminal dream: snapshot then close
    with client.stream(
        "GET", f"/api/v1/dreams/{created['id']}/events", headers=auth_headers()
    ) as resp:
        events = _drain_sse(resp)
    assert events[0]["type"] == "snapshot"
    assert events[0]["status"] == "completed"
    assert events[-1]["type"] == "close"


# --- B1/B2/B3 end-to-end (T6.k) -----------------------------------------------------
def test_two_free_runs_then_locked(client):
    _me(client)

    first = _create(client)
    assert wait_terminal(client, auth_headers(), first["id"])["status"] == "completed"
    assert _balance(client) == 5

    second = _create(client)
    assert wait_terminal(client, auth_headers(), second["id"])["status"] == "completed"
    assert _balance(client) == 0

    r = client.post("/api/v1/dreams", json={"prompt": PROMPT}, headers=auth_headers())
    assert r.status_code == 402
    assert r.json()["error"]["code"] == "INSUFFICIENT_CREDITS"


# --- failure refunds (T6.e, B6) --------------------------------------------------------
def test_script_stage_failure_refunds(client, monkeypatch):
    _me(client)

    def boom(**_kw):
        raise RuntimeError("gemini exploded")

    monkeypatch.setattr(gemini_service, "generate_script", boom)
    created = _create(client)
    body = wait_terminal(client, auth_headers(), created["id"])

    assert body["status"] == "failed"
    assert "gemini exploded" in body["error"]
    assert body["credits_charged"] == 0
    assert _balance(client) == 10  # full refund

    ledger = client.get("/api/v1/credits/ledger", headers=auth_headers()).json()
    reasons = [(e["reason"], e["delta"]) for e in ledger["items"]]
    assert ("generation", -5) in reasons and ("generation_refund", 5) in reasons


def test_render_stage_failure_refunds(client, monkeypatch):
    _me(client)

    def boom(**_kw):
        raise RuntimeError("veo quota exhausted")

    monkeypatch.setattr(veo_service, "run_generation", boom)
    created = _create(client)
    body = wait_terminal(client, auth_headers(), created["id"])

    assert body["status"] == "failed"
    assert "veo quota exhausted" in body["error"]
    assert _balance(client) == 10


# --- retry (T6.f) --------------------------------------------------------------------------
def test_retry_after_failure_charges_once(client, monkeypatch):
    _me(client)
    calls = {"n": 0}
    real = gemini_service.generate_script

    def flaky(**kw):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("transient blip")
        return real(**kw)

    monkeypatch.setattr(gemini_service, "generate_script", flaky)

    created = _create(client)
    body = wait_terminal(client, auth_headers(), created["id"])
    assert body["status"] == "failed"
    assert _balance(client) == 10  # refunded

    r = client.post(f"/api/v1/dreams/{created['id']}/retry", headers=auth_headers())
    assert r.status_code == 200
    assert _balance(client) == 5  # new hold

    body = wait_terminal(client, auth_headers(), created["id"])
    assert body["status"] == "completed"
    assert body["credits_charged"] == 5
    assert body["error"] is None
    assert _balance(client) == 5  # exactly one successful charge overall

    ledger = client.get("/api/v1/credits/ledger", headers=auth_headers()).json()
    assert sum(e["delta"] for e in ledger["items"]) == 5  # +10 -5 +5 -5


# --- SSE live progress (T6.i) -----------------------------------------------------------------
def test_sse_live_events_during_run(client, monkeypatch):
    _me(client)
    real = gemini_service.generate_script

    def slow(**kw):
        time.sleep(1.0)  # give the SSE client time to attach before stage 1
        return real(**kw)

    monkeypatch.setattr(gemini_service, "generate_script", slow)
    created = _create(client)

    events = []
    with client.stream(
        "GET", f"/api/v1/dreams/{created['id']}/events", headers=auth_headers()
    ) as resp:
        assert resp.headers["content-type"].startswith("text/event-stream")
        events = _drain_sse(resp, max_seconds=120)

    types = [e["type"] for e in events]
    assert types[0] == "snapshot"
    assert "segment" in types                      # per-beat progress
    assert any(e["type"] == "stage" and e["stage"] == "stitching" for e in events)
    finals = [e for e in events if e["type"] == "status"]
    assert finals and finals[-1]["status"] == "completed"
    assert finals[-1]["video_url"].endswith("/video")
    assert types[-1] == "close"

    wait_terminal(client, auth_headers(), created["id"])


# --- helpers ------------------------------------------------------------------------------------
def _drain_sse(resp, max_seconds: float = 60.0) -> list[dict]:
    events: list[dict] = []
    start = time.time()
    for line in resp.iter_lines():
        if time.time() - start > max_seconds:
            raise AssertionError("SSE stream did not close in time")
        if not line.startswith("data: "):
            continue
        event = json.loads(line[len("data: "):])
        events.append(event)
        if event.get("type") == "close":
            break
    return events
