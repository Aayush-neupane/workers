import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole, requirePermission, requireAnyPermission, requireSuperAdmin, effectivePermissions, isSuperAdmin } from "../middleware/auth.js";
import { notify, audit } from "../services/notify.js";
import { pushToAudience, pushToUser } from "../services/push.js";
import { resolveBookingId } from "../utils/booking.js";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const router = Router();
// Super-admins (ADMIN) + sub-admins (SUB_ADMIN). Every route below additionally
// requires its own capability — the role alone authorizes nothing.
router.use(requireAuth, requireRole("ADMIN", "SUB_ADMIN"));

async function adminAudit(actorId: string, action: string, detail: string) {
  await audit(actorId, "ADMIN", action, detail);
}

// ---------- Overview (date-filtered operational metrics) ----------
router.get("/admin/overview", requirePermission("overview.view"), ah(async (_req, res) => {
  const bookings = await query<{ status: string; n: string }>(
    `SELECT status, COUNT(*) AS n FROM bookings GROUP BY status`);
  const unassigned = await query(`SELECT COUNT(*)::int AS n FROM bookings WHERE status = 'awaiting-worker' AND worker_id IS NULL`);
  const verifications = await query(`SELECT COUNT(*)::int AS n FROM worker_profiles WHERE verification_state = 'under-review'`);
  const pros = await query(
    `SELECT verification_state, COUNT(*)::int AS n FROM worker_profiles GROUP BY verification_state`);
  const money = await query(
    `SELECT COALESCE(SUM(total_paisa), 0)::bigint AS gross, COALESCE(SUM(commission_paisa), 0)::bigint AS commission
     FROM commission_ledger`);
  const cash = await query(`SELECT COALESCE(SUM(amount_paisa), 0)::bigint AS cash FROM cash_collections`);
  const disputes = await query(`SELECT COUNT(*)::int AS n FROM bookings WHERE status = 'disputed'`);
  const refunds = await query(`SELECT COALESCE(SUM(amount_paisa), 0)::bigint AS total FROM refunds`);
  return res.json({
    bookings: bookings.rows,
    unassigned: (unassigned.rows[0] as { n: number }).n,
    pendingVerifications: (verifications.rows[0] as { n: number }).n,
    pros: pros.rows,
    grossPaisa: (money.rows[0] as { gross: string }).gross,
    commissionPaisa: (money.rows[0] as { commission: string }).commission,
    cashCollectedPaisa: (cash.rows[0] as { cash: string }).cash,
    openDisputes: (disputes.rows[0] as { n: number }).n,
    refundsPaisa: (refunds.rows[0] as { total: string }).total,
  });
}));

// ---------- Workers: invite, verify, activate ----------
router.get("/admin/workers", requireAnyPermission("worker.verify", "workers.view", "bookings.view", "bookings.assign"), ah(async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const r = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.is_active, wp.bio, wp.years_exp, wp.areas,
            wp.verification_state, wp.created_at AS joined_at,
            (SELECT COUNT(*)::int FROM bookings WHERE worker_id = u.id AND status = 'completed') AS jobs_done
     FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
     LEFT JOIN worker_profiles wp ON wp.user_id = u.id
     WHERE r.name = 'WORKER' ${state ? "AND wp.verification_state = $1" : ""}
     ORDER BY wp.updated_at DESC NULLS LAST LIMIT 100`,
    state ? [state] : []);
  return res.json({ workers: r.rows });
}));

/**
 * Invite an EXISTING customer as a professional (the only way pros enter):
 * they sign up normally, submit certificates physically, admin verifies and
 * sends the invite straight to their dashboard — they accept in-app, that's
 * it. No email links, no tokens leave the server.
 */
router.post(
  "/admin/workers/invite-user",
  requirePermission("worker.invite"),
  validate(z.object({ userId: z.string().uuid() })),
  ah(async (req, res) => {
    const f = req.body as { userId: string };
    if (f.userId === req.user!.id) return res.status(400).json({ error: "You cannot invite yourself" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<{ id: string; email: string; name: string }>(
        `SELECT id, email, name FROM users WHERE id = $1 AND is_active = true FOR UPDATE`, [f.userId]);
      if (locked.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }
      // Staff and existing pros are never invite targets.
      const staff = await client.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1 AND r.name IN ('WORKER', 'ADMIN', 'SUB_ADMIN')`, [f.userId]);
      if ((staff.rowCount ?? 0) > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Only customers can be invited as professionals" });
      }
      const pending = await client.query(
        `SELECT id FROM worker_invites
         WHERE (user_id = $1 OR email = $2) AND accepted_at IS NULL AND expires_at > now()`,
        [f.userId, locked.rows[0].email]);
      if ((pending.rowCount ?? 0) > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "An active invite already exists for this user" });
      }
      // Internal row key only — never returned or shared. Acceptance happens
      // in-app from the customer's dashboard, never via link.
      const token = randomBytes(24).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const inv = await client.query<{ id: string }>(
        `INSERT INTO worker_invites(email, name, token_hash, expires_at, created_by, user_id)
         VALUES ($1, $2, $3, now() + interval '7 days', $4, $5) RETURNING id`,
        [locked.rows[0].email, locked.rows[0].name, tokenHash, req.user!.id, f.userId]);
      await notify(client, f.userId, "Invited as a professional",
        "Our team verified your application. Accept the invitation in your dashboard to open the pro portal.");
      await client.query("COMMIT");
      await adminAudit(req.user!.id, "worker-invite-user", `${locked.rows[0].email} (${f.userId})`);
      void pushToUser(f.userId, {
        title: "Invited as a professional",
        body: "Our team verified your application — accept it in your dashboard.",
        url: "/dashboard",
      });
      return res.status(201).json({ ok: true, id: inv.rows[0].id });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

