/** Shared page/limit parsing: ?page=1-based, ?limit= capped. */
export function pageLimit(q: unknown, def = 20, max = 50): { page: number; limit: number; offset: number } {
  const o = q as Record<string, unknown>;
  const page = Math.max(1, Number(o?.page ?? 1) || 1);
  const limit = Math.min(max, Math.max(1, Number(o?.limit ?? def) || def));
  return { page, limit, offset: (page - 1) * limit };
}
