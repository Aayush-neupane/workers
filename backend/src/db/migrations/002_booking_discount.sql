-- 002: persist checkout discounts so receipts show the real total
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_paisa BIGINT NOT NULL DEFAULT 0
  CHECK (discount_paisa >= 0);