router.post(
  "/admin/workers/:id/verify",
  requirePermission("worker.verify"),
  validate(z.object({
    state: z.enum(["verified", "rejected", "suspended", "under-review", "awaiting-documents"]),
    notes: z.string().max(2000).default(""),
  })),
  ah(async (req, res) => {
    const f = req.body as { state: string; notes: string };
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: "Invalid worker id" });
    if (req.params.id === req.user!.id) return res.status(400).json({ error: "You cannot review yourself" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const exists = await client.query(
        `SELECT 1 FROM worker_profiles WHERE user_id = $1`, [req.params.id]);
      if ((exists.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Worker profile not found" });
      }
      await client.query(
        `UPDATE worker_profiles SET verification_state = $1, updated_at = now() WHERE user_id = $2`,
        [f.state, req.params.id]);
      await client.query(
        `INSERT INTO verification_records(worker_user_id, state, reviewer_id, notes) VALUES ($1, $2, $3, $4)`,
        [req.params.id, f.state, req.user!.id, f.notes]);
      await client.query("COMMIT");
      await adminAudit(req.user!.id, "worker-verify", `${req.params.id} -> ${f.state}`);
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
  requirePermission("worker.activate"),
  validate(z.object({ active: z.boolean(), serviceIds: z.array(z.string().uuid()).default([]) })),
  ah(async (req, res) => {
    const f = req.body as { active: boolean; serviceIds: string[] };
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: "Invalid worker id" });
    if (req.params.id === req.user!.id) return res.status(400).json({ error: "You cannot change your own activation" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const prof = await client.query<{ verification_state: string }>(
        `SELECT verification_state FROM worker_profiles WHERE user_id = $1`, [req.params.id]);
      if ((prof.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Worker profile not found" });
      }
      if (f.active) {
        if (prof.rows[0].verification_state !== "verified") {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Only verified pros can be activated" });
        }
        // An active pro with zero skills can never be assigned — refuse the
        // trap instead of creating a silently unusable worker.
        if (f.serviceIds.length === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Tick at least one specialty — otherwise nobody can assign this pro" });
        }
        if (f.serviceIds.length > 0) {
          const svc = await client.query<{ n: number }>(
            `SELECT COUNT(*)::int AS n FROM services WHERE id = ANY ($1::uuid[])`, [f.serviceIds]);
          if (svc.rows[0].n !== new Set(f.serviceIds).size) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "One or more services do not exist" });
          }
        }
      }
      await client.query(`UPDATE worker_profiles SET is_active = $1, updated_at = now() WHERE user_id = $2`,
        [f.active, req.params.id]);
      // Skills are only rewritten when activating (or when a new set is
      // sent) — deactivating never wipes them, so re-activation keeps them.
      if (f.active || f.serviceIds.length > 0) {
        await client.query(`DELETE FROM worker_services WHERE worker_user_id = $1`, [req.params.id]);
        for (const sid of f.serviceIds) {
          await client.query(`INSERT INTO worker_services(worker_user_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [req.params.id, sid]);
        }
      }
      await client.query("COMMIT");
      await adminAudit(req.user!.id, "worker-activate", `${req.params.id} active=${f.active}`);
      return res.json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

router.get("/admin/workers/:id/documents", requireAnyPermission("worker.verify", "workers.view"), ah(async (req, res) => {
  const r = await query(`SELECT id, kind, uploaded_at FROM verification_documents WHERE worker_user_id = $1`, [req.params.id]);
  return res.json({ documents: r.rows });
}));

// Single worker file: current verification state, activation, and skill set.
// Powers the review drawer so admins see (and keep) what's already set.
router.get("/admin/workers/:id", requireAnyPermission("worker.verify", "workers.view"), ah(async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: "Invalid worker id" });
  const u = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.is_active,
            wp.verification_state, wp.is_active AS profile_active, wp.bio, wp.years_exp
     FROM users u LEFT JOIN worker_profiles wp ON wp.user_id = u.id WHERE u.id = $1`,
    [req.params.id]);
  if ((u.rowCount ?? 0) === 0) return res.status(404).json({ error: "Worker not found" });
  const skills = await query<{ service_id: string }>(
    `SELECT service_id FROM worker_services WHERE worker_user_id = $1`, [req.params.id]);
  return res.json({ worker: u.rows[0], skillIds: skills.rows.map((s) => s.service_id) });
}));

// ---------- Customers (least-privilege: masked contact) ----------
router.get("/admin/customers", requirePermission("customers.view"), ah(async (req, res) => {
  const raw = typeof req.query.q === "string" ? req.query.q : "";
  const q = `%${raw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const r = await query(
    `SELECT u.id, u.name, u.email, u.is_active, u.created_at,
            (SELECT COUNT(*)::int FROM bookings WHERE customer_id = u.id) AS bookings,
            (SELECT COUNT(*)::int FROM bookings WHERE customer_id = u.id AND status = 'completed') AS completed
     FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
     WHERE r.name = 'CUSTOMER' AND (u.name ILIKE $1 OR u.email ILIKE $1)
     ORDER BY u.created_at DESC LIMIT 50`, [q]);
  return res.json({ customers: r.rows });
}));

// ---------- Catalog ----------
router.post(
  "/admin/categories",
  requirePermission("catalog.edit"),
   validate(z.object({
    name: z.string().trim().min(2).max(80), slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, dashes only"),
    tagline: z.string().max(200).default(""), icon: z.string().max(30).default("wrench"),
    commissionBps: z.number().int().min(0).max(10000).default(1500),
  })),
  ah(async (req, res) => {
    const f = req.body as Record<string, string | number>;
    try {
      const r = await query(
        `INSERT INTO categories(name, slug, tagline, icon, commission_bps)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [f.name, f.slug, f.tagline, f.icon, f.commissionBps]);
      await adminAudit(req.user!.id, "catalog-category", String(f.slug));
      return res.status(201).json({ ok: true, id: (r.rows[0] as { id: string }).id });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        return res.status(409).json({ error: "A category with this slug already exists" });
      }
      throw e;
    }
  }),
);

