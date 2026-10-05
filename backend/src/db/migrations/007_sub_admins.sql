-- 007: sub-admins — staff with partial access, managed only by super-admins.
-- Model:
--   ADMIN     = super-admin (full access, manages staff)
--   SUB_ADMIN = staff base role (no implicit access; capabilities come from
--               per-user grants in user_permissions + any SUB_ADMIN role grants)
-- Only users with the ADMIN role (or staff.manage) can create/manage sub-admins.

INSERT INTO roles(name) VALUES ('SUB_ADMIN') ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- Granular capabilities. Legacy perms (worker.*, catalog.edit, …) stay valid.
INSERT INTO permissions(name) VALUES
  ('staff.manage'),
  ('overview.view'),
  ('bookings.view'),
  ('bookings.assign'),
  ('customers.view'),
  ('customers.manage'),
  ('quotes.view'),
  ('finance.view'),
  ('reviews.view'),
  ('reviews.moderate'),
  ('broadcast.send'),
  ('reports.view'),
  ('rewards.view'),
  ('settings.view'),
  ('catalog.view'),
  ('workers.view')
ON CONFLICT (name) DO NOTHING;

-- Super-admins hold every permission, present and future-proofed here.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;
