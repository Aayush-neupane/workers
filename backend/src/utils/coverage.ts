/** Damak-only coverage gate — single source of truth for the launch boundary.
 *
 * Launch market: Damak Municipality, Jhapa, Koshi, Nepal (wards 1–10).
 * Everything outside it is rejected with an explainable error; closed
 * wards are rejected separately so admins can toggle coverage without
 * rewriting booking logic. Pure functions — safe to unit test.
 */

/** Normalize for comparison: lowercase, alphanumeric only. */
export function normalizeArea(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

/** True when a city value means Damak (tolerates "Damak Municipality", "Damak, Jhapa"). */
export function isDamakCity(city: string): boolean {
  const n = normalizeArea(city);
  return n === "damak" || n.startsWith("damak");
}

/** True when free text names Damak anywhere (for addressText without an addressId). */
export function mentionsDamak(text: string): boolean {
  return normalizeArea(text).includes("damak");
}

/**
 * Parse a ward number 1–10 out of a free-text line.
 * Matches "Damak-5", "Damak 5", "ward 5", "ward no. 5", "W-5".
 * Returns null when no ward is mentioned (landmarks allowed).
 */
export function parseWard(line: string): number | null {
  if (!line) return null;
  const m = line.match(
    /(?:damak\s*[-\s]?\s*|ward\s*(?:no\.?\s*)?|w\s*[-\s]?)\s*(\d{1,2})/i,
  );
  if (!m) return null;
  const w = Number(m[1]);
  return Number.isInteger(w) && w >= 1 && w <= 10 ? w : null;
}

export const OUTSIDE_DAMAK =
  "We serve Damak Municipality only (wards 1–10). This address looks outside our coverage.";

export function closedWardMessage(ward: number): string {
  return `Damak ward ${ward} is temporarily closed. Try a nearby ward or contact support.`;
}

/** Service areas gate: empty areas = everywhere; otherwise Damak must be listed. */
export function serviceServesDamak(areas: string[] | null | undefined): boolean {
  if (!areas || areas.length === 0) return true;
  return areas.some((a) => normalizeArea(a) === "damak" || normalizeArea(a).startsWith("damak"));
}