router.post(
  "/admin/services",
  requirePermission("catalog.edit"),
  validate(z.object({
    categoryId: z.string().uuid(), name: z.string().trim().min(3).max(120),
    description: z.string().max(2000).default(""),
    pricingModel: z.enum(["fixed", "starting", "hourly", "inspection-quote", "custom-quote"]),
    basePricePaisa: z.number().int().min(0).default(0),
    durationMin: z.number().int().min(0).default(60),
  })),
  ah(async (req, res) => {
    const f = req.body as Record<string, string | number>;
    const r = await query(
      `INSERT INTO services(category_id, name, description, pricing_model, base_price_paisa, duration_min)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [f.categoryId, f.name, f.description, f.pricingModel, f.basePricePaisa, f.durationMin]);
    await adminAudit(req.user!.id, "catalog-service", String(f.name));
    return res.status(201).json({ ok: true, id: (r.rows[0] as { id: string }).id });
  }),
);

// ---------- Coverage + commission + finance ----------
router.put(
  "/admin/wards",
  requirePermission("coverage.edit"),
  validate(z.object({ wards: z.array(z.boolean()).length(10) })),
  ah(async (req, res) => {
    const { wards } = req.body as { wards: boolean[] };
    if (!wards.some(Boolean)) {
      return res.status(400).json({ error: "At least one ward must stay open — closing all of Damak blocks every booking" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < 10; i++) {
        await client.query(`UPDATE coverage_wards SET is_open = $1, updated_at = now() WHERE ward = $2`, [wards[i], i + 1]);
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    await adminAudit(req.user!.id, "coverage", `wards open: ${wards.filter(Boolean).length}/10`);
    return res.json({ ok: true });
  }),
);

router.post(
  "/admin/commission-rules",
  requirePermission("commission.edit"),
  validate(z.object({
    scope: z.enum(["global", "category", "worker"]),
    categoryId: z.string().uuid().nullable().default(null),
    workerId: z.string().uuid().nullable().default(null),
    rateBps: z.number().int().min(0).max(10000),
  })),
  ah(async (req, res) => {
    const f = req.body as { scope: string; categoryId: string | null; workerId: string | null; rateBps: number };
    // Scope coherence: global rules reference nothing, category rules need a
    // category, worker rules need a worker — and the targets must exist.
    if (f.scope === "global" && (f.categoryId || f.workerId)) {
      return res.status(400).json({ error: "Global rules take no category or worker" });
    }
    if (f.scope === "category" && !f.categoryId) {
      return res.status(400).json({ error: "Category rules need a categoryId" });
    }
    if (f.scope === "worker" && !f.workerId) {
      return res.status(400).json({ error: "Worker rules need a workerId" });
    }
    if (f.categoryId) {
      const c = await query(`SELECT id FROM categories WHERE id = $1`, [f.categoryId]);
      if ((c.rowCount ?? 0) === 0) return res.status(404).json({ error: "Category not found" });
    }
    if (f.workerId) {
      const w = await query(`SELECT id FROM users WHERE id = $1`, [f.workerId]);
      if ((w.rowCount ?? 0) === 0) return res.status(404).json({ error: "Worker not found" });
    }
    await query(
      `INSERT INTO commission_rules(scope, category_id, worker_user_id, rate_bps)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (scope, category_id, worker_user_id) DO UPDATE SET rate_bps = EXCLUDED.rate_bps`,
      [f.scope, f.categoryId, f.workerId, f.rateBps]);
    await adminAudit(req.user!.id, "commission-rule", `${f.scope} = ${f.rateBps}bps`);
    return res.json({ ok: true });
  }),
);

router.get("/admin/bookings", requirePermission("bookings.view"), ah(async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const r = await query(
    `SELECT b.*, s.name AS service_name, cu.name AS customer_name, w.name AS worker_name
     FROM bookings b LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN users cu ON cu.id = b.customer_id LEFT JOIN users w ON w.id = b.worker_id
     ${status ? "WHERE b.status = $1" : ""} ORDER BY b.created_at DESC LIMIT 100`,
    status ? [status] : []);
  return res.json({ bookings: r.rows });
}));

router.post(
  "/admin/settlements",
  requirePermission("finance.settle"),
  validate(z.object({
    workerId: z.string().uuid(), amountPaisa: z.number().int().min(1),
    kind: z.enum(["payout", "collection"]), note: z.string().max(300).default(""),
  })),
  ah(async (req, res) => {
    const f = req.body as Record<string, string | number>;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Settle FIFO against the actual unsettled commission owed — never
      // blanket-settle, and never settle more than is owed.
      await client.query(
        `SELECT cl.booking_id FROM commission_ledger cl
         JOIN bookings b ON b.id = cl.booking_id
         WHERE b.worker_id = $1 AND NOT cl.is_settled FOR UPDATE OF cl`, [f.workerId]);
      const owed = await client.query<{ open: string }>(
        `SELECT COALESCE(SUM(cl.commission_paisa), 0)::bigint AS open
         FROM commission_ledger cl JOIN bookings b ON b.id = cl.booking_id
         WHERE b.worker_id = $1 AND NOT cl.is_settled`, [f.workerId]);
      const openOwed = Number((owed.rows[0] as { open: string }).open);
      const amount = Number(f.amountPaisa);
      if (openOwed <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Nothing unsettled for this pro" });
      }
      if (amount > openOwed) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Amount exceeds unsettled Rs ${(openOwed / 100).toFixed(0)}` });
      }
      await client.query(
        `INSERT INTO settlements(worker_user_id, amount_paisa, kind, note, by_user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [f.workerId, amount, f.kind, f.note, req.user!.id]);
      // FIFO: mark oldest unsettled rows settled until the amount is covered.
      await client.query(
        `WITH open_rows AS (
           SELECT cl.booking_id FROM commission_ledger cl
           JOIN bookings b ON b.id = cl.booking_id
           WHERE b.worker_id = $1 AND NOT cl.is_settled
           ORDER BY cl.created_at
         ), running AS (
           SELECT booking_id, SUM(commission_paisa) OVER (ORDER BY created_at) AS running
           FROM commission_ledger WHERE booking_id IN (SELECT booking_id FROM open_rows)
         )
         UPDATE commission_ledger cl SET is_settled = true, settled_at = now()
         FROM running r WHERE cl.booking_id = r.booking_id AND r.running <= $2`,
        [f.workerId, amount]);
      await client.query("COMMIT");
      await adminAudit(req.user!.id, "settlement", `${f.kind} ${amount} for ${f.workerId} (owed ${openOwed})`);
      return res.json({ ok: true, settledPaisa: amount, remainingPaisa: openOwed - amount });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

router.post(
  "/admin/refunds",
  requirePermission("finance.refund"),
  validate(z.object({ paymentId: z.string().uuid(), amountPaisa: z.number().int().min(1), reason: z.string().max(500).default("") })),
  ah(async (req, res) => {
    const f = req.body as { paymentId: string; amountPaisa: number; reason: string };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const p = await client.query<{ booking_id: string; amount_paisa: string; status: string }>(
        `SELECT booking_id, amount_paisa, status FROM payments WHERE id = $1 FOR UPDATE`, [f.paymentId]);
      if (p.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Payment not found" });
      }
      const paid = Number(p.rows[0].amount_paisa);
      // Prior refunds count — a second refund of the remainder is fine,
      // refunding more than what is left is not. Lock the refund rows too.
      const prior = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(amount_paisa), 0)::bigint AS total FROM refunds WHERE payment_id = $1`,
        [f.paymentId]);
      const refunded = Number((prior.rows[0] as { total: string }).total);
      const remaining = paid - refunded;
      if (f.amountPaisa > remaining) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Only Rs ${(remaining / 100).toFixed(0)} left to refund` });
      }
      await client.query(
        `INSERT INTO refunds(payment_id, amount_paisa, reason, by_user_id) VALUES ($1, $2, $3, $4)`,
        [f.paymentId, f.amountPaisa, f.reason, req.user!.id]);
      const partial = f.amountPaisa < remaining;
      await client.query(`UPDATE payments SET status = $1 WHERE id = $2`,
        [partial ? "partially-refunded" : "refunded", f.paymentId]);
      const bk = await client.query<{ customer_id: string }>(`SELECT customer_id FROM bookings WHERE id = $1`, [p.rows[0].booking_id]);
      if ((bk.rowCount ?? 0) > 0) {
        // Reverse earned points once — guarded so retries can't double-reverse.
        const already = await client.query(
          `SELECT 1 FROM reward_ledger WHERE ref_booking_id = $1 AND kind = 'reverse'`, [p.rows[0].booking_id]);
        if ((already.rowCount ?? 0) === 0) {
          await client.query(
            `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
             SELECT $1, -points, 'reverse', 'Refund reversal', $2 FROM reward_ledger
             WHERE ref_booking_id = $2 AND kind = 'earn'`,
            [bk.rows[0].customer_id, p.rows[0].booking_id]);
        }
        await notify(client, bk.rows[0].customer_id, "Refund processed", `Rs ${(f.amountPaisa / 100).toFixed(0)} refunded.`);
      }
      await client.query("COMMIT");
      await adminAudit(req.user!.id, "refund", `${f.paymentId} ${f.amountPaisa}`);
      return res.json({ ok: true, partial });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

// ---------- Support / audit / settings ----------
router.get("/admin/tickets", requirePermission("support.reply"), ah(async (_req, res) => {
  const r = await query(`SELECT t.*, u.name AS user_name FROM support_tickets t
    JOIN users u ON u.id = t.user_id ORDER BY t.updated_at DESC LIMIT 100`);
  return res.json({ tickets: r.rows });
}));

router.post(
  "/admin/tickets/:id/reply",
  requirePermission("support.reply"),
  validate(z.object({ body: z.string().trim().min(1).max(2000) })),
  ah(async (req, res) => {
    const f = req.body as { body: string };
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: "Invalid ticket id" });
    const t = await query(`SELECT id FROM support_tickets WHERE id = $1`, [req.params.id]);
    if ((t.rowCount ?? 0) === 0) return res.status(404).json({ error: "Ticket not found" });
    await query(`INSERT INTO ticket_messages(ticket_id, from_role, body) VALUES ($1, 'admin', $2)`,
      [req.params.id, f.body]);
    await query(`UPDATE support_tickets SET status = 'in-progress', updated_at = now() WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  }),
);

