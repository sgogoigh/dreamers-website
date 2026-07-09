# Dreamers Frontend

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 + Motion + Auth.js v5.
Dark-only, "last sunset" palette built from the reference art in `../images/`
(deep plum night sky → royal purple → magenta → amber horizon). See
[`../PLAN.md`](../PLAN.md) for the full product plan and `TODO.md` for the build checklist.

## Quick start

```powershell
cd frontend
npm install
copy .env.local.example .env.local      # then edit — see below

# backend must be running (mock mode is fine):
#   cd ../backend ; .\run.ps1 -Mock

npm run dev                              # http://localhost:3000
```

### Environment (`.env.local`)

| Var | Meaning |
|---|---|
| `AUTH_SECRET` | **Must equal the backend's `AUTH_SECRET`** — it signs the HS256 `apiToken` the FastAPI backend verifies |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client (redirect URI `http://localhost:3000/api/auth/callback/google`) |
| `AUTH_DEV_LOGIN=1` | Adds a local "Dev login" button — full product works with zero Google setup. Never in production. |
| `NEXT_PUBLIC_API_URL` | The FastAPI backend origin (default `http://localhost:8000`) |

## What's inside

- **Landing (`/`)** — full-page section engine (wheel/swipe/keys = one COMPLETE
  transition per gesture, tabs jump directly): Generate hero (reference art +
  starfield canvas + typing loop), About (3-step reveal + pricing strip),
  Catalogue (counter-scrolling poster marquees + lightbox), Contact (validated
  form + footer). Sleek gradient scrollbar, grain, aurora orbs, reduced-motion safe.
- **Studio (`/studio`)** — sidebar (session history grouped by day, credit meter
  ring, avatar-initial menu → profile/sign-out) + chat pane on a lighter warm hue.
  New dream: the logo pops up with the chat bar centered; on generate they
  collapse to the top (shared layout animation) and the SSE-driven progress
  (stage stepper + per-shot tiles) takes over → video player + Download. The
  confirm modal is the single point of no return (no cancel exists).
- **Account (`/account`)** — profile header (initial avatar, name, email), stat
  cards (credits left / videos / total spent), usage & cost SVG line chart
  (single axis in credits, $1 = 1 credit; palette CVD-validated for the dark
  surface), previously generated videos grid with per-item download, activity feed.
- **Credits (`/credits`)** — $5/$10/$25/$50 packages + ±$5 custom stepper →
  Stripe checkout; success page polls the balance (webhook is the source of truth).

## Auth bridge

Auth.js (Google or dev-login) issues the session; the `session` callback mints a
separate **HS256 `apiToken`** (jose) with the shared `AUTH_SECRET` carrying
`{sub, email, name, picture}` — exactly what the backend verifies. SSE and
`<video>` tags can't send headers, so artifact URLs carry `?token=`.

## Tests

```powershell
npm test        # vitest — 87 tests across 14 suites
npm run build   # type-check + production build
```

Covers: fullpage navigation lock/clamp/gestures + inner-scroll escape hatch,
typing loop, API client (bearer injection, error envelope, token URLs), JWT
bridge round-trip, chart transforms + rendered chart, composer states, confirm
modal single-fire, credit meter, dream-list grouping, avatar menu, steppers &
packages, contact validation.
