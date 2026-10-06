-- 009: hot-path indexes, referral anti-fraud columns. All idempotent.

-- Booking lookups that filter/aggregate by service (public catalog,
-- jobs_done counts, admin ledger views).
CREATE INDEX IF NOT EXISTS idx_bookings_service ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_status ON bookings(service_id, status);

-- Eligibility checks filter worker_services by service_id alone; the PK
-- (worker_user_id, service_id) cannot serve that direction.
CREATE INDEX IF NOT EXISTS idx_worker_services_service ON worker_services(service_id);

-- Ordered per-user feeds and ledger scans.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_booking_created ON booking_events(booking_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_reward_ref ON reward_ledger(ref_booking_id) WHERE ref_booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_ledger_unsettled ON commission_ledger(is_settled) WHERE is_settled = false;
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- One bonus per booking: makes milestone ON CONFLICT guards real and stops
-- concurrent completions double-paying. Referral bonuses carry no
-- ref_booking_id (NULLs never conflict), so they are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_bonus_booking
  ON reward_ledger(ref_booking_id) WHERE kind = 'bonus' AND ref_booking_id IS NOT NULL;

-- Referral anti-fraud: per-code redemption cap + snapshotted payout.
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS max_uses INT NOT NULL DEFAULT 10;
ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS bonus_points INT NOT NULL DEFAULT 50;
