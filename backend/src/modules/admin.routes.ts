import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
// Scoped per-route (never router.use): see worker.routes.ts.
const adminOnly = [requireAuth, requireRole("ADMIN")];

async function audit(actorId: string, action: string, detail: string) {
  await query(`INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, 'ADMIN', $2, $3)`, [
    actorId,
    action,
    detail,
  ]);
}

// ---------- Workers ----------
router.get(
  "/admin/workers",
  ...adminOnly,
  ah(async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const conds = ["1=1"];
    const params: unknown[] = [];
    if (state) {
      params.push(state);
      conds.push(`wp.verification_state = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    const r = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active AS user_active,
              wp.bio, wp.years_exp, wp.areas, wp.avatar_hue, wp.verification_state, wp.is_active,
              (SELECT COUNT(*)::int FROM bookings WHERE worker_id = u.id AND status = 'completed') AS jobs_done,
              COALESCE((SELECT array_agg(DISTINCT c.slug) FROM worker_services ws
                        JOIN services s ON s.id = ws.service_id
                        JOIN categories c ON c.id = s.category_id
                        WHERE ws.worker_user_id = u.id), '{}') AS categories
       FROM users u JOIN worker_profiles wp ON wp.user_id = u.id
       WHERE ${conds.join(" AND ")} ORDER BY u.created_at DESC LIMIT 100`,
      params,
    );
    return res.json({ workers: r.rows });
  }),
);

const verifySchema = z.object({
  state: z.enum(["verified", "rejected", "suspended", "under-review", "awaiting-documents"]),
  notes: z.string().max(1000).default(""),
});

router.post(
  "/admin/workers/:id/verify",
  validate(verifySchema),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof verifySchema>;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const u = await client.query(`UPDATE worker_profiles SET verification_state = $1, updated_at = now(),
        is_active = CASE WHEN $1 = 'verified' THEN true WHEN $1 IN ('rejected','suspended') THEN false ELSE is_active END
        WHERE user_id = $2 RETURNING user_id`, [f.state, req.params.id]);
      if (u.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Not found" });
      }
      await client.query(
        `INSERT INTO verification_records(worker_user_id, state, reviewer_id, notes) VALUES ($1, $2, $3, $4)`,
        [req.params.id, f.state, req.user!.id, f.notes],
      );
      await client.query(
        `INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, 'ADMIN', 'verify', $2)`,
        [req.user!.id, `${req.params.id} -> ${f.state}: ${f.notes}`.slice(0, 400)],
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

router.post(
  "/admin/workers/:id/activate",
  validate(z.object({ active: z.boolean() })),
  ...adminOnly,
  ah(async (req, res) => {
    const { active } = req.body as { active: boolean };
    const r = await query(`UPDATE worker_profiles SET is_active = $1, updated_at = now() WHERE user_id = $2`, [
      active,
      req.params.id,
    ]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await audit(req.user!.id, active ? "worker-activate" : "worker-suspend", req.params.id);
    return res.json({ ok: true });
  }),
);

// ---------- Catalog management ----------
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80),
  tagline: z.string().max(200).default(""),
  icon: z.string().max(40).default("wrench"),
  commissionBps: z.number().int().min(0).max(10000).default(1500),
  sortOrder: z.number().int().default(0),
});

router.post(
  "/admin/categories",
  validate(categorySchema),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof categorySchema>;
    try {
      const r = await query(
        `INSERT INTO categories(name, slug, tagline, icon, commission_bps, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [f.name, f.slug, f.tagline, f.icon, f.commissionBps, f.sortOrder],
      );
      await audit(req.user!.id, "category-create", f.slug);
      return res.status(201).json({ ok: true, id: (r.rows[0] as { id: string }).id });
    } catch {
      return res.status(409).json({ error: "Slug already exists" });
    }
  }),
);

router.put(
  "/admin/categories/:id",
  validate(categorySchema.partial()),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as Partial<z.infer<typeof categorySchema>>;
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      name: "name",
      slug: "slug",
      tagline: "tagline",
      icon: "icon",
      commissionBps: "commission_bps",
      sortOrder: "sort_order",
    };
    for (const [k, col] of Object.entries(map)) {
      const v = (f as Record<string, unknown>)[k];
      if (v !== undefined) {
        params.push(v);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });
    params.push(req.params.id);
    const r = await query(`UPDATE categories SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await audit(req.user!.id, "category-update", req.params.id);
    return res.json({ ok: true });
  }),
);

const serviceSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(4000).default(""),
  pricingModel: z.enum(["fixed", "starting", "hourly", "inspection-quote", "custom-quote"]),
  basePricePaisa: z.number().int().min(0),
  unit: z.string().max(40).default(""),
  durationMin: z.number().int().min(0).default(60),
  areas: z.array(z.string().max(60)).default(["Damak"]),
  requirements: z.array(z.string().max(300)).default([]),
  exclusions: z.array(z.string().max(300)).default([]),
  isActive: z.boolean().default(true),
});

