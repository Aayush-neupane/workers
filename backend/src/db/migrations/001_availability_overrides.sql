-- 001: worker availability + commission overrides
CREATE TABLE IF NOT EXISTS worker_availability (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dow INT NOT NULL CHECK (dow >= 0 AND dow <= 6),
  is_open BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, dow)
);

-- Optional overrides: worker-specific or category-specific commission rates.
-- Resolution order: worker+category > worker > category > global.
CREATE TABLE IF NOT EXISTS commission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  rate_bps INT NOT NULL CHECK (rate_bps >= 0 AND rate_bps <= 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (worker_user_id IS NOT NULL OR category_id IS NOT NULL),
  UNIQUE (worker_user_id, category_id)
);
