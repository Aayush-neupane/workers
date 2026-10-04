/** Optional GPS pins (dispatch aid only). Coverage never trusts a pin alone. */

export function validPin(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null && lng == null) return true; // pins are optional
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  // Nepal bounding box (Damak ~26.65N 87.70E).
  return lat >= 26 && lat <= 31 && lng >= 80 && lng <= 89;
}