router.post(
  "/admin/tickets/:id/status",
  requirePermission("support.reply"),
  validate(z.object({ status: z.enum(["open", "in-progress", "resolved"]) })),
  ah(async (req, res) => {
    const f = req.body as { status: string };
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: "Invalid ticket id" });
    const r = await query(`UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2`, [f.status, req.params.id]);
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "Ticket not found" });
    await adminAudit(req.user!.id, "ticket-status", `${req.params.id} -> ${f.status}`);
    return res.json({ ok: true });
  }),
);

router.get("/admin/audit", requirePermission("audit.read"), ah(async (req, res) => {
  const r = await query(`SELECT a.*, u.name AS actor_name FROM audit_log a
    LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 200`);
  return res.json({ entries: r.rows });
}));

router.get("/admin/settings", requireAnyPermission("settings.view", "settings.edit", "rewards.view"), ah(async (_req, res) => {
  const r = await query(`SELECT value FROM settings WHERE id = 'platform'`);
  return res.json(r.rows[0]?.value ?? {});
}));

router.put(
  "/admin/settings",
  requirePermission("settings.edit"),
  validate(z.object({
    value: z.object({
      zone: z.string().max(40).optional(),
      rewardPerNpr100: z.number().int().min(0).max(100).optional(),
      redeemPoints: z.number().int().min(1).max(100000).optional(),
      redeemDiscountPaisa: z.number().int().min(0).max(500000).optional(),
      milestoneBookings: z.number().int().min(0).max(1000).optional(),
      milestoneBonus: z.number().int().min(0).max(100000).optional(),
      referralBonus: z.number().int().min(0).max(100000).optional(),
      quotesRequireAdminApproval: z.boolean().optional(),
      quotesApprovalThresholdPaisa: z.number().int().min(0).max(100000000).optional(),
      cookiePolicyVersion: z.string().max(20).optional(),
      consentVersion: z.number().int().min(1).max(100).optional(),
    }).strict(),
  })),
  ah(async (req, res) => {
    const f = req.body as { value: Record<string, unknown> };
    // Merge, never replace: a partial strict object must not wipe keys.
    await query(
      `INSERT INTO settings(id, value) VALUES ('platform', $1)
       ON CONFLICT (id) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(f.value)]);
    await adminAudit(req.user!.id, "settings", `platform updated: ${Object.keys(f.value).join(", ")}`);
    return res.json({ ok: true });
  }),
);

// ---------- Reports (date-ranged, finance kept honest) ----------
router.get("/admin/reports/summary", requirePermission("reports.view"), ah(async (req, res) => {
  const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").safeParse;
  const fromRaw = typeof req.query.from === "string" ? req.query.from : "1970-01-01";
  const toRaw = typeof req.query.to === "string" ? req.query.to : "2100-01-01";
  if (!dateParam(fromRaw).success || !dateParam(toRaw).success) {
    return res.status(400).json({ error: "from/to must be YYYY-MM-DD dates" });
  }
  const from = fromRaw > toRaw ? toRaw : fromRaw;
  const to = fromRaw > toRaw ? fromRaw : toRaw;
  const totals = await query(
    `SELECT COUNT(*)::int AS bookings,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
            COUNT(*) FILTER (WHERE status = 'disputed')::int AS disputed
     FROM bookings WHERE created_at::date BETWEEN $1 AND $2`, [from, to]);
  const money = await query(
    `SELECT COALESCE(SUM(total_paisa), 0)::bigint AS gross,
            COALESCE(SUM(commission_paisa), 0)::bigint AS commission
     FROM commission_ledger cl JOIN bookings b ON b.id = cl.booking_id
     WHERE b.created_at::date BETWEEN $1 AND $2`, [from, to]);
  const cash = await query(
    `SELECT COALESCE(SUM(c.amount_paisa), 0)::bigint AS cash FROM cash_collections c
     JOIN bookings b ON b.id = c.booking_id WHERE b.created_at::date BETWEEN $1 AND $2`, [from, to]);
  const refunds = await query(
    `SELECT COALESCE(SUM(r.amount_paisa), 0)::bigint AS total FROM refunds r
     JOIN payments p ON p.id = r.payment_id JOIN bookings b ON b.id = p.booking_id
     WHERE r.created_at::date BETWEEN $1 AND $2`, [from, to]);
  const byDay = await query(
    `SELECT b.created_at::date AS day, COUNT(*)::int AS bookings,
            COUNT(*) FILTER (WHERE b.status = 'completed')::int AS completed
     FROM bookings b WHERE b.created_at::date BETWEEN $1 AND $2
     GROUP BY 1 ORDER BY 1`, [from, to]);
  const topServices = await query(
    `SELECT s.name, COUNT(*)::int AS jobs FROM bookings b JOIN services s ON s.id = b.service_id
     WHERE b.status = 'completed' AND b.created_at::date BETWEEN $1 AND $2
     GROUP BY s.name ORDER BY jobs DESC LIMIT 8`, [from, to]);
  const payments = await query(
    `SELECT provider, p.status, COUNT(*)::int AS n, COALESCE(SUM(amount_paisa), 0)::bigint AS total
     FROM payments p JOIN bookings b ON b.id = p.booking_id
     WHERE b.created_at::date BETWEEN $1 AND $2 GROUP BY provider, p.status`, [from, to]);
  const leaderboard = await query(
    `SELECT u.name, COUNT(*) FILTER (WHERE b.status = 'completed')::int AS completed,
            COALESCE(AVG(r.rating), 0)::float AS rating
     FROM users u JOIN bookings b ON b.worker_id = u.id
     LEFT JOIN reviews r ON r.booking_id = b.id
     WHERE b.created_at::date BETWEEN $1 AND $2
     GROUP BY u.name ORDER BY completed DESC LIMIT 8`, [from, to]);
  return res.json({
    totals: totals.rows[0],
    grossPaisa: money.rows[0].gross,
    commissionPaisa: money.rows[0].commission,
    cashPaisa: cash.rows[0].cash,
    refundsPaisa: refunds.rows[0].total,
    byDay: byDay.rows,
    topServices: topServices.rows,
    payments: payments.rows,
    leaderboard: leaderboard.rows,
  });
}));

// ---------- Commission ledger ----------
router.get("/admin/ledger", requirePermission("finance.view"), ah(async (req, res) => {
  const settled = typeof req.query.settled === "string" ? req.query.settled : "";
  const r = await query(
    `SELECT cl.*, b.booking_no, cu.name AS customer_name, w.name AS worker_name
     FROM commission_ledger cl JOIN bookings b ON b.id = cl.booking_id
     LEFT JOIN users cu ON cu.id = b.customer_id LEFT JOIN users w ON w.id = b.worker_id
     ${settled === "open" ? "WHERE cl.is_settled = false" : settled === "settled" ? "WHERE cl.is_settled = true" : ""}
     ORDER BY cl.created_at DESC LIMIT 200`);
  const cash = await query(
    `SELECT c.*, b.booking_no, u.name AS collector FROM cash_collections c
     JOIN bookings b ON b.id = c.booking_id LEFT JOIN users u ON u.id = c.collected_by
     ORDER BY c.created_at DESC LIMIT 200`);
  const settlements = await query(
    `SELECT s.*, u.name AS worker_name FROM settlements s JOIN users u ON u.id = s.worker_user_id
     ORDER BY s.created_at DESC LIMIT 200`);
  return res.json({ ledger: r.rows, cash: cash.rows, settlements: settlements.rows });
}));

// ---------- Reviews moderation ----------
router.get("/admin/reviews", requirePermission("reviews.view"), ah(async (_req, res) => {
  const r = await query(
    `SELECT r.*, b.booking_no, w.name AS worker_name, cu.name AS customer_name
     FROM reviews r JOIN bookings b ON b.id = r.booking_id
     LEFT JOIN users w ON w.id = r.worker_user_id LEFT JOIN users cu ON cu.id = r.customer_id
     ORDER BY r.created_at DESC LIMIT 200`);
  return res.json({ reviews: r.rows });
}));

router.delete("/admin/reviews/:id", requirePermission("reviews.moderate"), ah(async (req, res) => {
  const r = await query(`DELETE FROM reviews WHERE id = $1`, [req.params.id]);
  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "Review not found" });
  await adminAudit(req.user!.id, "review-delete", req.params.id);
  return res.json({ ok: true });
}));

// ---------- Broadcast (role audience, recorded per user) ----------
router.post(
  "/admin/notifications/broadcast",
  requirePermission("broadcast.send"),
  validate(z.object({
    audience: z.enum(["CUSTOMER", "WORKER", "ADMIN", "ALL"]),
    title: z.string().trim().min(4).max(120),
    body: z.string().trim().min(4).max(600),
  })),
  ah(async (req, res) => {
    const f = req.body as { audience: string; title: string; body: string };
    const r = await query<{ n: number }>(
      f.audience === "ALL"
        ? `INSERT INTO notifications(user_id, title, body) SELECT id, $1, $2 FROM users WHERE is_active = true RETURNING 1`
        : `INSERT INTO notifications(user_id, title, body)
           SELECT u.id, $2, $3 FROM users u JOIN user_roles ur ON ur.user_id = u.id
           JOIN roles r ON r.id = ur.role_id WHERE r.name = $1 AND u.is_active = true RETURNING 1`,
      f.audience === "ALL" ? [f.title, f.body] : [f.audience, f.title, f.body]);
    await adminAudit(req.user!.id, "broadcast", `${f.audience}: ${f.title} (${r.rowCount ?? 0})`);
    if (f.audience === "ALL") {
      void pushToAudience("ALL", { title: f.title, body: f.body, url: "/dashboard" });
    } else {
      void pushToAudience(f.audience as "CUSTOMER" | "WORKER" | "ADMIN", {
        title: f.title,
        body: f.body,
        url: f.audience === "WORKER" ? "/worker" : f.audience === "ADMIN" ? "/admin" : "/dashboard",
      });
    }
    return res.json({ ok: true, recipients: r.rowCount ?? 0 });
  }),
);

// ---------- Customer detail ----------
router.get("/admin/customers/:id", requirePermission("customers.view"), ah(async (req, res) => {
  const u = await query(`SELECT id, name, email, phone, is_active, created_at FROM users WHERE id = $1`, [req.params.id]);
  if (u.rowCount === 0) return res.status(404).json({ error: "Not found" });
  const bookings = await query(
    `SELECT b.*, s.name AS service_name FROM bookings b LEFT JOIN services s ON s.id = b.service_id
     WHERE b.customer_id = $1 ORDER BY b.created_at DESC LIMIT 50`, [req.params.id]);
  const rewards = await query(`SELECT COALESCE(SUM(points), 0)::int AS balance FROM reward_ledger WHERE user_id = $1`, [req.params.id]);
  const tickets = await query(`SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20`, [req.params.id]);
  const addresses = await query(`SELECT * FROM addresses WHERE user_id = $1`, [req.params.id]);
  return res.json({
    customer: u.rows[0],
    bookings: bookings.rows,
    rewardBalance: rewards.rows[0].balance,
    tickets: tickets.rows,
    addresses: addresses.rows,
  });
}));

router.post(
  "/admin/customers/:id/restrict",
  requirePermission("customers.manage"),
  validate(z.object({ active: z.boolean() })),
  ah(async (req, res) => {
    const f = req.body as { active: boolean };
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: "Invalid user id" });
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: "You cannot restrict your own account" });
    }
    // Restriction applies to customers only — staff and pro accounts are
    // managed through their own verify/activate/staff flows. This prevents a
    // sub-admin from suspending super-admins, staff, or pros.
    const target = await query<{ id: string }>(
      `SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id AND r.name = 'CUSTOMER'
       WHERE u.id = $1`, [req.params.id]);
    if ((target.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    await query(`UPDATE users SET is_active = $1 WHERE id = $2`, [f.active, req.params.id]);
    await adminAudit(req.user!.id, "customer-restrict", `${req.params.id} active=${f.active}`);
    return res.json({ ok: true });
  }),
);

// ---------- Catalog management ----------
router.get("/admin/services-all", requireAnyPermission("catalog.view", "catalog.edit", "worker.activate"), ah(async (_req, res) => {
  const r = await query(
    `SELECT s.*, c.name AS category_name, c.slug AS category_slug,
            (SELECT COUNT(*)::int FROM bookings WHERE service_id = s.id AND status = 'completed') AS jobs_done
     FROM services s LEFT JOIN categories c ON c.id = s.category_id ORDER BY c.sort_order, s.name`);
  const cats = await query(`SELECT * FROM categories ORDER BY sort_order`);
  return res.json({ services: r.rows, categories: cats.rows });
}));

router.put(
  "/admin/services/:id",
  requirePermission("catalog.edit"),
  validate(z.object({
    name: z.string().trim().min(3).max(120).optional(),
    description: z.string().max(2000).optional(),
    basePricePaisa: z.number().int().min(0).optional(),
    durationMin: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })),
  ah(async (req, res) => {
    const f = req.body as Record<string, string | number | boolean>;
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      name: "name", description: "description", basePricePaisa: "base_price_paisa",
      durationMin: "duration_min", isActive: "is_active",
    };
    for (const [k, col] of Object.entries(map)) {
      if (f[k] !== undefined) {
        params.push(f[k]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });
    params.push(req.params.id);
    const r = await query(`UPDATE services SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`, params);
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "Service not found" });
    await adminAudit(req.user!.id, "catalog-service-edit", `${req.params.id}: ${sets.join(", ")}`);
    return res.json({ ok: true });
  }),
);

// ---------- Payments lookup (for refunds) ----------
router.get("/admin/payments", requirePermission("finance.view"), ah(async (req, res) => {
  const booking = typeof req.query.booking === "string" ? req.query.booking : "";
  if (!booking) return res.status(400).json({ error: "booking required" });
  const bookingId = await resolveBookingId({ query }, booking);
  if (!bookingId) return res.status(404).json({ error: "Booking not found" });
  const r = await query(
    `SELECT p.*, b.booking_no FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.id = $1`, [bookingId]);
  const refunds = await query(
    `SELECT r.* FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.booking_id = $1`, [bookingId]);
  return res.json({ payments: r.rows, refunds: refunds.rows });
}));

// ---------- Quote pipeline ----------
router.get("/admin/quotes", requireAnyPermission("quotes.view", "quotes.approve"), ah(async (_req, res) => {
  const r = await query(
    `SELECT q.*, c.name AS category_name, cu.name AS customer_name,
       (SELECT json_agg(p ORDER BY p.created_at) FROM quote_proposals p WHERE p.request_id = q.id) AS proposals
     FROM quote_requests q LEFT JOIN categories c ON c.id = q.category_id
     LEFT JOIN users cu ON cu.id = q.customer_id
     ORDER BY q.created_at DESC LIMIT 100`);
  return res.json({ requests: r.rows });
}));

// ---------- Own capabilities (for panel gating) ----------
router.get("/admin/me/permissions", ah(async (req, res) => {
  const permissions = await effectivePermissions(req.user!.id);
  return res.json({ permissions, isSuperAdmin: isSuperAdmin(req.user!.roles) });
}));

// ---------- Sub-admins (super-admin only) ----------
const STAFF_PERM_GROUPS: { group: string; perms: string[] }[] = [
  { group: "Dispatch", perms: ["overview.view", "bookings.view", "bookings.assign", "workers.view", "customers.view"] },
  { group: "Workers", perms: ["workers.view", "worker.invite", "worker.verify", "worker.activate", "worker.assign"] },
  { group: "Customers & support", perms: ["customers.view", "customers.manage", "support.reply"] },
  { group: "Quotes", perms: ["quotes.view", "quotes.approve"] },
  { group: "Catalog & coverage", perms: ["catalog.view", "catalog.edit", "coverage.edit", "commission.edit"] },
  { group: "Finance", perms: ["finance.view", "finance.settle", "finance.refund", "reports.view"] },
  { group: "Growth", perms: ["rewards.view", "rewards.edit", "broadcast.send", "reviews.view", "reviews.moderate"] },
  { group: "Platform", perms: ["settings.view", "settings.edit", "audit.read", "reports.view"] },
];

router.get("/admin/permissions", requireSuperAdmin, ah(async (_req, res) => {
  const r = await query(`SELECT name FROM permissions ORDER BY name`);
  return res.json({ permissions: r.rows.map((x) => x.name), groups: STAFF_PERM_GROUPS });
}));

router.get("/admin/staff", requireSuperAdmin, ah(async (_req, res) => {
  const r = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.created_at,
            COALESCE(array_agg(p.name) FILTER (WHERE p.name IS NOT NULL), '{}') AS permissions
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id AND r.name = 'SUB_ADMIN'
     LEFT JOIN user_permissions up ON up.user_id = u.id
     LEFT JOIN permissions p ON p.id = up.permission_id
     GROUP BY u.id ORDER BY u.created_at DESC`,
  );
  return res.json({ staff: r.rows });
}));

