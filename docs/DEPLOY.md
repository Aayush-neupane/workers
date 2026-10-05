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
  The server refuses to start misconfigured: missing `DATABASE_URL` throws;
  add a prod guard before launch that rejects dev/placeholder secrets.
- CORS allows `APP_URL` plus `ADDITIONAL_ORIGINS` (comma-separated portal
  aliases, e.g. `https://clients.sajilodamak.com,https://pros.sajilodamak.com,https://admin.sajilodamak.com`).
- Same-domain frontend+API keeps default cookies; split domains need
  `COOKIE_SAMESITE=none` + `COOKIE_DOMAIN=.sajilodamak.com` (+ `TRUST_PROXY`
  matching your proxy hops).
- Backups: nightly `pg_dump` + off-site copy; document restore before launch.
  (No backup script ships yet — add `backend/scripts/backup.sh` + cron.)

## Payments & notifications

- eSewa/Khalti: fill `ESEWA_*` / `KHALTI_*` from merchant onboarding, test the
  sandbox initiate → callback → verify path end to end before claiming live.
  Callbacks only transition payments whose refs this server issued, and live
  traffic additionally needs server-to-server verification with the merchant
  secret (marked TODO in `payments.routes.ts`).
- Web-push is operational when VAPID keys are configured; SMS is still TODO
  (attaches at `services/notify.ts`).
