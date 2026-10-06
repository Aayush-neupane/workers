-- 011: heal stale assignments. Assigning a pending booking now opens it
-- for confirmation in the same transaction, but rows assigned before that
-- fix sit in pending with a pro and no actions. Move them forward once.
UPDATE bookings SET status = 'awaiting-worker', updated_at = now()
WHERE status = 'pending' AND worker_id IS NOT NULL;

INSERT INTO booking_events(booking_id, status, by_role, note)
SELECT b.id, 'awaiting-worker', 'admin', 'Healed: assigned pending booking opened for confirmation'
FROM bookings b
WHERE b.status = 'awaiting-worker' AND b.worker_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM booking_events e
    WHERE e.booking_id = b.id AND e.note = 'Healed: assigned pending booking opened for confirmation'
  );
