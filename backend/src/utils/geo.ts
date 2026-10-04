/** Optional GPS pins (dispatch aid only). Coverage never trusts a pin alone. */

export function validPin(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null && lng == null) return true; // pins are optional
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  // Nepal bounding box (Damak ~26.65N 87.70E).
  return lat >= 26 && lat <= 31 && lng >= 80 && lng <= 89;
}

/** Damak Municipality bounding box — pins must land inside it. */
export const DAMAK_BBOX = {
  minLat: 26.59,
  maxLat: 26.72,
  minLng: 87.63,
  maxLng: 87.77,
};

export function inDamakPin(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null && lng == null) return true; // optional
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  return (
    lat >= DAMAK_BBOX.minLat && lat <= DAMAK_BBOX.maxLat &&
    lng >= DAMAK_BBOX.minLng && lng <= DAMAK_BBOX.maxLng
  );
}

export const OUTSIDE_PIN = "Map pin must be inside Damak Municipality (wards 1–10).";
