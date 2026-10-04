-- 006: onboarding completion per user (tutorial seen + profile + first address).
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT false;
