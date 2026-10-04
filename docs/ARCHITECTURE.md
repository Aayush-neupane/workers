# Architecture — Sajilo Damak

## Stack (established, VPS-friendly for Nepal)

- **Frontend:** React 19 + TypeScript + Vite + Tailwind v4 + React Router +
  React Hook Form + Zod + Lucide. One build serves all four portals.
- **Backend:** Express + TypeScript + Zod + `pg` + jose (HS256 JWT in
  `HttpOnly, SameSite=Lax, Secure-in-prod` cookie) + bcryptjs.
- **Database:** PostgreSQL 16. `schema.sql` (idempotent) + numbered
  `migrations/*.sql`, applied in order by `db:migrate`. Money in BIGINT
  paisa. Financial rows are never deleted.
- **Why not Supabase:** self-hosted Postgres keeps per-order costs at Rs 0
  and works on a $6 VPS (pattern proven by the online-department project).
  The API is API-first so a future Android app (React Native / Expo)
  reuses the same contracts without duplicating business logic.

## Subdomain strategy

- Prod hosts: `www.` (public), `clients.` (customers), `pros.` (pros),
  `admin.` (staff). No prod domain is hardcoded — hosts come from env
  (`APP_URL`, `VITE_*_HOST`) and `frontend/src/lib/host.ts`.
- Local dev: path routing on `localhost:5173` (`/`, `/dashboard`,
  `/worker`, `/admin`). `host.ts` detects a portal subdomain when present
  and redirects authenticated users to their portal home.
- Auth cookies are **host-only** (no wildcard `Domain=`). Each portal
  re-validates session + role against `/api/auth/me` — a session on one
  subdomain grants nothing on another without backend authorization.
- `admin.*` sends `X-Robots-Tag: noindex` and has no public links.

## Permission model

Roles: `CUSTOMER`, `WORKER`, `ADMIN` (users ↔ user_roles ↔ roles).
Admin capabilities are permission rows (`worker.verify`, `finance.settle`,
`catalog.edit`, `support.reply`, …) checked by `requireRole` /
`requirePermission`. Least privilege everywhere; sensitive actions
(verify, suspend, refund, settle, commission change) write `audit_log`.

## Business workflows

- **Pro onboarding:** admin invite (token) → account → documents →
  `under-review` → `verified` → activated. Only `verified + active` pros
  match assignments.
- **Direct booking:** service → Damak address (server-gated) → slot →
  review → pay (cash now, eSewa/Khalti when configured) → assign →
  `pending → awaiting-worker → confirmed → en-route → in-progress →
  awaiting-confirmation → completed` (+ `cancelled`/`disputed`).
- **Quote (Mode B):** request + photos → routed to eligible verified pros
  (address masked) → proposals (admin approval if policy requires) →
  customer accepts → booking created `confirmed` with worker assigned.
- **Completion OTP:** when work ends, server issues a 6-digit code to the
  customer (10-min TTL, 5 attempts, sha256 at rest). The pro submits it;
  only a correct code completes the job, posts commission + rewards.
- **Cash:** worker-collected cash tracked against commission owed; admin
  settles via `payout`/`collection` records. Nothing is silently deducted.
- **Rewards:** ledger (`earn`/`redeem`/`reverse`/`bonus`), one `earn` per
  booking (unique index), configurable rates in `settings(platform)`.

## Coverage

`coverage_wards(ward 1–10, is_open)` + `utils/coverage.ts` (normalize →
isDamak → ward parse → openness). Addresses and bookings are gated in both
`account.routes` and `bookings.routes`. New towns later = new zone rows +
admin toggle — no booking-logic rewrite. Precise GPS is never required;
landmarks + ward are enough.

## Notifications

In-app today (`notifications` table, preferences per user). Web-push and SMS
can attach later: `services/notify.ts` is the single send point.
No external channel is claimed operational until configured.