const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(20),
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(8).max(128),
  permissions: z.array(z.string().trim().min(2).max(60)).min(1).max(40),
});

router.post(
  "/admin/staff",
  requireSuperAdmin,
  validate(staffCreateSchema),
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof staffCreateSchema>;
    const known = await query<{ name: string }>(`SELECT name FROM permissions`);
    const knownSet = new Set(known.rows.map((x) => x.name));
    if (f.permissions.includes("staff.manage")) {
      return res.status(400).json({ error: "staff.manage is reserved for super-admins" });
    }
    for (const p of f.permissions) {
      if (!knownSet.has(p)) return res.status(400).json({ error: `Unknown permission: ${p}` });
    }
    const hash = await bcrypt.hash(f.password, 12);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let userId: string;
      try {
        const u = await client.query<{ id: string }>(
          `INSERT INTO users(email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
          [f.email, hash, f.name, f.phone],
        );
        userId = u.rows[0].id;
      } catch (e) {
        if ((e as { code?: string }).code !== "23505") throw e;
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Email already registered" });
      }
      const subRole = await client.query<{ id: string }>(
        `INSERT INTO roles(name) VALUES ('SUB_ADMIN') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      );
      await client.query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
        userId, subRole.rows[0].id,
      ]);
      for (const p of new Set(f.permissions)) {
        await client.query(
          `INSERT INTO user_permissions(user_id, permission_id, granted_by)
           VALUES ($1, (SELECT id FROM permissions WHERE name = $2), $3) ON CONFLICT DO NOTHING`,
          [userId, p, req.user!.id],
        );
      }
      await client.query("COMMIT");
      await adminAudit(req.user!.id, "staff-create", `${f.email} [${f.permissions.join(", ")}]`);
      return res.status(201).json({ ok: true, id: userId });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

const staffPatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  password: z.string().min(8).max(128).optional(),
  isActive: z.boolean().optional(),
  permissions: z.array(z.string().trim().min(2).max(60)).min(1).max(40).optional(),
});

router.patch(
  "/admin/staff/:id",
  requireSuperAdmin,
  validate(staffPatchSchema),
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof staffPatchSchema>;
    const target = await query<{ id: string }>(
      `SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id AND r.name = 'SUB_ADMIN' WHERE u.id = $1`,
      [req.params.id],
    );
    if (target.rowCount === 0) return res.status(404).json({ error: "Sub-admin not found" });
    if (f.permissions) {
      if (f.permissions.includes("staff.manage")) {
        return res.status(400).json({ error: "staff.manage is reserved for super-admins" });
      }
      const known = await query<{ name: string }>(`SELECT name FROM permissions`);
      const knownSet = new Set(known.rows.map((x) => x.name));
      for (const p of f.permissions) {
        if (!knownSet.has(p)) return res.status(400).json({ error: `Unknown permission: ${p}` });
      }
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (f.name !== undefined || f.phone !== undefined || f.isActive !== undefined) {
        const sets: string[] = [];
        const params: unknown[] = [];
        if (f.name !== undefined) { params.push(f.name); sets.push(`name = $${params.length}`); }
        if (f.phone !== undefined) { params.push(f.phone); sets.push(`phone = $${params.length}`); }
        if (f.isActive !== undefined) { params.push(f.isActive); sets.push(`is_active = $${params.length}`); }
        if (sets.length > 0) {
          params.push(req.params.id);
          await client.query(`UPDATE users SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`, params);
        }
      }
      if (f.password) {
        const hash = await bcrypt.hash(f.password, 12);
        // Bump the session version so any existing sessions for this staff
        // account die immediately — a reset locks out whoever held them.
        await client.query(
          `UPDATE users SET password_hash = $1, password_changed_at = now(), updated_at = now() WHERE id = $2`,
          [hash, req.params.id]);
      }
      if (f.permissions) {
        await client.query(`DELETE FROM user_permissions WHERE user_id = $1`, [req.params.id]);
        for (const p of new Set(f.permissions)) {
          await client.query(
            `INSERT INTO user_permissions(user_id, permission_id, granted_by)
             VALUES ($1, (SELECT id FROM permissions WHERE name = $2), $3) ON CONFLICT DO NOTHING`,
            [req.params.id, p, req.user!.id],
          );
        }
      }
      await client.query("COMMIT");
      await adminAudit(req.user!.id, "staff-update", `${req.params.id}`);
      return res.json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

router.delete("/admin/staff/:id", requireSuperAdmin, ah(async (req, res) => {
  // Destructive deletes would orphan audit rows — revoke access instead of deleting.
  const target = await query(
    `SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id AND r.name = 'SUB_ADMIN' WHERE u.id = $1`,
    [req.params.id],
  );
  if (target.rowCount === 0) return res.status(404).json({ error: "Sub-admin not found" });
  await query(`UPDATE users SET is_active = false WHERE id = $1`, [req.params.id]);
  await query(`DELETE FROM user_permissions WHERE user_id = $1`, [req.params.id]);
  await adminAudit(req.user!.id, "staff-revoke", req.params.id);
  return res.json({ ok: true });
}));

export default router;
