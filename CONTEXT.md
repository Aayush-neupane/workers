# CONTEXT — Sajilo Damak (new-session handoff)

Read this first in any new session. Local-dev only; no production exists yet.

## What it is
On-demand service marketplace for **Damak Municipality, Jhapa, Nepal** ("Ramro Sewa,
Sajilo Jeevan"). Customers book verified local pros; pros get assigned work; admins run
the operation. React 19 + Vite + Tailwind v4 frontend; Express + TS + Zod + `pg` backend;
PostgreSQL 16. API-first (Android-ready later).

## Layout & ports
- `frontend/` — one build, path-routed portals (`/dashboard`, `/worker`, `/admin`). Dev `:5173` (vite `host:true`).
- `backend/` — API on `:4001`. Scripts: `dev` (tsx watch), `build` (tsc emit → `dist/`), `typecheck`, `test` (`tsx --test src/utils/*.test.ts`), `db:migrate`, `db:seed`, `db:seed-demo`, `db:wipe-demo`, `db:cleanup-users -- [--yes] [--include-staff] <emails>`, plus `scripts/simulate.mjs` (106-scenario suite: `node scripts/simulate.mjs`) and `scripts/backup.sh`.
- `docs/` — ARCHITECTURE.md, DATABASE.md, DEPLOY.md (all current; update them with behavior changes).
- Root `package.json` workspaces; run everything via `npm --workspace <backend|frontend> run <script>`.

## Databases (LOCAL MAC — fragile, know this)
- **sajilo cluster**: data dir `~/.sajilo-pgdata`, port **5432**, role/db `sajilo` / `sajilo_dev`. Binaries live at `/private/var/tmp/pg/postgresql@16/16.15/bin/` (no brew/docker). Start: `pg_ctl -D ~/.sajilo-pgdata -l /tmp/pg-sajilo.log -o "-p 5432 -k /tmp -c listen_addresses=127.0.0.1" start`. If ECONNREFUSED, the cluster is down — start it, data persists.
- **workers cluster** (different project): `~/.workers-pgdata`, port **5433**. Leave alone.
- If the sajilo data dir is ever truly gone: initdb fresh → create role/db → `db:migrate` → `db:seed` → `db:seed-demo`.
- Migrations ledgered in `schema_migrations` (latest: `009_perf_antifraud.sql`); seed is re-runnable (services keyed by `slug`); re-seed never resets the admin password.

## Auth & roles (do not regress)
- Cookie JWT HS256 (`sajilo_session`, HttpOnly), 7-day TTL, **versioned** against `users.password_changed_at` (ms precision; password resets + `POST /api/auth/logout-all` kill all sessions; pre-feature tokens without version still honored).
- Roles: `ADMIN` = super-admin (bypasses permission checks), `SUB_ADMIN` = staff with ZERO implicit access (grants via `user_permissions`), `CUSTOMER`, `WORKER`. Frontend maps ADMIN+SUB_ADMIN → `admin` portal; tabs gated by `TAB_PERMS`.
- `staff.manage` is reserved/ungrantable; staff routes use `requireSuperAdmin`. `worker.assign`/`rewards.edit` are accepted alongside `bookings.assign`/`settings.edit` where noted in code.
- Login has dummy-bcrypt compare (no enumeration), tight rate limits, failed attempts audited. CSRF: mutations require `Content-Type: application/json` (frontend always sends it, even bodyless DELETEs).

## Non-negotiable business rules
1. **Damak only** — server-gated (wards 1–10, `utils/coverage.ts` allowlists; reports grouped in Asia/Kathmandu).
2. **No self-serve pros/workers** — pros enter ONLY via admin invite to an existing customer (`POST /api/admin/workers/invite-user` → in-app dashboard accept). No email invite links (removed). No public worker signup.
3. **Customer-only ordering** (`requireCustomerOrder`): ADMIN/SUB_ADMIN/WORKER get 403 on `POST /bookings`, `POST /quotes/requests`, quote accept (owner-only). Book + QuoteNew pages show a notice for non-customers.
4. **Completion OTP**: 6-digit, 10-min TTL, 5 row-locked attempts, 60s re-issue gap, HMAC-SHA256 at rest. Dispatcher sub-admins (`bookings.assign`) may issue/verify.
5. **Money in integer paisa**: commission snapshotted per booking; completion pays `estimate − discount`; dispute-completion capped at 2× estimate + audited. Settlements are FIFO against owed, never over. Refunds check remaining balance; earn reversed once, redeemed points returned on cancel/full-refund. Redeem is row-locked with the booking linked. Milestones/referrals/bonuses are race-safe (claim-once updates, one-bonus-per-booking index, snapshotted referral payout, per-code cap default 10).
6. Assignment only to verified + active pros skilled in the service (`GET /api/bookings/:id/eligible-workers` powers the dropdown); never on terminal states; activation requires verified + ≥1 skill; restrict/suspend flows are customer/pro-scoped (staff can't suspend staff).
7. Quote accept is claim-once (parallel accepts → one 201, one 409); stale windows rejected; no self-approval; one proposal per pro (409).

## What changed recently (all on main, pushed)
Sub-admin system + staff CRUD UI → public-signup fix (isolated RHF forms) → full security audit fixes (takeover chain, settlements, refunds, settings whitelist, OTP/PKI hardening, cookies/CORS/HSTS env) → UX trim (grouped admin tabs, 3-step onboarding, booking progress, dashboard declutter) → pro-invite simplification (dashboard-only) → verification-physical (no digital doc upload; drawer shows live file + pre-ticked skills) → 106-scenario sim suite → deep nook sweeps (frontend races/validation + backend TZ/redeem/indexes/antifraud) → CSP/`_headers`, push allowlist, failed-login audit, logout-all, backup script, graceful shutdown.

## Test accounts (local seed)
- Admin `admin@sajilo.local` / `ChangeMe123!` (super-admin)
- Demos (all `Demo1234!`): `gita@demo.local`, `ram@demo.local` (customers); `bijay@demo.local` (verified electrician), `sita@demo.local` (verified plumber/cleaner), `hari@demo.local` (under-review)
- Demo bookings BK-2001..BK-2006; demo quote with approved proposal.

## Session gotchas
- tsx watch can serve stale code after big edits — `touch backend/src/index.ts` or restart the backend terminal if behavior doesn't match the files.
- Auth rate limits (login 20/min) bite during rapid curl testing — wait 60s on 429s.
- Frontend dev runs with `host:true`; Brave/Chrome localhost quirks were fixed by this.
- User conventions: **push to GitHub after every task** (remote `origin`, repo `Aayush-neupane/workers.git`, branch `main`); recent messages were one word — confirm before reusing that style; identity `Aayush-neupane <theghostoftheuchiha38@gmail.com>` already configured. No README.md at root (deleted on request).
- Never run `wipe-demo`/`cleanup-users` against anything but local; both refuse production.

## Known follow-ups (not done)
Email verification, per-account login lockout, broadcast per-day caps, dark mode (light-only), `commission_rules` wiring (table+route exist, unused at booking time), SMS notifications, Netlify `VITE_API_URL` must be set at build time (fail-fast otherwise).
