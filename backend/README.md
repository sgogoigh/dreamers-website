# Dreamers Backend

FastAPI service for **Dreamers** (see [`../PLAN.md`](../PLAN.md)): Google-JWT-authenticated
users, a SQL-backed credit system (**10 signup credits, 5 per video, $1 = 1 credit**),
Stripe top-ups, and the vendored `dreamers-ai` generation pipeline (Gemini 3.5 Flash
script → chained Veo 3.1 prompts → clips → ffmpeg stitch) behind a one-shot dream API
with SSE progress.

## Quick start

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# MOCK mode — no API keys, no cost, fully functional (stub Gemini/Veo,
# real ffmpeg placeholder clips). Best for frontend dev + CI.
.\run.ps1 -Mock

# Live mode (reads GEMINI_API_KEY etc. from backend/.env; Veo calls are paid).
.\run.ps1
```

Open **http://localhost:8000/docs** for interactive OpenAPI docs.
Copy `.env.example` → `.env` and fill in secrets for live mode.

## Modes

| Knob | Effect |
|---|---|
| `DREAMERS_MOCK=1` | Gemini/Veo stubbed with deterministic fixtures; full flow works free |
| `STRIPE_SECRET_KEY` unset | Checkout returns mock session URLs (webhook still signature-verified) |
| `DREAMERS_TRAILER_SLOTS=3` | Trim the 8-shot blueprint for fast dev renders (keeps the title card) |

## API surface (`/api/v1`, 🔒 = `Authorization: Bearer <jwt>`)

| Method & path | Purpose |
|---|---|
| `GET /health` · `GET /config` | liveness · pricing/capabilities (drives frontend copy) |
| 🔒 `GET /users/me` | profile + balance + dream count (first login grants +10) |
| 🔒 `GET /credits/balance` · `/credits/ledger` | balance/held/videos-remaining · paginated audit trail |
| 🔒 `POST /payments/checkout` | `{amount_usd}` (≥$5, ×$5) → Stripe Checkout URL |
| `POST /payments/webhook` | signed Stripe events — the ONLY path that credits a purchase |
| 🔒 `GET /payments/history` | past purchases |
| 🔒 `POST /dreams` | **the point of no return**: hold 5 credits + start generation (`402`/`409` guards) |
| 🔒 `GET /dreams` · `GET /dreams/{id}` | sidebar list · full dream + job progress |
| 🔒 `POST /dreams/{id}/retry` | failed dreams only; new hold; finished segments reused |
| 🔒 `DELETE /dreams/{id}` | terminal dreams only (no cancel semantics — rule B5) |
| 🔒 `GET /dreams/{id}/events` | SSE progress (snapshot → live → close); use `?token=` |
| 🔒 `GET /dreams/{id}/video` | stream mp4; `?download=1` for attachment; `?token=` for `<video>` tags |
| 🔒 `GET /dreams/{id}/thumbnail` | poster frame |

Errors are enveloped uniformly: `{"error": {"code", "message", "details"}}` —
notable codes: `INSUFFICIENT_CREDITS` (402), `GENERATION_IN_PROGRESS` (409),
`TOKEN_EXPIRED` (401), `INVALID_AMOUNT` (422), `RATE_LIMITED` (429).

## Credit semantics (PLAN §7)

Atomic **hold** of 5 credits at submit (`UPDATE … WHERE balance >= 5` — race-proof,
never negative) → **capture** on success → **release** (auto-refund) on any failure,
server restart (startup recovery), or orphaned hold (periodic sweep). The append-only
`credit_ledger` satisfies `sum(deltas) == balance + active holds` at all times.

## Layout

```
app/
  config.py  db.py  errors.py  security.py  rate_limit.py  storage.py
  main.py             # app factory, CORS, /api/v1, lifespan (recovery + sweep)
  jobs.py             # JobManager: thread worker + SSE fan-out
  models/             # SQLAlchemy: User, CreditLedgerEntry, CreditHold, Payment, Dream, GenerationJob
  schemas/            # Pydantic request/response models
  api/                # routers: meta, users, credits, payments, dreams
  services/           # auth, credit (ONLY ledger writer), payment (ONLY Stripe caller),
                      # generation (stage machine), gemini/veo (vendored, mock-capable)
  pipeline/           # VENDORED from dreamers-ai — verbatim; no app imports except config
tests/                # 73 tests, run entirely in mock mode (zero API cost)
```

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Covers: JWT auth + signup-bonus idempotency, every credit invariant (including a
6-thread hold race), Stripe webhook signature/idempotency/expiry, prompt validation,
402/409/404 guards, full mock generation (video + thumbnail + download), failure
refunds at each stage, retry, startup recovery, SSE snapshot + live streams, and
rate limiting.
