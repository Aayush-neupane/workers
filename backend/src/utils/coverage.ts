/** Damak-only coverage gate — single source of truth for the launch boundary.
 * Launch market: Damak Municipality, Jhapa, Koshi, Nepal (wards 1–10).
 * Pure functions — unit tested, no I/O. */

export function normalizeArea(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

/** True when a city value means Damak ("Damak", "Damak Municipality", "Damak, Jhapa"). */
export function isDamakCity(city: string): boolean {
  const n = normalizeArea(city);
  return n === "damak" || n.startsWith("damak");
}

/** True when free text names Damak anywhere (bare landmarks never qualify). */
export function mentionsDamak(text: string): boolean {
  return normalizeArea(text).includes("damak");
}

/** Parse ward 1–10 from free text ("Damak-5", "ward 3", "W-5"). Null = no ward mentioned. */
export function parseWard(line: string): number | null {
  if (!line) return null;
  const m = line.match(/(?:damak\s*[-\s]?\s*|ward\s*(?:no\.?\s*)?|w\s*[-\s]?)\s*(\d{1,2})/i);
  if (!m) return null;
  const w = Number(m[1]);
  return Number.isInteger(w) && w >= 1 && w <= 10 ? w : null;
}

export const OUTSIDE_DAMAK =
  "We serve Damak Municipality only (wards 1–10). This address looks outside our coverage.";

export function closedWardMessage(ward: number): string {
  return `Damak ward ${ward} is temporarily closed. Try a nearby ward or contact support.`;
}

/** Service areas gate: empty = everywhere; otherwise Damak must be listed. */
export function serviceServesDamak(areas: string[] | null | undefined): boolean {
  if (!areas || areas.length === 0) return true;
  return areas.some((a) => {
    const n = normalizeArea(a);
    return n === "damak" || n.startsWith("damak");
  });
}
