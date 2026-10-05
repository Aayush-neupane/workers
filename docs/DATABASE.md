# Database — Sajilo Damak

- `backend/src/db/schema.sql` — all tables, idempotent (`IF NOT EXISTS`).
  Money in BIGINT paisa. App routes never delete financial rows
  (`payments`, `refunds`, `commission_ledger`, `settlements`,
  `reward_ledger` are insert-only in practice). Exception: the **local-only
  dev tools** `backend/wipe-demo.ts` and `backend/cleanup-users.ts` DO
  delete (in one transaction, demo/staff-scoped, production refused) —
  never run them against real data.
- `backend/src/db/migrations/NNN_*.sql` — ordered changes, each applied
  once (ledgered in `schema_migrations`, one transaction per file) by
  `npm --workspace backend run db:migrate`. Migration files must stay
  idempotent (`IF NOT EXISTS` / `ON CONFLICT`).
- `backend/src/db/seed.ts` — roles + admin capabilities, platform settings,
  wards are seeded by schema, 6 categories + 9 starter services (services
  keyed by stable `slug`, categories reconciled on re-run — fully
  re-runnable). Re-seeding never resets the admin password (upsert touches
  name/phone only). Default admin `admin@sajilo.local` / `ChangeMe123!` —
  rotate immediately.
- `backend/src/db/seed-demo.ts` — local demo accounts (`Demo1234!`),
  idempotent via the `gita@demo.local` guard; wrap-around duplicate risk on
  partial failure is documented in-file.
- Key constraints: `payments.provider_ref UNIQUE` (idempotent callbacks),
  `commission_ledger.booking_id UNIQUE` (one snapshot per job),
  `uq_reward_earn_booking` (no double-earn), `cash_collections.booking_id UNIQUE`,
  `uq_services_slug` (seed idempotency), `uq_quote_proposal_worker` (one
  proposal per pro per request).
- `commission_rules` is reserved for future scope-based rates — written by
  the admin API but not yet consulted at booking time (category snapshot
  rate applies).
- Coverage config lives in data (`coverage_wards`, `settings.platform`),
  never in code — new towns = new rows + admin toggle.
