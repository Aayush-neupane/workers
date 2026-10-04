import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { pageLimit } from "../utils/pagination.js";

const router = Router();
// Per-route guards (NOT router-level): several admin routers share the
// /api prefix — see admin-workers.routes.ts.
const adminOnly = [requireAuth, requireRole("ADMIN")];

// ---------- Operational dashboard: counts staff act on ----------
router.get(
  "/admin/reports/overview",
  ...adminOnly,
  ah(async (_req, res) => {
    const q = async (text: string, params: unknown[] = []) =>
      (await query<{ v: string }>(text, params)).rows[0]?.v ?? "0";
    const [totalBookings, revenue, commission, cashOwed, disputes, pendingVerify, today, preparing] =
      await Promise.all([
        q(`SELECT COUNT(*)::text AS v FROM bookings`),
        q(
          `SELECT COALESCE(SUM(COALESCE(final_paisa, estimate_paisa)), 0)::text AS v FROM bookings WHERE status = 'completed'`,
        ),
        q(`SELECT COALESCE(SUM(commission_paisa), 0)::text AS v FROM commission_ledger`),
        q(
          `SELECT COALESCE(SUM(cl.commission_paisa), 0)::text AS v FROM commission_ledger cl
           JOIN bookings b ON b.id = cl.booking_id
           WHERE b.payment_method = 'cash' AND cl.is_settled = false`,
        ),
        q(`SELECT COUNT(*)::text AS v FROM bookings WHERE status = 'disputed'`),
        q(
          `SELECT COUNT(*)::text AS v FROM worker_profiles WHERE verification_state IN ('draft','awaiting-documents','under-review')`,
        ),
        q(
          `SELECT json_build_object('orders', COUNT(*), 'revenue',
             COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_paisa, estimate_paisa) ELSE 0 END), 0))::text AS v
           FROM bookings WHERE created_at >= date_trunc('day', now())`,
        ),
        q(
          `SELECT COUNT(*)::text AS v FROM bookings
           WHERE status IN ('confirmed','en-route','in-progress','awaiting-confirmation')`,
        ),
      ]);
    const byCategory = await query(
      `SELECT c.name, COUNT(*)::int AS jobs,
              COALESCE(SUM(COALESCE(b.final_paisa, b.estimate_paisa)), 0)::bigint AS revenue,
              COALESCE(SUM(cl.commission_paisa), 0)::bigint AS commission
       FROM bookings b JOIN services s ON s.id = b.service_id
       LEFT JOIN categories c ON c.id = s.category_id
       LEFT JOIN commission_ledger cl ON cl.booking_id = b.id
       WHERE b.status = 'completed' GROUP BY c.name ORDER BY revenue DESC`,
    );
    return res.json({
      totalBookings: Number(totalBookings),
      revenue: Number(revenue),
      commission: Number(commission),
      cashOwed: Number(cashOwed),
      disputes: Number(disputes),
      pendingVerify: Number(pendingVerify),
      today: JSON.parse(today) as { orders: number; revenue: number },
      preparing: Number(preparing),
      byCategory: byCategory.rows,
    });
  }),
);

// ---------- Practical reports: date-ranged totals ----------
const rangeQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function range(params: { from?: string; to?: string }): { clause: string; values: unknown[] } {
  const values: unknown[] = [];
  const parts: string[] = [`b.status NOT IN ('cancelled')`];
  if (params.from) {
    values.push(params.from);
    parts.push(`b.created_at >= $${values.length}::date`);
  }
  if (params.to) {
    values.push(params.to);
    parts.push(`b.created_at < ($${values.length}::date + interval '1 day')`);
  }
  return { clause: parts.join(" AND "), values };
}

router.get(
  "/admin/reports/summary",
  ...adminOnly,
  ah(async (req, res) => {
    const parsed = rangeQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Use ?from=YYYY-MM-DD&to=YYYY-MM-DD" });
    const { clause, values } = range(parsed.data);
    const [byDay, byCategory, byStatus] = await Promise.all([
      query(
        `SELECT to_char(date_trunc('day', b.created_at),'YYYY-MM-DD') AS day, COUNT(*)::int AS orders,
                COALESCE(SUM(COALESCE(b.final_paisa, b.estimate_paisa)),0)::bigint AS revenue
         FROM bookings b WHERE ${clause} GROUP BY 1 ORDER BY 1`,
        values,
      ),
      query(
        `SELECT c.name, COUNT(*)::int AS jobs, COALESCE(SUM(COALESCE(b.final_paisa, b.estimate_paisa)),0)::bigint AS revenue
         FROM bookings b JOIN services s ON s.id = b.service_id
         LEFT JOIN categories c ON c.id = s.category_id
         WHERE ${clause} GROUP BY 1 ORDER BY revenue DESC LIMIT 10`,
        values,
      ),
      query(
        `SELECT b.status, COUNT(*)::int AS orders FROM bookings b WHERE ${clause} GROUP BY 1 ORDER BY 2 DESC`,
        values,
      ),
    ]);
    const totals = await query(
      `SELECT COUNT(*)::int AS orders,
              COALESCE(SUM(COALESCE(b.final_paisa, b.estimate_paisa)),0)::bigint AS revenue,
              COALESCE(SUM(cl.commission_paisa),0)::bigint AS commission
       FROM bookings b LEFT JOIN commission_ledger cl ON cl.booking_id = b.id WHERE ${clause}`,
      values,
    );
    res.json({ totals: totals.rows[0], by_day: byDay.rows, by_category: byCategory.rows, by_status: byStatus.rows });
  }),
);

// ---------- Audit ----------
router.get(
  "/admin/audit",
  ...adminOnly,
  ah(async (req, res) => {
    const { page, limit, offset } = pageLimit(req.query, 20, 50);
    const total = await query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM audit_log`);
    const r = await query(
      `SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return res.json({ audit: r.rows, total: Number(total.rows[0]?.total ?? 0), page, limit });
  }),
);

export default router;
