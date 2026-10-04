# Database — Sajilo Damak

- `backend/src/db/schema.sql` — all tables, idempotent (`IF NOT EXISTS`).
  Money in BIGINT paisa. Financial tables (`payments`, `refunds`,
  `commission_ledger`, `settlements`, `reward_ledger`) are insert-only in
  practice: the app never deletes them.
- `backend/src/db/migrations/NNN_*.sql` — ordered, idempotent changes.
  Applied after `schema.sql` by `npm --workspace backend run db:migrate`.
- `backend/src/db/seed.ts` — roles + admin capabilities, platform settings,
  wards are seeded by schema, 6 categories + 9 starter services.
  Re-runnable (`ON CONFLICT DO NOTHING` / upserts). Default admin
  `admin@sajilo.local` / `ChangeMe123!` — rotate immediately.
- Key constraints: `payments.provider_ref UNIQUE` (idempotent callbacks),
  `commission_ledger.booking_id UNIQUE` (one snapshot per job),
  `uq_reward_earn_booking` (no double-earn), `cash_collections.booking_id UNIQUE`.
- Coverage config lives in data (`coverage_wards`, `settings.platform`),
  never in code — new towns = new rows + admin toggle.
