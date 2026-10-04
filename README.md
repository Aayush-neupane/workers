# Sajilo Damak — "Ramro Sewa, Sajilo Jeevan."

Damak-only, on-demand service marketplace for **Damak Municipality, Jhapa, Nepal**.
Customers book verified local pros; pros get assigned work; admins run the operation.

## Layout

```
./
  frontend/   # React + Vite + TS + Tailwind — 4 portals, one build
  backend/    # Express + TS + Zod + pg — API-first (Android-ready later)
  docs/       # architecture, database, deploy
```

## Portals (one build, host-routed)

| Host (prod)            | Portal | Home route |
|------------------------|--------|------------|
| `www.sajilodamak.com`  | Public marketing + discovery | `/` |
| `clients.sajilodamak.com` | Customer accounts, bookings | `/dashboard` |
| `pros.sajilodamak.com` | Professional jobs + earnings | `/worker` |
| `admin.sajilodamak.com` | Operations control center | `/admin` |

Local dev uses path routing (`/dashboard`, `/worker`, `/admin`) on one port —
`frontend/src/lib/host.ts` detects the subdomain when deployed and redirects
by role. Role enforcement always happens server-side; the host split is UX.

## Quick start

```bash
# 1. Database (local Postgres 16)
createdb sajilo
npm --prefix backend run db:migrate   # schema + migrations
npm --prefix backend run db:seed       # roles, settings, catalog, admin
npm --prefix backend run db:seed-demo  # demo customers, pros, bookings, quotes (local only)

# 2. Backend (new terminal)
cp .env.example backend/.env   # then edit secrets
npm --prefix backend install
npm --prefix backend run dev    # :4001

# 3. Frontend (new terminal)
npm --prefix frontend install
npm --prefix frontend run dev   # :5173
```

Seed login (change immediately): `admin@sajilo.local` / `ChangeMe123!`

## Core rules (non-negotiable)

1. **Damak only.** Every address and booking is validated server-side against
   the Damak Municipality boundary (wards 1–10, admin-togglable). Browser
   coordinates are never trusted alone.
2. **No self-serve pros.** Workers enter only via admin invite → documents →
   verification → activation. `verified + active` pros receive assignments.
3. **Money in integer paisa**, commission snapshotted per booking, immutable
   reward/audit ledgers, idempotent payment callbacks.
4. **Completion OTP.** A short-lived code issued to the customer closes the
   job — never auto-complete on customer satisfaction claims.
5. **Two booking modes.** Direct booking (fixed services) + quote requests
   (complex jobs → proposals → customer picks → booking).

See `docs/ARCHITECTURE.md` for the full design.
