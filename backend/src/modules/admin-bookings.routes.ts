import { Router } from "express";
import { query } from "../db/pool.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { likePattern } from "../utils/sql.js";
import { pageLimit } from "../utils/pagination.js";

const router = Router();
// Per-route guards (NOT router-level): several admin routers share the
// /api prefix — see admin-workers.routes.ts.
const adminOnly = [requireAuth, requireRole("ADMIN")];

// ---------- Bookings admin (search + filter + paginate) ----------
router.get(
  "/admin/bookings",
  ...adminOnly,
  ah(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const { page, limit, offset } = pageLimit(req.query, 20, 50);
    const where: string[] = [];
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      where.push(`b.status = $${params.length}`);
    }
    if (q) {
      params.push(likePattern(q));
      const i = params.length;
      where.push(
        `(b.booking_no ILIKE $${i} ESCAPE '\\' OR u.name ILIKE $${i} ESCAPE '\\' OR c.name ILIKE $${i} ESCAPE '\\')`,
      );
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM bookings b
       LEFT JOIN users u ON u.id = b.worker_id LEFT JOIN users c ON c.id = b.customer_id ${clause}`,
      params,
    );
    const r = await query(
      `SELECT b.*, s.name AS service_name, u.name AS worker_name, c.name AS customer_name
       FROM bookings b LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN users u ON u.id = b.worker_id LEFT JOIN users c ON c.id = b.customer_id
       ${clause} ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return res.json({ bookings: r.rows, total: Number(total.rows[0]?.total ?? 0), page, limit });
  }),
);

export default router;
