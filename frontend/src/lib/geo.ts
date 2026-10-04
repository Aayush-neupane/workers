/** Damak map helpers. Tiles: OpenStreetMap streets + Esri satellite (both free,
 *  keyless). Geocoding: Nominatim, biased to the Damak viewbox (polite,
 *  debounced use — never bulk). Pins are dispatch aids, never coverage proof. */

export interface Pin {
  lat: number;
  lng: number;
}

/** Himal Chowk, Damak-5 — the default map centre. */
export const DAMAK_CENTER: Pin = { lat: 26.655, lng: 87.699 };

/** Nominatim viewbox around Damak (left, top, right, bottom). */
const VIEWBOX = "87.55,26.78,87.85,26.55";

export function roundPin(p: Pin): Pin {
  return {
    lat: Math.round(p.lat * 1e5) / 1e5,
    lng: Math.round(p.lng * 1e5) / 1e5,
  };
}

/** Nepal bounding box — matches the backend CHECK constraints. */
export function pinInNepal(p: Pin): boolean {
  return p.lat >= 26 && p.lat <= 31 && p.lng >= 80 && p.lng <= 89;
}

export interface SearchHit {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

/** Place search, Damak-biased and Nepal-only. */
export async function searchPlaces(term: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=np&viewbox=${VIEWBOX}&limit=5&q=${encodeURIComponent(term)}`,
    { headers: { Accept: "application/json" }, signal },
  );
  if (!r.ok) throw new Error("Search unavailable");
  const j = (await r.json()) as SearchHit[];
  return Array.isArray(j) ? j : [];
}

/** Human label for a pin (reverse geocode, English). */
export async function reverseLabel(p: Pin, signal?: AbortSignal): Promise<string> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}&zoom=18&accept-language=en`,
    { headers: { Accept: "application/json" }, signal },
  );
  if (!r.ok) throw new Error("Lookup unavailable");
  const j = (await r.json()) as { display_name?: string };
  return j.display_name ?? "";
}
