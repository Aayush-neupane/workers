-- 003: optional GPS pins on addresses, bookings, quote requests.
-- Pins are supplementary (dispatch aid) — Damak coverage is still gated by
-- city/ward server-side. Nepal bounding box enforced at the database level.
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION
  CHECK (lat IS NULL OR (lat BETWEEN 26 AND 31));
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION
  CHECK (lng IS NULL OR (lng BETWEEN 80 AND 89));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION
  CHECK (lat IS NULL OR (lat BETWEEN 26 AND 31));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION
  CHECK (lng IS NULL OR (lng BETWEEN 80 AND 89));
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION
  CHECK (lat IS NULL OR (lat BETWEEN 26 AND 31));
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION
  CHECK (lng IS NULL OR (lng BETWEEN 80 AND 89));
