# Architecture — Sajilo Damak

## Stack (established, VPS-friendly for Nepal)

- **Frontend:** React 19 + TypeScript + Vite + Tailwind v4 + React Router +
  React Hook Form + Zod + Lucide. One build serves all four portals.
- **Backend:** Express + TypeScript + Zod + `pg` + jose (HS256 JWT in
  `HttpOnly` cookie, `SameSite`/`Domain` env-driven, `Secure` when
  cross-site/prod) + bcryptjs. Sessions carry a version bound to
  `users.password_changed_at` — password resets kill old tokens.
- **Database:** PostgreSQL 16. `schema.sql` + numbered `migrations/*.sql`,
  applied once each by `db:migrate` (ledgered in `schema_migrations`, each
  file in its own transaction). Money in BIGINT paisa. App routes never
  delete financial rows (`wipe-demo`/`cleanup-users` are destructive
  local-only tools — see DATABASE.md).
- **Why not Supabase:** self-hosted Postgres keeps per-order costs at Rs 0
  and works on a $6 VPS (pattern proven by the online-department project).
  The API is API-first so a future Android app (React Native / Expo)
  reuses the same contracts without duplicating business logic.

## Subdomain strategy

- Prod hosts: `www.` (public), `clients.` (customers), `pros.` (pros),
  `admin.` (staff). Hosts come from env (`APP_URL`, `VITE_APEX_DOMAIN`,
  `ADDITIONAL_ORIGINS`); no prod domain is hardcoded in routing code.
- Local dev: path routing on `localhost:5173` (`/`, `/dashboard`,
  `/worker`, `/admin`). (The old `lib/host.ts` portal helper was removed;
  portal homes live in `lib/auth.tsx:homeFor`.)
- Auth cookies default to **host-only lax**; split-domain deploys set
  `COOKIE_SAMESITE=none` + `COOKIE_DOMAIN=.example.com`. Each portal
  re-validates session + role against `/api/auth/me` — a session on one
  subdomain grants nothing on another without backend authorization.
- `admin.*` sends `X-Robots-Tag: noindex` and has no public links.

## Permission model

Roles: `CUSTOMER`, `WORKER`, `ADMIN` (= super-admin, bypasses permission
checks), `SUB_ADMIN` (= staff base role with zero implicit access).
Capabilities come from `role_permissions` **plus** per-user
`user_permissions`, read via `effectivePermissions()` and enforced by
`requirePermission` / `requireAnyPermission`. Staff-only routes additionally
require `requireSuperAdmin` (only `ADMIN` — `staff.manage` is reserved and
ungrantable). All 30 permissions are seeded; `SUB_ADMIN` gets none by
default. Least privilege everywhere; sensitive actions (verify, suspend,
refund, settle, commission change, staff changes, status corrections) write
`audit_log`.

## Business workflows

- **Pro onboarding (two doors, one gate):** (a) email invite for new people —
  token link → account → documents → `under-review` → `verified` → activated;
  (b) office flow for existing customers — they sign up normally, submit
  certificates physically, admin verifies and sends the invite *to their
  profile* (`POST /api/admin/workers/invite-user`), they accept in-app from
  their dashboard (`POST /api/worker/invites/:id/accept`) and land in the pro
  portal. Only `verified + active` pros match assignments either way.
- **Direct booking:** service → Damak address (server-gated) → slot →
  review → pay (cash now, eSewa/Khalti when configured) → assign →
  `pending → awaiting-worker → confirmed → en-route → in-progress →
  awaiting-confirmation → completed` (+ `cancelled`/`disputed`).
- **Quote (Mode B):** request + photos → routed to eligible verified pros
  (address masked) → proposals (admin approval if policy requires) →
  customer accepts → booking created `confirmed` with worker assigned.
- **Completion OTP:** when work ends, server issues a 6-digit code to the
  customer (10-min TTL, 5 attempts, HMAC-SHA256 at rest, 60s re-issue gap,
  row-locked attempts). The pro submits it; only a correct code completes
  the job, posts commission + rewards + milestones.
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

In-app today (`notifications` table) is the guaranteed channel; web-push
(`services/push.ts` + `/api/push/*`, VAPID when configured) is best-effort
and operational. SMS is still TODO. Dispatch alerts also fan out to
`SUB_ADMIN` holders of `bookings.assign` / `quotes.view`.
