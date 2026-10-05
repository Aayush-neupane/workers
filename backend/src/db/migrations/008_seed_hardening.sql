-- 008: seed idempotency, session versioning, proposal dedupe, dead-grant cleanup.
-- All statements idempotent (safe to re-run).

-- Stable slug for services so db:seed is re-runnable (was: duplicates on
-- every run). Admin-created services may leave it NULL; seeds always set it.
-- Backfill uses the exact scheme db:seed uses (category-slug + slugified
-- name) so already-seeded rows converge instead of duplicating.
ALTER TABLE services ADD COLUMN IF NOT EXISTS slug TEXT;
UPDATE services s
SET slug = c.slug || '-' || trim(both '-' from lower(regexp_replace(s.name, '[^a-z0-9]+', '-', 'gi')))
FROM categories c WHERE c.id = s.category_id AND s.slug IS NULL;
UPDATE services
SET slug = 'service-' || left(id::text, 8)
WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_services_slug ON services(slug);

-- One proposal per pro per request (spam guard; NULL worker rows unaffected).
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_proposal_worker
  ON quote_proposals(request_id, worker_user_id);

-- Session version: bumped on password (re)set so stolen/old JWTs die.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- WORKER role never needed support.reply/audit.read (admin router excludes
-- WORKER entirely) — remove the misleading grants.
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'WORKER')
  AND permission_id IN (SELECT id FROM permissions WHERE name IN ('support.reply', 'audit.read'));

-- Applied-migration ledger (migrate.ts records here; skips on re-run).
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
