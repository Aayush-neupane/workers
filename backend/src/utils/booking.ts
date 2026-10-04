/** Booking lookup by UUID or human booking_no (BK-XXXX). Never compare a
 *  uuid column to free text — resolve first, then query by id. */

export function isBookingNo(id: string): boolean {
  return /^BK-\d{4,}$/.test(id);
}

export function isUuid(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(id);
}

interface Run {
  query: (text: string, params?: unknown[]) => Promise<{ rows: { id: string }[]; rowCount: number | null }>;
}

/** Returns the booking id, or null when the reference is invalid/unknown. */
export async function resolveBookingId(run: Run, ref: string): Promise<string | null> {
  if (isUuid(ref)) {
    const r = await run.query(`SELECT id FROM bookings WHERE id = $1`, [ref]);
    return (r.rowCount ?? 0) > 0 ? r.rows[0].id : null;
  }
  if (isBookingNo(ref)) {
    const r = await run.query(`SELECT id FROM bookings WHERE booking_no = $1`, [ref]);
    return (r.rowCount ?? 0) > 0 ? r.rows[0].id : null;
  }
  return null;
}
