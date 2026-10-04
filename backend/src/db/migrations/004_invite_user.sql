-- 004: invites can target an existing user profile (in-app acceptance),
-- not just an email address (link acceptance). Either path converges.
ALTER TABLE worker_invites ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_invites_user ON worker_invites(user_id);
