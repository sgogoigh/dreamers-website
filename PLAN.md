# DREAMERS — Product & Engineering Plan

> **One-line pitch:** Type a dream. Get a one-minute cinematic video. Download it.
>
> Dreamers is a consumer web app where users describe a video in natural language and
> receive a ~60-second AI-generated cinematic video (powered by the proven
> `dreamers-ai` pipeline: Gemini 3.5 Flash scripting → chained Veo 3.1 clips →
> ffmpeg stitch). Monetized through a credit system: **10 free credits on signup,
> 5 credits per generation** (two free videos), then **$1 = 1 credit** top-ups via
> Stripe (min $5, multiples of $5).

---

## Table of Contents

1. [Product Overview & Business Rules](#1-product-overview--business-rules)
2. [Tech Stack Decisions](#2-tech-stack-decisions)
3. [Repository Layout](#3-repository-layout)
4. [System Architecture](#4-system-architecture)
5. [Database Schema (SQL)](#5-database-schema-sql)
6. [Authentication (Google Sign-In)](#6-authentication-google-sign-in)
7. [Credit System](#7-credit-system)
8. [Payments (Stripe)](#8-payments-stripe)
9. [Generation Pipeline Integration](#9-generation-pipeline-integration)
10. [Backend API Surface](#10-backend-api-surface)
11. [Frontend — Pages, Routes & Components](#11-frontend--pages-routes--components)
12. [Landing Page — Design Direction](#12-landing-page--design-direction)
13. [Studio (Chat Interface) — UX Spec](#13-studio-chat-interface--ux-spec)
14. [Flowcharts — Every Scenario](#14-flowcharts--every-scenario)
15. [Error Handling, Edge Cases & Security](#15-error-handling-edge-cases--security)
16. [Environment Variables](#16-environment-variables)
17. [Testing Strategy](#17-testing-strategy)
18. [Deployment Plan](#18-deployment-plan)
19. [Build Milestones](#19-build-milestones)

---

## 1. Product Overview & Business Rules

### What the user gets
- A **landing page** — rich, colorful, interactive art direction (nav: **Generate · About · Catalogue · Contact**).
- A **studio** (chat-style interface) — natural-language prompt in, one-minute video out, with a **download** button.
- A **left sidebar** in the studio — previous chats (dreams), credit usage, and generation history.

### Hard business rules (source of truth)

| # | Rule |
|---|------|
| B1 | New account → **10 Dreamer Credits** granted exactly once (signup bonus). |
| B2 | One video generation costs **5 credits** → two free runs per new user. |
| B3 | Generation is **blocked** unless `balance ≥ 5` (a user with 1–4 leftover credits cannot generate; they must top up). |
| B4 | **1 credit = $1.** Minimum purchase **$5**; any amount must be a **multiple of $5** ($5, $10, $15, …). |
| B5 | Before a prompt is submitted, the user is asked **once** via a confirmation modal: *"Is this prompt final?"* — after confirming, **generation cannot be terminated** by the user. |
| B6 | Credits are deducted for a generation; if generation **fails on our side**, the 5 credits are **automatically refunded** (users never pay for a video they didn't get). |
| B7 | The finished video is playable in-browser and **downloadable** as MP4. |
| B8 | Only **signed-in** users (Google) can access the studio, generate, or pay. Account data lives in a **SQL database**. |

> **Design note on B3/B6 vs the raw requirement** ("once video is generated, deduct, then check creds > 0"): deducting only *after* generation would let a 5-credit user queue unlimited concurrent runs before any deduction lands, and "creds > 0" would allow a 1-credit user to start a 5-credit job into negative balance. We instead **place a 5-credit hold at submit time** (atomically, inside a DB transaction), **capture** the hold on success, and **release** (refund) it on failure. Net effect for honest usage is identical to the stated rule — two free runs, no generation without enough credits — but it is race-proof and never goes negative. See §7.

### Video product spec (inherited from `dreamers-ai`)
- **Duration:** ~58–64s (8-slot blueprint: 7 Veo clips + 1 composed title card; per-clip 4/6/8s).
- **Resolution:** 720p, 16:9 (Veo chaining constraint; upscale later if desired).
- **Format:** H.264 + AAC MP4 — plays natively in `<video>`, downloads cleanly.
- **Latency:** minutes, not seconds (7 sequential Veo generations + stitch). The UI is built around a **live progress experience**, not a spinner.

---

## 2. Tech Stack Decisions

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Next.js 15 (App Router) + React 19 + TypeScript** | Matches the existing `dreamers-ai/frontend` stack; SSR for the landing page (SEO + fast paint); file-based routing. |
| Styling | **Tailwind CSS v4** + CSS custom properties for the theme | Fast iteration; design tokens for the "dream" palette. |
| Animation / interactivity | **Framer Motion** (component/state animation) + **GSAP ScrollTrigger + Lenis** (scroll-driven landing scenes) + lightweight **canvas/WebGL** starfield (no heavy three.js scene unless needed) | The reference sites (northgarden, parallel universe, Posthive) are scroll-narrative sites — GSAP ScrollTrigger is the industry tool for that. |
| Auth | **Auth.js (NextAuth v5)** with **Google provider**, JWT session strategy; FastAPI verifies the same JWT (shared `AUTH_SECRET`, HS256) | One Google OAuth integration, session available in both the Next.js edge and the Python API without a second login hop. |
| Backend framework | **FastAPI (Python 3.11+)** | The generation pipeline is already Python/FastAPI (`dreamers-ai/backend`); we vendor it wholesale. |
| Database | **PostgreSQL** in production, **SQLite** for local dev — via **SQLAlchemy 2.0 + Alembic** migrations | SQL requirement; SQLAlchemy makes the SQLite↔Postgres swap a connection-string change. |
| Payments | **Stripe Checkout** (hosted page) + **webhooks** | PCI burden stays with Stripe; Checkout handles cards/wallets/receipts; webhook is the only source of truth for crediting. |
| Job execution | In-process async worker (thread via `asyncio.to_thread`, same pattern as `dreamers-ai/jobs.py`), **SSE** for live progress | Proven in the existing codebase; single-box deploys stay simple. Upgrade path: Redis + arq/Celery when scaling beyond one instance. |
| Video generation | **Vendored `dreamers-ai` pipeline** (`app/pipeline/` — Gemini 3.5 Flash + Veo 3.1 + ffmpeg) | It's validated end-to-end (see `dreamers-ai/LIMITATIONS.md` §5) and self-contained by design. |
| File storage | Local disk `data/artifacts/<dream_id>/` for v1; S3/GCS adapter interface for prod | Matches pipeline output; interface keeps the swap cheap. |

---

## 3. Repository Layout

```
dreamers-website/
├── PLAN.md                      # this document
├── README.md
├── docker-compose.yml           # postgres + backend + frontend for local dev
│
├── frontend/                    # Next.js 15 app
│   ├── package.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── .env.local.example
│   ├── public/
│   │   ├── art/                 # landing illustrations, grain textures, posters
│   │   └── samples/             # catalogue preview MP4s/posters
│   └── src/
│       ├── app/
│       │   ├── layout.tsx               # root layout: fonts, theme, providers
│       │   ├── page.tsx                 # LANDING (Generate/About/Catalogue/Contact)
│       │   ├── globals.css
│       │   ├── (auth)/
│       │   │   └── signin/page.tsx      # Google sign-in page
│       │   ├── studio/
│       │   │   ├── layout.tsx           # auth-guarded shell: sidebar + main pane
│       │   │   ├── page.tsx             # new dream (empty chat state)
│       │   │   └── [dreamId]/page.tsx   # existing dream thread (progress/video)
│       │   ├── credits/page.tsx         # buy credits (packages, Stripe redirect)
│       │   ├── credits/success/page.tsx # post-checkout landing (poll balance)
│       │   ├── credits/cancelled/page.tsx
│       │   ├── account/page.tsx         # profile, ledger, payment history
│       │   └── api/auth/[...nextauth]/route.ts   # Auth.js handlers
│       ├── components/
│       │   ├── landing/         # Hero, AboutSection, CatalogueSection,
│       │   │                    # ContactSection, StarField, ScrollScene, Marquee, Nav
│       │   ├── studio/          # Sidebar, DreamList, CreditMeter, PromptComposer,
│       │   │                    # ConfirmModal, GenerationProgress, SegmentTimeline,
│       │   │                    # VideoPlayer, DownloadButton, InsufficientCredits
│       │   ├── payments/        # PackagePicker, AmountStepper (×$5), CheckoutButton
│       │   └── ui/              # Button, Modal, Toast, Skeleton, Badge, Tooltip
│       ├── lib/
│       │   ├── api.ts           # typed fetch client for the FastAPI backend
│       │   ├── auth.ts          # Auth.js config (Google provider, JWT callbacks)
│       │   ├── sse.ts           # EventSource wrapper w/ reconnect
│       │   └── format.ts        # credits/dates/durations
│       ├── hooks/               # useDreams, useCredits, useGenerationEvents, useUser
│       ├── types/               # generated API types (openapi-typescript)
│       └── middleware.ts        # protects /studio, /credits, /account
│
└── backend/                     # FastAPI app
    ├── requirements.txt
    ├── .env.example
    ├── alembic.ini
    ├── alembic/versions/        # migrations
    ├── run.ps1 / run.sh
    ├── app/
    │   ├── main.py              # app factory, CORS, routers, /api/v1 prefix
    │   ├── config.py            # settings (env), mock mode, pricing constants
    │   ├── db.py                # SQLAlchemy engine/session, get_db dependency
    │   ├── models/              # ORM models (one file per aggregate)
    │   │   ├── user.py
    │   │   ├── credit.py        # CreditLedgerEntry, CreditHold
    │   │   ├── payment.py
    │   │   └── dream.py         # Dream, GenerationJob
    │   ├── schemas/             # Pydantic request/response models
    │   │   ├── auth.py  user.py  credit.py  payment.py  dream.py
    │   ├── api/                 # routers
    │   │   ├── auth.py          # /auth/me (JWT-verified identity, user upsert)
    │   │   ├── users.py         # /users/me
    │   │   ├── credits.py       # /credits/balance, /credits/ledger
    │   │   ├── payments.py      # /payments/checkout, /payments/webhook, /payments/history
    │   │   ├── dreams.py        # CRUD + /dreams/{id}/events (SSE) + /video
    │   │   └── meta.py          # /health, /config (capabilities, mock flag)
    │   ├── services/
    │   │   ├── auth_service.py      # JWT decode/verify (shared AUTH_SECRET), user upsert
    │   │   ├── credit_service.py    # grant / hold / capture / release — ALL credit math
    │   │   ├── payment_service.py   # checkout session creation, webhook fulfillment
    │   │   ├── dream_service.py     # dream lifecycle orchestration
    │   │   └── generation_service.py# runs the vendored pipeline end-to-end w/ progress
    │   ├── jobs.py              # JobManager (adapted from dreamers-ai: SSE fan-out, one job/dream)
    │   ├── storage.py           # artifact dirs, atomic writes
    │   └── pipeline/            # ★ VENDORED, UNMODIFIED-AS-POSSIBLE copy of
    │       │                    #   dreamers-ai/backend/app/pipeline/
    │       ├── constants.py     #   model ids, snap_duration (4/6/8s)
    │       ├── schema.py        #   TrailerBlueprint/Script/Prompts
    │       ├── script_writer.py #   step 2 (Gemini)
    │       ├── prompt_builder.py#   step 3 (Gemini)
    │       └── video.py         #   step 4 (Veo + ffmpeg)
    │       # NOTE: adapter.py (LoRA draft, GPU-only) is intentionally NOT carried
    │       # over — the consumer product goes straight from prompt → script.
    ├── services_mocks/          # mock Gemini/Veo fixtures (from dreamers-ai gemini/veo services)
    ├── data/                    # dev artifacts: artifacts/<dream_id>/*.mp4
    └── tests/
        ├── conftest.py          # test DB (sqlite), mock mode, auth fixtures
        ├── test_auth.py  test_credits.py  test_payments.py
        ├── test_dreams.py  test_generation_flow.py  test_webhooks.py
```

**Modularity rules**
- Routers contain **no business logic** — they validate, call a service, shape the response.
- `credit_service` is the **only** module allowed to write to the credit ledger.
- `payment_service` is the **only** module that talks to Stripe.
- The vendored `pipeline/` package keeps **zero imports** from the rest of the app (same contract as in `dreamers-ai`), so pipeline upgrades are a folder swap.
- Frontend components never call `fetch` directly — always through `lib/api.ts` (typed, auth-header-injecting client).

---

## 4. System Architecture

```mermaid
flowchart LR
    subgraph Browser
        L[Landing page]
        S[Studio SPA]
    end

    subgraph Frontend["frontend/ — Next.js 15 (:3000)"]
        AJ["Auth.js<br/>(Google OAuth)"]
        MW["middleware.ts<br/>route guard"]
    end

    subgraph Backend["backend/ — FastAPI (:8000)"]
        API["/api/v1 routers"]
        CS[credit_service]
        PS[payment_service]
        GS[generation_service]
        JM["JobManager<br/>(thread worker + SSE)"]
        PL["vendored pipeline/<br/>script → prompts → video"]
    end

    subgraph External
        G[Google OAuth]
        ST[Stripe]
        GM["Gemini 3.5 Flash"]
        VEO["Veo 3.1"]
    end

    subgraph Storage
        PG[(PostgreSQL)]
        FS["Artifacts disk<br/>data/artifacts/&lt;dream&gt;/"]
    end

    L --> S
    S -->|"JWT (Authorization: Bearer)"| API
    AJ <--> G
    MW --> AJ
    API --> CS & PS & GS
    GS --> JM --> PL
    PL --> GM & VEO
    PL --> FS
    CS & PS & API --> PG
    PS <-->|"checkout session / webhook"| ST
    API -->|"SSE progress + mp4 streaming"| S
```

**Key decisions**
- **Two processes, one contract.** Frontend and backend are independently deployable; the contract is `/openapi.json` (frontend generates TS types from it in CI).
- **JWT bridging.** Auth.js signs a JWT (HS256, shared `AUTH_SECRET`); every backend request carries `Authorization: Bearer <jwt>`. FastAPI middleware verifies signature + expiry and upserts/loads the user row. No session state in the backend.
- **The DB is the source of truth** for users, credits, payments, and dream metadata. Video files live on disk (path stored on the dream row). Pipeline intermediate JSON (script/prompts) is stored on the dream row as JSON columns for debuggability.
- **One generation job per dream, jobs survive restarts as failed-and-refunded** (on boot, any job stuck in `running` is marked failed and its hold released — never strand a user's credits).

---

## 5. Database Schema (SQL)

```sql
-- users ---------------------------------------------------------------
CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub     VARCHAR(64)  NOT NULL UNIQUE,   -- Google's stable subject id
    email          VARCHAR(255) NOT NULL UNIQUE,
    name           VARCHAR(255) NOT NULL DEFAULT '',
    avatar_url     TEXT         NOT NULL DEFAULT '',
    credit_balance INTEGER      NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- credit_balance is a DENORMALIZED cache; the ledger is authoritative.
-- Every ledger write updates it in the SAME transaction (SELECT ... FOR UPDATE).

-- credit ledger (append-only; the audit trail) -------------------------
CREATE TABLE credit_ledger (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id),
    delta           INTEGER NOT NULL,               -- +10 signup, -5 capture, +5 refund, +N purchase
    reason          VARCHAR(32) NOT NULL,           -- 'signup_bonus'|'generation'|'generation_refund'|'purchase'
    reference_type  VARCHAR(32),                    -- 'dream'|'payment'|NULL
    reference_id    VARCHAR(64),                    -- dream id / payment id
    balance_after   INTEGER NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE,            -- e.g. 'signup:<user_id>', 'purchase:<stripe_event_id>'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_user ON credit_ledger(user_id, created_at DESC);

-- credit holds (reservation while a generation runs) -------------------
CREATE TABLE credit_holds (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id),
    dream_id   UUID NOT NULL,                       -- 1:1 with the generation attempt
    amount     INTEGER NOT NULL,                    -- always 5 today; column keeps pricing flexible
    status     VARCHAR(16) NOT NULL DEFAULT 'held', -- 'held'|'captured'|'released'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_hold_dream ON credit_holds(dream_id);  -- one hold per dream

-- payments --------------------------------------------------------------
CREATE TABLE payments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id),
    stripe_session_id     VARCHAR(255) NOT NULL UNIQUE,
    stripe_payment_intent VARCHAR(255),
    amount_usd            INTEGER NOT NULL CHECK (amount_usd >= 5 AND amount_usd % 5 = 0),
    credits               INTEGER NOT NULL,          -- == amount_usd (1:1)
    status                VARCHAR(16) NOT NULL DEFAULT 'pending',  -- 'pending'|'succeeded'|'failed'|'expired'
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    fulfilled_at          TIMESTAMPTZ
);

-- dreams (a "chat" in the sidebar == one dream) --------------------------
CREATE TABLE dreams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    title           VARCHAR(120) NOT NULL,           -- auto: first ~8 words of prompt
    prompt          TEXT NOT NULL,                   -- the confirmed natural-language input
    status          VARCHAR(24) NOT NULL DEFAULT 'queued',
    -- 'queued'|'scripting'|'prompting'|'rendering'|'stitching'|'completed'|'failed'
    script_json     JSONB,                           -- pipeline step 2 output (debug/regeneration)
    prompts_json    JSONB,                           -- pipeline step 3 output
    video_path      TEXT,                            -- data/artifacts/<id>/trailer.mp4
    duration_secs   INTEGER,
    error           TEXT,
    credits_charged INTEGER NOT NULL DEFAULT 0,      -- 5 once captured, 0 if refunded
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_dreams_user ON dreams(user_id, created_at DESC);

-- generation jobs (progress detail; segments mirror pipeline beats) -------
CREATE TABLE generation_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dream_id    UUID NOT NULL UNIQUE REFERENCES dreams(id),
    status      VARCHAR(16) NOT NULL DEFAULT 'pending',  -- 'pending'|'running'|'completed'|'failed'
    progress    REAL NOT NULL DEFAULT 0,                 -- 0..1
    message     TEXT NOT NULL DEFAULT '',
    segments    JSONB NOT NULL DEFAULT '[]',             -- [{beat_no, status, duration, detail}]
    error       TEXT,
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);
```

**Invariants**
- `users.credit_balance == SUM(credit_ledger.delta)` for that user — enforced by doing both writes in one transaction with the user row locked (`FOR UPDATE`).
- `credit_balance >= 0` is a DB-level CHECK — the last line of defense against race bugs.
- Ledger `idempotency_key` makes signup bonus and webhook fulfillment **exactly-once** even under retries.
- A dream has **at most one** hold and one job (unique indexes).

---

## 6. Authentication (Google Sign-In)

### Flow
1. User clicks **Generate** (landing) or **Sign in** → routed to `/signin` (or straight to Google via Auth.js).
2. Auth.js runs the **Google OAuth (OIDC) code flow**; on success it holds `sub`, `email`, `name`, `picture`.
3. Auth.js `jwt` callback signs a compact JWT `{ sub: google_sub, email, name, picture, iat, exp }` with `AUTH_SECRET` (HS256) and stores it in an **httpOnly, Secure, SameSite=Lax cookie**.
4. `lib/api.ts` attaches the JWT as `Authorization: Bearer` on every backend call.
5. FastAPI's `get_current_user` dependency: verify signature + `exp` → **upsert** the user by `google_sub`:
   - **New user:** insert row, then `credit_service.grant(user, +10, reason='signup_bonus', idempotency_key=f'signup:{user.id}')`.
   - **Existing user:** update `last_login_at`, `name`, `avatar_url`.
6. `middleware.ts` (Next.js) redirects unauthenticated visits to `/studio|/credits|/account` → `/signin?next=<path>`.

### Why not sessions in the backend?
Stateless JWT keeps the Python API horizontally scalable and avoids a second store. Token lifetime 7 days with sliding refresh via Auth.js; on `401` from the API the frontend forces re-login and returns the user to where they were (`next` param).

### Sign-out
Auth.js `signOut()` clears the cookie; the backend has nothing to invalidate (short-lived JWTs + no server session). Account deletion (v2) cascades dreams/artifacts and anonymizes the ledger.

---

## 7. Credit System

All mutations go through `credit_service` — four operations only:

| Operation | Ledger delta | When |
|---|---|---|
| `grant_signup_bonus(user)` | `+10` | first login (idempotent) |
| `hold(user, dream, 5)` | *(no ledger row — hold row + balance decrement)* | prompt confirmed, before job starts |
| `capture(hold)` | `-5` (reason `generation`) | video completed successfully |
| `release(hold)` | *(hold voided — balance re-incremented)* | generation failed / job orphaned |
| `grant_purchase(user, n, stripe_event)` | `+n` (reason `purchase`) | Stripe webhook (idempotent on event id) |

### Hold semantics (race-proof deduction)

```
BEGIN;
  SELECT * FROM users WHERE id = :uid FOR UPDATE;      -- lock the balance
  IF credit_balance < 5 → ROLLBACK → 402 INSUFFICIENT_CREDITS;
  UPDATE users SET credit_balance = credit_balance - 5;
  INSERT INTO credit_holds (user_id, dream_id, amount=5, status='held');
COMMIT;
```

- **Capture** (success): mark hold `captured`, write ledger row `delta=-5, balance_after=<current>`, set `dreams.credits_charged=5`. Balance was already decremented at hold time, so capture is bookkeeping only.
- **Release** (failure): mark hold `released`, `UPDATE users SET credit_balance = credit_balance + 5`, write two ledger rows (`-5 generation` + `+5 generation_refund`) so the audit trail shows the attempt *and* the refund explicitly.
- **Orphan sweep:** on app startup and every 15 min, any `held` hold whose job is terminal or older than 2h → release. Users can never lose credits to a crash.

### Credit state machine

```mermaid
stateDiagram-v2
    [*] --> Available: signup +10 / purchase +N
    Available --> Held: prompt confirmed<br/>(balance ≥ 5, atomic −5 hold)
    Held --> Captured: video completed ✔<br/>(ledger −5, charged)
    Held --> Available: generation failed ✘<br/>(hold released, +5 back)
    Captured --> [*]
    note right of Available
        balance < 5 → composer locked,
        "Buy credits" CTA shown
    end note
```

### What the user sees
- **CreditMeter** in the sidebar: `balance` big, "1 video = 5 credits" small, progress ring showing videos-remaining.
- During generation the meter shows `balance` already reduced (hold) with a subtle "5 held for current dream" note.
- `/account` shows the full ledger (grants, purchases, charges, refunds) with timestamps and links to the dream/payment.

---

## 8. Payments (Stripe)

### Product model
- No subscriptions in v1 — **one-time top-ups** only.
- Frontend offers **packages**: `$5 / 5cr`, `$10 / 10cr`, `$25 / 25cr`, `$50 / 50cr`, plus a **custom stepper** that increments in $5 (client validates; server re-validates `amount >= 5 && amount % 5 == 0`).

### Flow (authoritative crediting via webhook only)
1. `POST /api/v1/payments/checkout` `{amount_usd: 25}` →
   - validate amount; create `payments` row (`pending`);
   - create Stripe **Checkout Session** (`mode=payment`, `client_reference_id=user_id`, `metadata={payment_id, credits}`, `success_url=/credits/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url=/credits/cancelled`);
   - return `{url}` → frontend redirects.
2. User pays on Stripe's hosted page.
3. **Webhook** `POST /api/v1/payments/webhook` (signature verified with `STRIPE_WEBHOOK_SECRET`):
   - `checkout.session.completed` → load `payments` row by `session_id`; if already `succeeded` → no-op (idempotent); else mark `succeeded`, `credit_service.grant_purchase(user, credits, idempotency_key=f'purchase:{event.id}')`.
   - `checkout.session.expired` → mark `expired`.
4. `/credits/success` page **polls** `GET /credits/balance` (webhook usually lands within seconds) and celebrates when the balance jumps; falls back to "your credits will appear shortly" after 30s.

**Never** credit on the success redirect alone — the redirect can be spoofed/replayed; the signed webhook is the only trusted signal.

### Refund policy (v1)
Card refunds are manual (Stripe dashboard). If issued, an ops script writes a negative `purchase_refund` ledger entry. Generation failures are refunded in **credits** automatically (§7) — never in cash.

---

## 9. Generation Pipeline Integration

### What we take from `dreamers-ai` (verbatim vendoring)
- `pipeline/constants.py` — model ids (`gemini-3.5-flash`, `veo-3.1-generate-preview`), duration snapping (4/6/8s).
- `pipeline/schema.py` — `TrailerBlueprint` (default 8-slot structure), `TrailerScript`, `TrailerPrompts`.
- `pipeline/script_writer.py`, `pipeline/prompt_builder.py`, `pipeline/video.py` — steps 2–4.
- `services/gemini_service.py`, `services/veo_service.py` **including their mock fixtures** (`DREAMERS_MOCK=1` runs the full flow with ffmpeg placeholder clips — free CI/dev).
- `jobs.py` JobManager pattern — thread worker, progress callback, SSE fan-out, one-job-per-project guard.

### What we deliberately drop
- **Step 1 (LoRA adapter draft)** — GPU-only, draft-quality (see `LIMITATIONS.md` L1–L7). Consumer flow goes `prompt → script` directly; Gemini handles it well.
- **Step-by-step review endpoints** (edit script / edit prompts / blueprint editing) — the consumer product is **one-shot**: prompt in, video out. (A "Pro/Studio mode" exposing those stages is a natural v2.)
- JSON-file project storage — replaced by SQL rows + artifact dir.

### One-shot orchestration (`generation_service.run(dream_id)`)
Runs in a worker thread; each stage updates `dreams.status` + `generation_jobs` and publishes an SSE event:

| Stage | dream.status | Progress band | What happens |
|---|---|---|---|
| 1 | `scripting` | 0–10% | Gemini structured script from prompt + default blueprint; store `script_json` |
| 2 | `prompting` | 10–18% | Gemini chained Veo prompts; store `prompts_json` |
| 3 | `rendering` | 18–92% | 7 Veo clips sequentially (anchor image for consistency, per-clip resume on retry); per-segment SSE events |
| 4 | `stitching` | 92–99% | ffmpeg concat + fades + composed title card |
| 5 | `completed` | 100% | set `video_path`, `duration_secs`, `completed_at`; **capture hold** |
| ✘ | `failed` | — | store `error`; **release hold**; SSE `failed` event |

**Retry economics:** the pipeline already skips existing `segment_NN.mp4` on re-run (T3 in LIMITATIONS). A failed dream gets a **"Retry"** button — retry re-holds 5 credits but reuses completed segments on disk, so our COGS on retries is low; the user experience stays simple (every attempt costs 5, every failure refunds 5).

**No termination (B5):** there is deliberately **no cancel endpoint**. The confirm modal is the point of no return. The UI hides any stop affordance; closing the tab doesn't stop the job (it completes server-side and the video is waiting in the sidebar).

**Concurrency guard:** one active generation **per user** (not just per dream) in v1 — keeps Veo spend and queue behavior predictable. `409 GENERATION_IN_PROGRESS` otherwise.

---

## 10. Backend API Surface

All routes under `/api/v1`. 🔒 = requires `Authorization: Bearer <jwt>`.

| Method | Path | Purpose | Notable responses |
|---|---|---|---|
| GET | `/health` | liveness + mock flag | — |
| GET | `/config` | pricing (`credit_cost_per_video: 5`, `usd_per_credit: 1`, `min_purchase: 5`), video spec, capabilities | drives UI copy so pricing changes don't need a frontend deploy |
| GET | 🔒 `/users/me` | profile + `credit_balance` + counts | `401` invalid token |
| GET | 🔒 `/credits/balance` | `{balance, held, videos_remaining}` | — |
| GET | 🔒 `/credits/ledger?cursor=` | paginated ledger | — |
| POST | 🔒 `/payments/checkout` | `{amount_usd}` → `{checkout_url}` | `422` bad amount |
| POST | `/payments/webhook` | Stripe events (signature-verified, **not** JWT) | `400` bad signature |
| GET | 🔒 `/payments/history` | past purchases | — |
| GET | 🔒 `/dreams?cursor=` | sidebar list (id, title, status, thumb, created_at) | — |
| POST | 🔒 `/dreams` | `{prompt}` → **create + hold 5 credits + start job** (single atomic endpoint) | `201` dream; `402 INSUFFICIENT_CREDITS`; `409 GENERATION_IN_PROGRESS` |
| GET | 🔒 `/dreams/{id}` | full dream (status, progress snapshot, video url) | `404` not yours/none |
| DELETE | 🔒 `/dreams/{id}` | delete dream + artifacts (blocked while `running`) | `409` if running |
| POST | 🔒 `/dreams/{id}/retry` | failed dream → new hold + re-run (reuses segments) | `402`/`409` as above |
| GET | 🔒 `/dreams/{id}/events` | **SSE** live progress (snapshot first, then events, `close` on terminal) | keep-alive comments every 15s |
| GET | 🔒 `/dreams/{id}/video` | stream/download `trailer.mp4` (`Content-Disposition: attachment` when `?download=1`) | supports `Range` for scrubbing |
| GET | 🔒 `/dreams/{id}/thumbnail` | poster frame (extracted at stitch time) | — |

**`POST /dreams` is the heart** — one endpoint does: validate prompt (3–2000 chars) → per-user concurrency check → atomic 5-credit hold → insert dream + job rows → spawn worker → `201` with the dream. The confirm modal on the frontend is the *only* gate before this call.

Error envelope everywhere: `{ "error": { "code": "INSUFFICIENT_CREDITS", "message": "...", "details": {...} } }`.

---

## 11. Frontend — Pages, Routes & Components

| Route | Guard | Content |
|---|---|---|
| `/` | public | Landing: Hero + **Generate / About / Catalogue / Contact** scroll sections |
| `/signin` | public | Google button, product one-liner, art panel; honors `?next=` |
| `/studio` | 🔒 | Shell (sidebar + main); empty state = big PromptComposer ("What do you dream of?") |
| `/studio/[dreamId]` | 🔒 | Dream thread: prompt bubble → progress timeline → video player + download |
| `/credits` | 🔒 | Package picker + ×$5 stepper → Stripe |
| `/credits/success` `/credits/cancelled` | 🔒 | Post-checkout states (success polls balance) |
| `/account` | 🔒 | Profile, ledger table, payment history, sign-out |

**State/data:** TanStack Query for `useUser`, `useCredits`, `useDreams` (cache invalidated by SSE terminal events and checkout success). SSE via a thin `EventSource` wrapper with exponential-backoff reconnect; on reconnect the server's snapshot event resyncs state (already supported by the JobManager pattern).

**Key components**
- `PromptComposer` — auto-growing textarea, char counter, cost line ("This will use 5 credits — you have 10"), disabled+CTA state when `balance < 5`.
- `ConfirmModal` — B5's single gate: shows the exact prompt back, "**Is this prompt final?** Generation can't be stopped once it starts and will use 5 credits." Buttons: *Edit prompt* / *Dream it* ✨.
- `GenerationProgress` — stage stepper (Scripting → Prompting → Rendering ▮▮▮▮▮▮▮ → Stitching) with per-segment tiles lighting up as SSE `segment` events land; cinematic shimmer while rendering.
- `VideoPlayer` — poster, native controls, loop; `DownloadButton` → `GET /video?download=1`.
- `Sidebar` — CreditMeter, "New dream" button, DreamList (status dot: queued/rendering pulse/completed/failed), Account footer.
- `InsufficientCredits` — inline panel replacing the composer when broke: "You need 5 credits to dream. Top up from $5."

---

## 12. Landing Page — Design Direction

**Concept: "The Dream Projector."** A night-sky, cinema-poster world: the page is a slow descent from a starfield into a dream that becomes a movie. Inspiration mapping — *northgarden.com*: scroll-narrative scenes with bold typography; *VineWinner shot*: saturated gradient color fields + product-as-hero; *paralleluniverse.com.ua*: playful cursor-reactive canvas; *Posthive shot*: cinematic poster wall for the catalogue.

**Visual language**
- **Palette:** deep space indigo `#0B0B1E` base; aurora gradients (violet `#7C3AED` → magenta `#EC4899` → amber `#F59E0B`); starlight off-white text `#F5F3FF`; film-grain overlay (~4% opacity) everywhere for texture.
- **Type:** display serif with personality (e.g. *Fraunces* or *Clash Display*) for headlines, clean grotesk (*Inter/Geist*) for UI. Huge hero type (clamp 4–9rem) with a subtle gradient fill and slow letter-spacing animation.
- **Motion rules:** Lenis smooth scroll; GSAP ScrollTrigger pinned scenes; everything respects `prefers-reduced-motion` (fall back to static art + fades). 60fps budget: canvas starfield capped at ~400 particles, `will-change` discipline, no layout thrash.

**Scroll narrative (sections = nav anchors)**
1. **Hero / Generate** (`#generate`) — full-viewport starfield canvas that parallaxes with the pointer; headline *"Dream it. Watch it."*; a live typing loop cycles sample prompts ("a lighthouse keeper who befriends a storm…") into a faux input; primary CTA **"Generate your dream →"** (→ `/studio`, via sign-in if needed). A slow 16:9 sample video plays ghosted behind the type.
2. **How it works / About** (`#about`) — pinned 3-beat scene as you scroll: *"You write a line"* (the line floats up) → *"We write the film"* (the line explodes into a script page) → *"Veo shoots it"* (script morphs into a filmstrip of 8 frames, mirroring the real 8-slot blueprint). Ends with the credit pitch: **"Your first two dreams are free."** (10 credits, 5/video, $1 = 1 credit.)
3. **Catalogue** (`#catalogue`) — a Posthive-style **poster wall**: horizontally scroll-driven marquee of generated sample videos as tilted posters; hover (or center-snap on touch) plays a muted preview; click opens a lightbox with the full one-minute video + its original prompt displayed like a film title card. 6–10 curated samples shipped as static assets in v1.
4. **Contact** (`#contact`) — aurora-gradient footer scene: contact email, minimal form (name/email/message → `POST /contact` or mailto in v1), social links, and a final CTA repeating **Generate**. Footer: terms, privacy, "1 credit = $1" pricing note.

**Nav:** fixed translucent bar (blur backdrop) — logo ✦ *Dreamers*, anchors **Generate · About · Catalogue · Contact**, right-side button = **Sign in** (or avatar + "Open studio" when authenticated). Active-section highlight synced to scroll.

---

## 13. Studio (Chat Interface) — UX Spec

```
┌────────────────────────────────────────────────────────────────────┐
│ ✦ Dreamers                                  balance ⬤ 10 cr  [👤] │
├──────────────┬─────────────────────────────────────────────────────┤
│ + New dream  │                                                     │
│              │        (dream thread — chat-like, newest at         │
│ TODAY        │         bottom, one dream per thread)               │
│ ◍ Neon koi…  │                                                     │
│ ● Storm li…  │   ┌───────────────────────────────────────────┐     │
│              │   │ YOU: "a lighthouse keeper who befriends    │     │
│ LAST WEEK    │   │       a storm, cinematic, melancholic"     │     │
│ ○ Desert w…  │   └───────────────────────────────────────────┘     │
│              │   ┌───────────────────────────────────────────┐     │
│ ────────────  │   │ DREAMERS: Scripting ✔ → Prompting ✔ →     │     │
│ USAGE        │   │ Rendering  ▮▮▮▮▮▯▯  5/7 · est 3 min       │     │
│ 10 cr        │   │ [segment tiles light up as they finish]   │     │
│ 2 videos left│   └───────────────────────────────────────────┘     │
│ [Buy credits]│   ┌───────────────────────────────────────────┐     │
│              │   │ ▶ finished video (16:9)      [⬇ Download] │     │
│ HISTORY      │   └───────────────────────────────────────────┘     │
│ view ledger →│                                                     │
├──────────────┴─────────────────────────────────────────────────────┤
│  [ What do you dream of?___________________________ ]  ( Dream ✨ )│
└────────────────────────────────────────────────────────────────────┘
```

- **Left sidebar** (as required): previous chats = `DreamList` grouped by date with status dots (● pulsing = rendering, ◍ = completed, ○ = failed); **usage** = `CreditMeter` (+ Buy credits); **history** link → `/account` ledger.
- **Thread model:** one dream = one thread (prompt bubble + progress bubble + video bubble). "New dream" resets the main pane to the empty composer. Old dreams reopen instantly with their video.
- **Composer rules:** disabled while the user has a running generation ("Your current dream is still rendering — one at a time ✦"), replaced by `InsufficientCredits` when `balance < 5`.
- **Submit path:** type → **Dream ✨** → `ConfirmModal` (single, final, per B5) → `POST /dreams` → optimistic thread creation → SSE attach.
- **Progress truthfulness:** rendering takes minutes; show stage stepper, per-segment tiles, elapsed time, and a rotating "while you wait" line (fun facts about the user's prompt genre). Never a bare spinner.
- **Completion:** confetti-free but cinematic — the video fades in with a soft "Your dream is ready" toast; browser notification if the tab was backgrounded (permission asked only after the first successful generation).
- **Failure:** apologetic bubble + "Your 5 credits were returned" (links ledger) + **Retry** button.

---

## 14. Flowcharts — Every Scenario

### 14.1 Master user journey

```mermaid
flowchart TD
    A[Visitor lands on /] --> B[Scrolls: Hero → About → Catalogue → Contact]
    B --> C{Clicks Generate / CTA}
    C -->|not signed in| D[/signin → Google OAuth/]
    C -->|signed in| G[/studio/]
    D -->|new account| E[Create user row<br/>+10 signup credits]
    D -->|existing| F[Update last_login]
    E --> G
    F --> G
    G --> H[Types prompt in composer]
    H --> I{Confirm modal:<br/>'Is this prompt final?'}
    I -->|Edit prompt| H
    I -->|Dream it ✨| J{balance ≥ 5?}
    J -->|no| K[402 → InsufficientCredits panel<br/>→ /credits top-up] --> H
    J -->|yes| L[Hold 5 credits + start job<br/>NO TERMINATION FROM HERE]
    L --> M[SSE progress: scripting → prompting →<br/>rendering 7 clips → stitching]
    M -->|success| N[Capture 5 credits<br/>video in thread]
    M -->|failure| O[Release 5 credits<br/>failure bubble + Retry]
    N --> P[▶ Play + ⬇ Download MP4]
    O --> H
    P --> Q{Dream again?}
    Q -->|balance ≥ 5| H
    Q -->|balance < 5| K
```

### 14.2 Authentication (sequence)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Next.js (Auth.js)
    participant G as Google OAuth
    participant BE as FastAPI
    participant DB as PostgreSQL

    U->>FE: click "Sign in with Google"
    FE->>G: OIDC authorization code flow
    G-->>FE: id_token (sub, email, name, picture)
    FE->>FE: sign app JWT (HS256, AUTH_SECRET)<br/>set httpOnly cookie
    FE-->>U: redirect to ?next= (default /studio)
    U->>FE: open /studio
    FE->>BE: GET /api/v1/users/me (Bearer JWT)
    BE->>BE: verify signature + exp
    BE->>DB: SELECT user by google_sub
    alt first login
        BE->>DB: INSERT user
        BE->>DB: ledger +10 'signup_bonus'<br/>(idempotency_key = signup:<uid>)
    else returning
        BE->>DB: UPDATE last_login_at
    end
    BE-->>FE: {profile, credit_balance}
    Note over FE,BE: expired/invalid JWT → 401 →<br/>frontend forces re-login, preserves ?next=
```

### 14.3 Generation lifecycle (the critical path)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Studio UI
    participant BE as FastAPI
    participant DB as PostgreSQL
    participant W as Worker thread
    participant AI as Gemini / Veo

    U->>FE: prompt + "Dream it ✨" (post-confirm-modal)
    FE->>BE: POST /dreams {prompt}
    BE->>DB: BEGIN; lock user row
    alt balance < 5
        DB-->>BE: insufficient
        BE-->>FE: 402 INSUFFICIENT_CREDITS
    else user already has a running job
        BE-->>FE: 409 GENERATION_IN_PROGRESS
    else ok
        BE->>DB: balance −5, insert hold('held'),<br/>insert dream('queued') + job; COMMIT
        BE->>W: spawn generation_service.run(dream_id)
        BE-->>FE: 201 {dream}
    end
    FE->>BE: GET /dreams/{id}/events (SSE)
    BE-->>FE: snapshot event
    W->>AI: Gemini: script  (status=scripting)
    W-->>FE: SSE progress 0.10
    W->>AI: Gemini: Veo prompts (status=prompting)
    W-->>FE: SSE progress 0.18
    loop 7 Veo segments
        W->>AI: Veo 3.1 clip (chained, anchor image)
        W-->>FE: SSE segment event (tile lights up)
    end
    W->>W: ffmpeg stitch + fades + title card (status=stitching)
    alt success
        W->>DB: dream completed, video_path set;<br/>hold captured, ledger −5
        W-->>FE: SSE {completed, video_url} + close
        FE->>BE: GET /dreams/{id}/video (▶ / ⬇)
    else any stage throws
        W->>DB: dream failed, error stored;<br/>hold released, ledger −5/+5 refund
        W-->>FE: SSE {failed, error} + close
        FE-->>U: "Credits returned" + Retry
    end
    Note over U,W: No cancel endpoint exists — closing the tab<br/>doesn't stop the job; the result waits in the sidebar.
```

### 14.4 Credit purchase (Stripe)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as /credits page
    participant BE as FastAPI
    participant ST as Stripe
    participant DB as PostgreSQL

    U->>FE: pick $25 package (or ×$5 stepper)
    FE->>BE: POST /payments/checkout {amount_usd: 25}
    BE->>BE: validate ≥5 and %5==0
    BE->>DB: INSERT payments(pending, 25, 25cr)
    BE->>ST: create Checkout Session<br/>(metadata: payment_id, credits)
    ST-->>BE: session url
    BE-->>FE: {checkout_url}
    FE->>ST: redirect — user pays on Stripe
    par webhook (source of truth)
        ST->>BE: POST /payments/webhook<br/>checkout.session.completed (signed)
        BE->>BE: verify signature
        BE->>DB: payment → succeeded;<br/>ledger +25 'purchase'<br/>(idempotency_key = purchase:<event_id>)
    and redirect (UX only)
        ST->>FE: success_url → /credits/success
        FE->>BE: poll GET /credits/balance
        BE-->>FE: updated balance → 🎉
    end
    Note over BE,DB: duplicate webhook delivery → idempotency key<br/>collision → no-op. Cancelled → /credits/cancelled,<br/>payment row later marked 'expired'.
```

### 14.5 Insufficient credits

```mermaid
flowchart TD
    A[User in studio, balance = 0–4] --> B[Composer replaced by<br/>InsufficientCredits panel]
    B --> C["'You need 5 credits to dream.<br/>Top up from $5.'"]
    C --> D[/credits page/]
    D --> E{Checkout outcome}
    E -->|paid + webhook| F[Balance updated] --> G[Back to /studio —<br/>composer unlocked]
    E -->|cancelled| H[/credits/cancelled/] --> D
    A2[Race: two tabs submit at once] --> I[DB row lock serializes holds]
    I --> J[First tab: 201, hold placed]
    I --> K[Second tab: 402 or 409 —<br/>never negative balance]
```

### 14.6 Generation failure & refund (state machine)

```mermaid
stateDiagram-v2
    [*] --> queued: POST /dreams (hold placed)
    queued --> scripting
    scripting --> prompting
    prompting --> rendering
    rendering --> stitching
    stitching --> completed: hold CAPTURED (−5 final)
    scripting --> failed: Gemini error
    prompting --> failed: Gemini error
    rendering --> failed: Veo error / quota
    stitching --> failed: ffmpeg error
    failed --> queued: user clicks Retry<br/>(new 5-cr hold; finished segments reused)
    completed --> [*]
    note right of failed
        On ANY failure: hold RELEASED,
        ledger shows −5 + +5 refund,
        user notified in-thread.
        Orphan sweep also releases holds
        for jobs dead >2h / after restart.
    end note
```

### 14.7 Landing navigation

```mermaid
flowchart LR
    NAV[Fixed nav] --> GEN[#generate — Hero]
    NAV --> AB[#about — 3-beat pinned scene]
    NAV --> CAT[#catalogue — poster wall]
    NAV --> CON[#contact — footer scene]
    GEN -->|CTA| AUTH{signed in?}
    CAT -->|poster click| LB[Lightbox: sample video + prompt]
    LB -->|"'Dream your own'"| AUTH
    AUTH -->|yes| ST[/studio/]
    AUTH -->|no| SI[/signin?next=/studio/] --> ST
    CON -->|form submit| MSG[contact message stored / mailto]
```

---

## 15. Error Handling, Edge Cases & Security

### Edge-case ledger (each has a test)

| # | Scenario | Behavior |
|---|---|---|
| E1 | Double-click "Dream it" / two tabs | Row-level lock + per-user running-job guard → exactly one hold; second gets `409`. Frontend also disables the button on first click. |
| E2 | Server crashes mid-generation | Startup sweep: `running` jobs → `failed`, holds released. User sees failed bubble + refund on next visit. |
| E3 | Webhook arrives twice / out of order | `idempotency_key = purchase:<event_id>` unique constraint → second write no-ops. |
| E4 | User pays, closes browser before redirect | Webhook still credits (redirect is UX-only). Balance correct on next login. |
| E5 | Success redirect forged (no payment) | No crediting on redirect path at all; page just polls the (unchanged) balance. |
| E6 | JWT expires mid-session | API `401` → frontend silent re-auth via Auth.js; SSE reconnects with fresh token. |
| E7 | SSE connection drops during render | `EventSource` auto-reconnect → server sends snapshot event first → UI resyncs. Polling `GET /dreams/{id}` as belt-and-braces every 20s. |
| E8 | User deletes a dream while rendering | Blocked (`409`) — no cancel semantics per B5. Deletable once terminal. |
| E9 | Veo quota exhausted / regional block | Stage error surfaces as failure → refund; error copy distinguishes "our capacity" from "prompt rejected". |
| E10 | Prompt violates Gemini/Veo safety filters | Pipeline error → failure → refund; UI shows "This prompt couldn't be filmed — try rephrasing" (no retry of identical prompt encouraged). |
| E11 | Balance 1–4 credits (post two free runs edge) | Composer locked (B3); top-up of $5 makes them whole. |
| E12 | Clock skew / long-idle tab | All state refetched on window focus (TanStack Query `refetchOnWindowFocus`). |

### Security checklist
- **Payments:** Stripe webhook signature verification; amounts validated server-side; no client-supplied credit counts anywhere.
- **Auth:** httpOnly/Secure/SameSite cookies; JWT HS256 with strong `AUTH_SECRET`; 7-day expiry; backend never trusts client-sent user ids — identity always from the verified token.
- **Authorization:** every dream/payment/ledger query is scoped `WHERE user_id = current_user.id`; 404 (not 403) on foreign resources to avoid enumeration.
- **Input:** prompt length 3–2000 chars, stripped; Pydantic validation on every body; SQL only via ORM parameters.
- **Rate limiting:** `POST /dreams` (5/min/user), `POST /payments/checkout` (10/min/user), auth endpoints (SlowAPI middleware).
- **Transport/headers:** HTTPS-only in prod, CORS locked to the frontend origin, standard security headers via middleware; API keys (Gemini, Stripe) server-side env only — never shipped to the client.
- **Video access:** `/dreams/{id}/video` requires the owner's JWT (no public unauthenticated artifact URLs in v1).

---

## 16. Environment Variables

```ini
# ---- frontend/.env.local ----
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=<openssl rand -base64 32>        # SHARED with backend
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_API_URL=http://localhost:8000

# ---- backend/.env ----
AUTH_SECRET=<same as frontend>               # JWT verification
DATABASE_URL=postgresql+psycopg://dreamers:***@localhost:5432/dreamers
                                             # dev fallback: sqlite:///./data/dreamers.db
GEMINI_API_KEY=...                           # steps 2–4
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DREAMERS_MOCK=0                              # 1 = free stubbed pipeline (dev/CI)
DREAMERS_DATA_DIR=./data
DREAMERS_CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000           # Stripe success/cancel redirects
SIGNUP_BONUS_CREDITS=10
CREDITS_PER_VIDEO=5
USD_PER_CREDIT=1
MIN_PURCHASE_USD=5
```

---

## 17. Testing Strategy

**Backend (pytest, runs entirely in `DREAMERS_MOCK=1` + SQLite — zero API cost):**
- *Auth:* JWT verify/expiry/tamper; first-login bonus exactly once (replay the login).
- *Credits:* hold/capture/release invariants; concurrent-hold race (threaded); balance never negative; ledger sums equal balance (property test).
- *Dreams:* full happy path to `completed` with mock pipeline (real ffmpeg placeholder clips); failure injection at each stage → refund asserted; 402/409 guards; SSE snapshot + live stream; video download with Range.
- *Payments:* checkout amount validation ($4, $7, $0 rejected); webhook signature rejection; duplicate event idempotency; expired session.
- *Sweep:* orphaned hold released after simulated crash.

**Frontend:** Vitest + React Testing Library for ConfirmModal (single confirmation, B5), CreditMeter math, composer lock states; **Playwright** e2e against the mock backend: landing scroll/nav anchors, sign-in redirect, full generate→download flow, buy-credits flow (Stripe test mode), broke-user flow.

**CI:** lint + typecheck + unit both sides; e2e on PR; `openapi.json` → generated types drift check.

---

## 18. Deployment Plan

**v1 (portfolio-grade, single box or two services):**
- **Frontend:** Vercel (native Next.js) — or the same VM behind nginx.
- **Backend:** one VM/container (Railway/Render/Fly/EC2): uvicorn + FastAPI, worker threads in-process, `data/` on a persistent volume. ffmpeg installed in the image (or rely on `imageio-ffmpeg` wheel, as dreamers-ai does).
- **DB:** managed Postgres (Neon/Supabase/RDS).
- **Stripe:** test mode until launch; webhook endpoint registered per environment (use `stripe listen` locally).
- `docker-compose.yml` for local: `postgres`, `backend` (mock mode default), `frontend`.

**Scale path (documented, not built):** move JobManager to Redis + arq workers; artifacts to S3/GCS with signed URLs; SSE via Redis pub/sub; per-user queue → global queue with fairness.

---

## 19. Build Milestones

| # | Milestone | Scope | Exit criteria |
|---|---|---|---|
| M1 | **Skeleton + DB** | repo split, FastAPI app, SQLAlchemy models, Alembic, docker-compose, `/health` `/config` | migrations apply; CI green |
| M2 | **Auth** | Auth.js + Google, JWT bridge, user upsert, +10 bonus, route guards | sign in → `/users/me` shows 10 credits; bonus idempotent |
| M3 | **Pipeline vendored** | copy `pipeline/` + mock services, `generation_service`, JobManager, dreams CRUD + SSE + video serving | mock dream completes end-to-end; mp4 downloads |
| M4 | **Credits wired** | hold/capture/release in the dream flow, ledger, guards (402/409), orphan sweep | all credit tests green; two free runs then locked |
| M5 | **Studio UI** | sidebar, composer, confirm modal, progress via SSE, player + download, broke state | full flow in browser against mock backend |
| M6 | **Payments** | checkout, webhook, packages UI, success/cancel pages, account ledger | Stripe test-mode purchase credits the balance via webhook |
| M7 | **Landing page** | starfield hero, pinned About scene, catalogue poster wall, contact, nav, reduced-motion | Lighthouse ≥90 perf/a11y; anchors + CTA flow work |
| M8 | **Live hardening** | real Gemini/Veo run, rate limits, error copy, retry flow, deploy, Stripe live keys | one real prompt → downloadable ~60s video in prod |

---

*Plan owner: dreamers-website. Generation backbone: `../dreamers-ai/backend` (validated 2026-06-27, see its `LIMITATIONS.md`). This document is the context anchor for all implementation work — keep it updated as decisions change.*
