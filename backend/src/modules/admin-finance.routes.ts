import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { pageLimit } from "../utils/pagination.js";

const router = Router();
// Per-route guards (NOT router-level): several admin routers share the
// /api prefix — see admin-workers.routes.ts.
const adminOnly = [requireAuth, requireRole("ADMIN")];

async function audit(actorId: string, action: string, detail: string) {
  await query(`INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, 'ADMIN', $2, $3)`, [
    actorId,
    action,
    detail,
  ]);
}

// ---------- Finance ----------
router.get(
  "/admin/ledger",
  ...adminOnly,
  ah(async (req, res) => {
    const { page, limit, offset } = pageLimit(req.query, 20, 50);
    const total = await query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM commission_ledger`);
    const r = await query(
      `SELECT cl.*, b.booking_no, b.payment_method, b.status, b.worker_id, s.name AS service_name,
              u.name AS worker_name, p.id AS payment_id, p.status AS payment_state
       FROM commission_ledger cl JOIN bookings b ON b.id = cl.booking_id
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN users u ON u.id = b.worker_id
       LEFT JOIN payments p ON p.booking_id = b.id AND p.status = 'verified'
       ORDER BY cl.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return res.json({ ledger: r.rows, total: Number(total.rows[0]?.total ?? 0), page, limit });
  }),
);

router.post(
  "/admin/settlements",
  validate(z.object({
    workerId: z.string().uuid(),
    amountPaisa: z.number().int().positive(),
    kind: z.enum(["payout", "collection"]),
    note: z.string().max(300).default(""),
  })),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as { workerId: string; amountPaisa: number; kind: "payout" | "collection"; note: string };
    // Collections settle outstanding cash commissions.
    if (f.kind === "collection") {
      const owed = await query(
        `SELECT COALESCE(SUM(cl.commission_paisa), 0)::bigint AS total
         FROM commission_ledger cl JOIN bookings b ON b.id = cl.booking_id
         WHERE b.worker_id = $1 AND b.payment_method = 'cash' AND cl.is_settled = false`,
        [f.workerId],
      );
      if (Number((owed.rows[0] as { total: string }).total) < f.amountPaisa) {
        return res.status(400).json({ error: "Amount exceeds outstanding commission" });
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO settlements(worker_user_id, amount_paisa, kind, note, by_user_id)
           VALUES ($1, $2, 'collection', $3, $4)`,
          [f.workerId, f.amountPaisa, f.note, req.user!.id],
        );
        // Settle oldest ledger rows first (FIFO).
        await client.query(
          `WITH open_rows AS (
             SELECT cl.id, cl.commission_paisa,
                    SUM(cl.commission_paisa) OVER (ORDER BY cl.created_at) AS running
             FROM commission_ledger cl JOIN bookings b ON b.id = cl.booking_id
             WHERE b.worker_id = $1 AND b.payment_method = 'cash' AND cl.is_settled = false
           )
           UPDATE commission_ledger cl SET is_settled = true, settled_at = now()
           FROM open_rows o WHERE cl.id = o.id AND o.running - o.commission_paisa < $2`,
          [f.workerId, f.amountPaisa],
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } else {
      await query(
        `INSERT INTO settlements(worker_user_id, amount_paisa, kind, note, by_user_id)
         VALUES ($1, $2, 'payout', $3, $4)`,
        [f.workerId, f.amountPaisa, f.note, req.user!.id],
      );
    }
    await audit(req.user!.id, "settlement", `${f.kind} Rs ${f.amountPaisa / 100} worker ${f.workerId}`);
    return res.json({ ok: true });
  }),
);

router.post(
  "/admin/refunds",
  validate(z.object({
    paymentId: z.string().uuid(),
    amountPaisa: z.number().int().positive(),
    reason: z.string().max(300).default(""),
  })),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as { paymentId: string; amountPaisa: number; reason: string };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const p = await client.query(
        `SELECT id, booking_id, amount_paisa, status FROM payments WHERE id = $1 FOR UPDATE`,
        [f.paymentId],
      );
      if (p.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Not found" });
      }
      const pay = p.rows[0] as { id: string; booking_id: string; amount_paisa: string; status: string };
      if (pay.status !== "verified") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Only verified payments can be refunded" });
      }
      const already = await client.query(
        `SELECT COALESCE(SUM(amount_paisa), 0)::bigint AS total FROM refunds WHERE payment_id = $1`,
        [f.paymentId],
      );
      const refundedSoFar = Number((already.rows[0] as { total: string }).total);
      if (refundedSoFar + f.amountPaisa > Number(pay.amount_paisa)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Refund exceeds payment" });
      }
      await client.query(
        `INSERT INTO refunds(payment_id, amount_paisa, reason, by_user_id) VALUES ($1, $2, $3, $4)`,
        [f.paymentId, f.amountPaisa, f.reason, req.user!.id],
      );
      const full = refundedSoFar + f.amountPaisa >= Number(pay.amount_paisa);
      await client.query(`UPDATE payments SET status = $1 WHERE id = $2`, [
        full ? "refunded" : "partially-refunded",
        f.paymentId,
      ]);
      await client.query(`UPDATE bookings SET payment_status = $1 WHERE id = $2`, [
        full ? "refunded" : "partially-refunded",
        pay.booking_id,
      ]);
      // Reverse the earn for a full refund.
      if (full) {
        await client.query(
          `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
           SELECT b.customer_id,
                  -(SELECT COALESCE(SUM(points), 0) FROM reward_ledger
                    WHERE ref_booking_id = b.id AND kind = 'earn'),
                  'reverse', 'Refund reversal', b.id
           FROM bookings b WHERE b.id = $1
           ON CONFLICT DO NOTHING`,
          [pay.booking_id],
        );
      }
      await client.query(
        `INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, 'ADMIN', 'refund', $2)`,
        [req.user!.id, `Refund Rs ${f.amountPaisa / 100} payment ${f.paymentId}: ${f.reason}`.slice(0, 400)],
      );
      await client.query("COMMIT");
      return res.json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

export default router;
