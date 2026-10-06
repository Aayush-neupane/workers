-- 010: reschedule requests mediated by admin.
-- Either side (assigned pro or customer) proposes a new slot after
-- confirmation; an admin approves (slot moves) or rejects. One pending
-- request per booking — a second proposal waits for the first decision.
CREATE TABLE IF NOT EXISTS reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_role TEXT NOT NULL DEFAULT 'customer',
  proposed_slot TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resched_booking ON reschedule_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_resched_status ON reschedule_requests(status);
