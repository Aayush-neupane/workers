import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { calcCommission } from "../utils/money.js";

const router = Router();
// Scoped per-route (never router.use): a router-level role gate would reject
// every /api/* request that passes through this router, even for other routers.
const workerOnly = [requireAuth, requireRole("WORKER", "ADMIN")];

// Open assignment requests in my service categories.
router.get(
  "/worker/requests",
  ...workerOnly,
  ah(async (req, res) => {
    const r = await query(
      `SELECT b.*, s.name AS service_name
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.status = 'awaiting-worker' AND (b.worker_id IS NULL OR b.worker_id = $1)
         AND EXISTS (SELECT 1 FROM worker_services ws WHERE ws.worker_user_id = $1 AND ws.service_id = b.service_id)
       ORDER BY b.slot LIMIT 50`,
      [req.user!.id],
    );
    return res.json({ requests: r.rows });
  }),
);

// Jobs assigned to me.
router.get(
  "/worker/jobs",
  ...workerOnly,
  ah(async (req, res) => {
    const r = await query(
      `SELECT b.*, s.name AS service_name
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.worker_id = $1 ORDER BY b.slot LIMIT 100`,
      [req.user!.id],
    );
    return res.json({ jobs: r.rows });
  }),
);

// Earnings with commission split + settlements.
router.get(
  "/worker/earnings",
  ...workerOnly,
  ah(async (req, res) => {
    const r = await query(
      `SELECT b.id, b.booking_no, b.final_paisa, b.commission_bps, b.payment_method,
              cl.commission_paisa, cl.worker_paisa, cl.is_settled
       FROM bookings b LEFT JOIN commission_ledger cl ON cl.booking_id = b.id
       WHERE b.worker_id = $1 AND b.status = 'completed' ORDER BY b.updated_at DESC`,
      [req.user!.id],
    );
    const rows = r.rows as Record<string, unknown>[];
    let collected = 0;
    let commission = 0;
    for (const row of rows) {
      const f = Number(row.final_paisa ?? 0);
      const c =
        row.commission_paisa === null || row.commission_paisa === undefined
          ? calcCommission(f, Number(row.commission_bps))
          : Number(row.commission_paisa);
      collected += f;
      commission += c;
    }
    const st = await query(
      `SELECT kind, COALESCE(SUM(amount_paisa), 0)::bigint AS total FROM settlements
       WHERE worker_user_id = $1 GROUP BY kind`,
      [req.user!.id],
    );
    return res.json({ jobs: rows, collected, commission, net: collected - commission, settlements: st.rows });
  }),
);

router.get(
  "/worker/availability",
  ...workerOnly,
  ah(async (req, res) => {
    const r = await query(`SELECT dow, is_open FROM worker_availability WHERE user_id = $1`, [
      req.user!.id,
    ]);
    const days = [false, true, true, true, true, true, false];
    for (const row of r.rows as { dow: number; is_open: boolean }[]) days[row.dow] = row.is_open;
    return res.json({ days });
  }),
);

const availSchema = z.object({
  days: z.array(z.boolean()).length(7),
});

router.put(
  "/worker/availability",
  validate(availSchema),
  ...workerOnly,
  ah(async (req, res) => {
    const { days } = req.body as z.infer<typeof availSchema>;
    for (let dow = 0; dow < 7; dow++) {
      await query(
        `INSERT INTO worker_availability(user_id, dow, is_open) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, dow) DO UPDATE SET is_open = EXCLUDED.is_open`,
        [req.user!.id, dow, days[dow]],
      );
    }
    return res.json({ ok: true, days });
  }),
);

export default router;
