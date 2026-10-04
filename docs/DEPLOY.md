# Deploy — Sajilo Damak

## Frontend (Netlify)

1. New site from this repo, base directory `frontend`, build `npm run build`, publish `dist`.
2. Env: `VITE_API_URL=https://api.sajilodamak.com`, `VITE_APEX_DOMAIN=sajilodamak.com`.
3. Custom domains — one site, four aliases (single build, host-routed):
   `www.sajilodamak.com`, `clients.sajilodamak.com`, `pros.sajilodamak.com`, `admin.sajilodamak.com`.
4. Netlify provisions TLS per alias automatically. Verify each hostname loads and
   role-redirects correctly (customer → clients, pro → pros, admin → admin).
5. `admin.*` is excluded from search via `X-Robots-Tag` (API) + no public links;
   add a `robots.txt` disallow if a crawler probes it.

Local alternative: `npm --prefix frontend run dev` (path routing, same build).

## Backend (VPS: Nginx + PM2 + Postgres 16)

```bash
# on the VPS
git pull && npm --workspace backend install
npm --workspace backend run db:migrate   # schema + numbered migrations, idempotent
pm2 restart sajilo-api
```

- Nginx: `api.sajilodamak.com → 127.0.0.1:4001`, TLS via certbot.
- `DATABASE_URL` points at the VPS Postgres; `AUTH_SECRET` 32+ random chars.
- CORS allows exactly `APP_URL` (+ portal aliases when live).
- Backups: nightly `pg_dump` + off-site copy; document restore before launch.

## Payments & notifications

- eSewa/Khalti: fill `ESEWA_*` / `KHALTI_*` from merchant onboarding, test the
  sandbox initiate → callback → verify path end to end before claiming live.
- SMS/push attach at `services/notify.ts` — do not claim they work until tested.
