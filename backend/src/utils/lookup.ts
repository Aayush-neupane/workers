/** Bookings are addressable by UUID id or human BK-XXXX number. */
export function bookingKey(param: string): { column: "id" | "booking_no"; value: string } | null {
  if (/^BK-[A-Za-z0-9-]{1,20}$/i.test(param)) return { column: "booking_no", value: param.toUpperCase() };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)) {
    return { column: "id", value: param };
  }
  return null;
}