router.post(
  "/admin/services",
  validate(serviceSchema),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof serviceSchema>;
    const r = await query(
      `INSERT INTO services(category_id, name, description, pricing_model, base_price_paisa, unit,
                            duration_min, areas, requirements, exclusions, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [f.categoryId, f.name, f.description, f.pricingModel, f.basePricePaisa, f.unit, f.durationMin, f.areas, f.requirements, f.exclusions, f.isActive],
    );
    await audit(req.user!.id, "service-create", f.name.slice(0, 120));
    return res.status(201).json({ ok: true, id: (r.rows[0] as { id: string }).id });
  }),
);

router.put(
  "/admin/services/:id",
  validate(serviceSchema.partial()),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as Partial<z.infer<typeof serviceSchema>>;
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      categoryId: "category_id",
      name: "name",
      description: "description",
      pricingModel: "pricing_model",
      basePricePaisa: "base_price_paisa",
      unit: "unit",
      durationMin: "duration_min",
      areas: "areas",
      requirements: "requirements",
      exclusions: "exclusions",
      isActive: "is_active",
    };
    for (const [k, col] of Object.entries(map)) {
      const v = (f as Record<string, unknown>)[k];
      if (v !== undefined) {
        params.push(v);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });
    params.push(req.params.id);
    const r = await query(
      `UPDATE services SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`,
      params,
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await audit(req.user!.id, "service-update", req.params.id);
    return res.json({ ok: true });
  }),
);

// ---------- Coverage ----------
router.get(
  "/admin/services-all",
  ah(async (_req, res) => {
    const r = await query(
      `SELECT s.*, c.name AS category_name FROM services s
       LEFT JOIN categories c ON c.id = s.category_id ORDER BY s.name LIMIT 200`,
    );
    return res.json({ services: r.rows });
  }),
);

router.get(
  "/admin/wards",
  ah(async (_req, res) => {
    const r = await query(`SELECT ward, is_open FROM coverage_wards ORDER BY ward`);
    return res.json({ zone: "Damak", wards: r.rows });
  }),
);

router.put(
  "/admin/wards",
  validate(z.object({ wards: z.array(z.boolean()).length(10) })),
  ...adminOnly,
  ah(async (req, res) => {
    const { wards } = req.body as { wards: boolean[] };
    for (let i = 0; i < 10; i++) {
      await query(`UPDATE coverage_wards SET is_open = $1, updated_at = now() WHERE ward = $2`, [
        wards[i],
        i + 1,
      ]);
    }
    await audit(req.user!.id, "coverage", `wards open: ${wards.filter(Boolean).length}/10`);
    return res.json({ ok: true });
  }),
);

// ---------- Bookings admin ----------
router.get(
  "/admin/bookings",
  ...adminOnly,
  ah(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const r = await query(
      `SELECT b.*, s.name AS service_name, u.name AS worker_name, c.name AS customer_name
       FROM bookings b LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN users u ON u.id = b.worker_id LEFT JOIN users c ON c.id = b.customer_id
       ${status ? "WHERE b.status = $1" : ""} ORDER BY b.created_at DESC LIMIT 200`,
      status ? [status] : [],
    );
    return res.json({ bookings: r.rows });
  }),
);

// ---------- Commission overrides ----------
router.get(
  "/admin/commission-overrides",
  ah(async (_req, res) => {
    const r = await query(
      `SELECT o.*, cu.name AS customer_name, c.name AS category_name
       FROM commission_overrides o
       LEFT JOIN users cu ON cu.id = o.worker_user_id
       LEFT JOIN categories c ON c.id = o.category_id`,
    );
    return res.json({ overrides: r.rows });
  }),
);

router.post(
  "/admin/commission-overrides",
  validate(z.object({
    workerId: z.string().uuid().nullable().default(null),
    categoryId: z.string().uuid().nullable().default(null),
    rateBps: z.number().int().min(0).max(10000),
  })),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as { workerId: string | null; categoryId: string | null; rateBps: number };
    if (!f.workerId && !f.categoryId) return res.status(400).json({ error: "Scope required" });
    await query(
      `INSERT INTO commission_overrides(worker_user_id, category_id, rate_bps)
       VALUES ($1, $2, $3) ON CONFLICT (worker_user_id, category_id) DO UPDATE SET rate_bps = EXCLUDED.rate_bps`,
      [f.workerId, f.categoryId, f.rateBps],
    );
    await audit(req.user!.id, "commission-override", `${f.workerId ?? "*"} / ${f.categoryId ?? "*"} = ${f.rateBps}bps`);
    return res.json({ ok: true });
  }),
);

// ---------- Finance ----------
router.get(
  "/admin/ledger",
  ah(async (_req, res) => {
    const r = await query(
      `SELECT cl.*, b.booking_no, b.payment_method, b.status, b.worker_id, s.name AS service_name,
              u.name AS worker_name, p.id AS payment_id, p.status AS payment_state
       FROM commission_ledger cl JOIN bookings b ON b.id = cl.booking_id
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN users u ON u.id = b.worker_id
       LEFT JOIN payments p ON p.booking_id = b.id AND p.status = 'verified'
       ORDER BY cl.created_at DESC LIMIT 200`,
    );
    return res.json({ ledger: r.rows });
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
      const client = await (await import("../db/pool.js")).pool.connect();
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
    const client = await (await import("../db/pool.js")).pool.connect();
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

// ---------- Rewards admin ----------
router.get(
  "/admin/rewards/rules",
  ah(async (_req, res) => {
    const r = await query(`SELECT value FROM settings WHERE id = 'platform'`);
    return res.json((r.rows[0] as { value: unknown } | undefined)?.value ?? {});
  }),
);

router.put(
  "/admin/rewards/rules",
  validate(z.object({
    rewardPerNpr100: z.number().int().min(0).optional(),
    milestoneBookings: z.number().int().min(0).optional(),
    milestoneBonus: z.number().int().min(0).optional(),
    redeemPoints: z.number().int().min(1).optional(),
    redeemDiscountPaisa: z.number().int().min(0).optional(),
  })),
  ...adminOnly,
  ah(async (req, res) => {
    const patch = req.body as Record<string, number>;
    await query(
      `UPDATE settings SET value = value || $1::jsonb, updated_at = now() WHERE id = 'platform'`,
      [JSON.stringify(patch)],
    );
    await audit(req.user!.id, "rewards-rules", JSON.stringify(patch).slice(0, 300));
    return res.json({ ok: true });
  }),
);

router.get(
  "/admin/rewards/ledger",
  ah(async (_req, res) => {
    const r = await query(
      `SELECT rl.*, u.name AS user_name FROM reward_ledger rl JOIN users u ON u.id = rl.user_id
       ORDER BY rl.created_at DESC LIMIT 200`,
    );
    return res.json({ ledger: r.rows });
  }),
);

// ---------- Support admin ----------
router.get(
  "/admin/tickets",
  ...adminOnly,
  ah(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const r = await query(
      `SELECT t.*, u.name AS user_name,
              (SELECT json_agg(json_build_object('from', m.from_role, 'text', m.body, 'at', m.created_at)
                               ORDER BY m.created_at)
               FROM ticket_messages m WHERE m.ticket_id = t.id) AS messages
       FROM support_tickets t JOIN users u ON u.id = t.user_id
       ${status ? "WHERE t.status = $1" : ""} ORDER BY t.updated_at DESC LIMIT 100`,
      status ? [status] : [],
    );
    return res.json({ tickets: r.rows });
  }),
);

router.post(
  "/admin/tickets/:id/reply",
  validate(z.object({ body: z.string().trim().min(1).max(2000) })),
  ...adminOnly,
  ah(async (req, res) => {
    const { body } = req.body as { body: string };
    const t = await query(`SELECT id FROM support_tickets WHERE id = $1`, [req.params.id]);
    if (t.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await query(
      `INSERT INTO ticket_messages(ticket_id, from_role, body) VALUES ($1, 'support', $2)`,
      [req.params.id, body],
    );
    await query(`UPDATE support_tickets SET status = 'in-progress', updated_at = now() WHERE id = $1`, [
      req.params.id,
    ]);
    await audit(req.user!.id, "support-reply", req.params.id);
    return res.json({ ok: true });
  }),
);

router.post(
  "/admin/tickets/:id/status",
  validate(z.object({ status: z.enum(["open", "in-progress", "resolved"]) })),
  ...adminOnly,
  ah(async (req, res) => {
    const { status } = req.body as { status: string };
    const r = await query(`UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2`, [
      status,
      req.params.id,
    ]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  }),
);

// ---------- Reports & audit ----------
router.get(
  "/admin/reports/overview",
  ah(async (_req, res) => {
    const q = async (text: string, params: unknown[] = []) =>
      (await query<{ v: string }>(text, params)).rows[0]?.v ?? "0";
    const totalBookings = await q(`SELECT COUNT(*)::text AS v FROM bookings`);
    const revenue = await q(
      `SELECT COALESCE(SUM(COALESCE(final_paisa, estimate_paisa)), 0)::text AS v FROM bookings WHERE status = 'completed'`,
    );
    const commission = await q(`SELECT COALESCE(SUM(commission_paisa), 0)::text AS v FROM commission_ledger`);
    const cashOwed = await q(
      `SELECT COALESCE(SUM(cl.commission_paisa), 0)::text AS v FROM commission_ledger cl
       JOIN bookings b ON b.id = cl.booking_id
       WHERE b.payment_method = 'cash' AND cl.is_settled = false`,
    );
    const disputes = await q(`SELECT COUNT(*)::text AS v FROM bookings WHERE status = 'disputed'`);
    const pendingVerify = await q(
      `SELECT COUNT(*)::text AS v FROM worker_profiles WHERE verification_state IN ('draft','awaiting-documents','under-review')`,
    );
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
      byCategory: byCategory.rows,
    });
  }),
);

router.get(
  "/admin/audit",
  ...adminOnly,
  ah(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 200);
    const r = await query(
      `SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC LIMIT $1`,
      [limit],
    );
    return res.json({ audit: r.rows });
  }),
);

export default router;
