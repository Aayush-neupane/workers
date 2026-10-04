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

interface PhotonFeature {
  properties: { name?: string; district?: string; city?: string; countrycode?: string };
  geometry: { coordinates: [number, number] };
}

/** Photon search — resolves Damak streets/localities Nominatim misses. */
async function photonSearch(text: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const r = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&lat=${DAMAK_CENTER.lat}&lon=${DAMAK_CENTER.lng}&limit=5`,
    { headers: { Accept: "application/json" }, signal },
  );
  if (!r.ok) throw new Error("Search unavailable");
  const j = (await r.json()) as { features?: PhotonFeature[] };
  const out: SearchHit[] = [];
  for (const f of j.features ?? []) {
    if (f.properties.countrycode !== "NP") continue;
    const [lng, lat] = f.geometry.coordinates;
    if (lat < 26 || lat > 31 || lng < 80 || lng > 89) continue;
    const bits = [f.properties.name, f.properties.district, f.properties.city].filter(Boolean);
    out.push({
      place_id: Math.abs([...(f.properties.name ?? "?")].reduce((n, c) => n * 31 + c.charCodeAt(0), 7)) + out.length,
      display_name: bits.join(", ") || text,
      lat: String(lat),
      lon: String(lng),
    });
  }
  return out;
}

/** Place search, Damak-biased and Nepal-only. Photon first (localities),
 *  Nominatim as fallback (admin boundaries). */
export async function searchPlaces(term: string, signal?: AbortSignal): Promise<SearchHit[]> {
  try {
    const photon = await photonSearch(term, signal);
    if (photon.length > 0) return photon;
  } catch {
    /* fall through to Nominatim */
  }
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=np&viewbox=${VIEWBOX}&limit=5&q=${encodeURIComponent(term)}`,
    { headers: { Accept: "application/json" }, signal },
  );
  if (!r.ok) throw new Error("Search unavailable");
  const j = (await r.json()) as SearchHit[];
  return Array.isArray(j) ? j : [];
}

/** Best-guess area for a free-text address line (checkout preview). */
export async function geocodeArea(line: string, signal?: AbortSignal): Promise<Pin | null> {
  const queries = [
    `${line}, Damak, Nepal`,
    line.split(",").slice(-2).join(",") + ", Damak, Nepal",
    "Damak, Jhapa, Nepal",
  ];
  for (const q of queries) {
    try {
      const hits = await searchPlaces(q, signal);
      const h = hits[0];
      if (h) return { lat: Number(h.lat), lng: Number(h.lon) };
    } catch {
      /* try the next, broader query */
    }
  }
  return null;
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

export interface RouteInfo {
  coords: [number, number][]; // [lat, lng] polyline
  distanceKm: number;
  durationMin: number;
}

/** Driving route via the OSRM demo server (free, keyless — fine at this volume). */
export async function fetchRoute(from: Pin, to: Pin, signal?: AbortSignal): Promise<RouteInfo> {
  const r = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
    { signal },
  );
  if (!r.ok) throw new Error("Routing unavailable");
  const j = (await r.json()) as {
    routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }[];
  };
  const coords = j.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng] as [number, number]) ?? [];
  if (coords.length < 2) throw new Error("No route found");
  return {
    coords,
    distanceKm: (j.routes?.[0]?.distance ?? 0) / 1000,
    durationMin: (j.routes?.[0]?.duration ?? 0) / 60,
  };
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
