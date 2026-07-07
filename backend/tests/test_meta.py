"""T7 — health/config shape, error envelope, CORS (TODO §7)."""
from __future__ import annotations

from conftest import auth_headers


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "mock": True}


def test_config_shape_drives_frontend_copy(client):
    r = client.get("/api/v1/config")
    assert r.status_code == 200
    body = r.json()
    assert body["signup_bonus_credits"] == 10
    assert body["credit_cost_per_video"] == 5
    assert body["usd_per_credit"] == 1
    assert body["min_purchase_usd"] == 5
    assert body["mock"] is True and body["payments_mock"] is True
    # 3-slot test blueprint: 8 + 8 + 4 seconds
    assert body["video"]["n_segments"] == 3
    assert body["video"]["approx_duration_secs"] == 20
    assert body["video"]["resolution"] == "720p"
    assert body["video"]["aspect_ratio"] == "16:9"


def test_error_envelope_on_401(client):
    r = client.get("/api/v1/users/me")
    assert r.status_code == 401
    err = r.json()["error"]
    assert err["code"] == "UNAUTHORIZED"
    assert "message" in err and "details" in err


def test_error_envelope_on_404_route(client):
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


def test_error_envelope_on_422_validation(client):
    r = client.post("/api/v1/dreams", json={}, headers=auth_headers())
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_cors_allows_frontend_origin(client):
    r = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_root_index(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "Dreamers API"
