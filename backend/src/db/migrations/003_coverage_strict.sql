-- 003: strict Damak-only coverage — ward on addresses/bookings + seeded wards
-- Admins toggle coverage via coverage_wards.is_open; booking logic reads it.
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS ward INT CHECK (ward IS NULL OR (ward >= 1 AND ward <= 10));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ward INT CHECK (ward IS NULL OR (ward >= 1 AND ward <= 10));
CREATE INDEX IF NOT EXISTS idx_addresses_ward ON addresses(ward);
CREATE INDEX IF NOT EXISTS idx_bookings_ward ON bookings(ward);

-- Seed wards 1-10 (open by default; admins close via PUT /api/admin/wards).
INSERT INTO coverage_wards(ward, is_open)
SELECT g, true FROM generate_series(1, 10) g
ON CONFLICT (ward) DO NOTHING;
