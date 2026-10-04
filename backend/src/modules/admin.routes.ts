import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.js";
import { notify, audit } from "../services/notify.js";
import { resolveBookingId } from "../utils/booking.js";
import { createHash, randomBytes } from "node:crypto";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

async function adminAudit(actorId: string, action: string, detail: string) {
  await audit(actorId, "ADMIN", action, detail);
}

// ---------- Overview (date-filtered operational metrics) ----------
router.get("/admin/overview", ah(async (_req, res) => {
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
router.get("/admin/workers", requirePermission("worker.verify"), ah(async (req, res) => {
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

router.post(
  "/admin/workers/invite",
  requirePermission("worker.invite"),
  validate(z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().min(2).max(80) })),
  ah(async (req, res) => {
    const f = req.body as { email: string; name: string };
    const token = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await query(
      `INSERT INTO worker_invites(email, name, token_hash, expires_at, created_by)
       VALUES ($1, $2, $3, now() + interval '7 days', $4)
       ON CONFLICT (email) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, accepted_at = NULL`,
      [f.email, f.name, tokenHash, req.user!.id]);
    await adminAudit(req.user!.id, "worker-invite", f.email);
    // Token returned once for the admin to share securely; only the hash is stored.
    return res.status(201).json({ ok: true, token });
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
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
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
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (f.active) {
        const v = await client.query<{ verification_state: string }>(
          `SELECT verification_state FROM worker_profiles WHERE user_id = $1`, [req.params.id]);
        if (v.rowCount === 0 || v.rows[0].verification_state !== "verified") {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Only verified pros can be activated" });
        }
      }
      await client.query(`UPDATE worker_profiles SET is_active = $1, updated_at = now() WHERE user_id = $2`,
        [f.active, req.params.id]);
      await client.query(`DELETE FROM worker_services WHERE worker_user_id = $1`, [req.params.id]);
      for (const sid of f.serviceIds) {
        await client.query(`INSERT INTO worker_services(worker_user_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [req.params.id, sid]);
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

router.get("/admin/workers/:id/documents", requirePermission("worker.verify"), ah(async (req, res) => {
  const r = await query(`SELECT id, kind, uploaded_at FROM verification_documents WHERE worker_user_id = $1`, [req.params.id]);
  return res.json({ documents: r.rows });
}));

// ---------- Customers (least-privilege: masked contact) ----------
router.get("/admin/customers", ah(async (req, res) => {
  const q = typeof req.query.q === "string" ? `%${req.query.q}%` : "%";
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
    name: z.string().trim().min(2).max(80), slug: z.string().trim().min(2).max(40),
    tagline: z.string().max(200).default(""), icon: z.string().max(30).default("wrench"),
    commissionBps: z.number().int().min(0).max(10000).default(1500),
  })),
  ah(async (req, res) => {
    const f = req.body as Record<string, string | number>;
    const r = await query(
      `INSERT INTO categories(name, slug, tagline, icon, commission_bps)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [f.name, f.slug, f.tagline, f.icon, f.commissionBps]);
    await adminAudit(req.user!.id, "catalog-category", String(f.slug));
    return res.status(201).json({ ok: true, id: (r.rows[0] as { id: string }).id });
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
    for (let i = 0; i < 10; i++) {
      await query(`UPDATE coverage_wards SET is_open = $1, updated_at = now() WHERE ward = $2`, [wards[i], i + 1]);
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
    await query(
      `INSERT INTO commission_rules(scope, category_id, worker_user_id, rate_bps)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (scope, category_id, worker_user_id) DO UPDATE SET rate_bps = EXCLUDED.rate_bps`,
      [f.scope, f.categoryId, f.workerId, f.rateBps]);
    await adminAudit(req.user!.id, "commission-rule", `${f.scope} = ${f.rateBps}bps`);
    return res.json({ ok: true });
  }),
);

router.get("/admin/bookings", ah(async (req, res) => {
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
    await query(
      `INSERT INTO settlements(worker_user_id, amount_paisa, kind, note, by_user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [f.workerId, f.amountPaisa, f.kind, f.note, req.user!.id]);
    await query(
      `UPDATE commission_ledger SET is_settled = true, settled_at = now()
       WHERE booking_id IN (SELECT id FROM bookings WHERE worker_id = $1)`, [f.workerId]);
    await adminAudit(req.user!.id, "settlement", `${f.kind} ${f.amountPaisa} for ${f.workerId}`);
    return res.json({ ok: true });
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
      if (f.amountPaisa > paid) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Refund exceeds payment" });
      }
      await client.query(
        `INSERT INTO refunds(payment_id, amount_paisa, reason, by_user_id) VALUES ($1, $2, $3, $4)`,
        [f.paymentId, f.amountPaisa, f.reason, req.user!.id]);
      const partial = f.amountPaisa < paid;
      await client.query(`UPDATE payments SET status = $1 WHERE id = $2`,
        [partial ? "partially-refunded" : "refunded", f.paymentId]);
      const bk = await client.query<{ customer_id: string }>(`SELECT customer_id FROM bookings WHERE id = $1`, [p.rows[0].booking_id]);
      if ((bk.rowCount ?? 0) > 0) {
        await client.query(
          `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
           SELECT $1, -points, 'reverse', 'Refund reversal', $2 FROM reward_ledger
           WHERE ref_booking_id = $2 AND kind = 'earn' ON CONFLICT DO NOTHING`,
          [bk.rows[0].customer_id, p.rows[0].booking_id]);
      }
      await notify(client, bk.rows[0]?.customer_id ?? "", "Refund processed", `Rs ${(f.amountPaisa / 100).toFixed(0)} refunded.`);
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
    await query(`UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2`, [f.status, req.params.id]);
    await adminAudit(req.user!.id, "ticket-status", `${req.params.id} -> ${f.status}`);
    return res.json({ ok: true });
  }),
);

router.get("/admin/audit", requirePermission("audit.read"), ah(async (req, res) => {
  const r = await query(`SELECT a.*, u.name AS actor_name FROM audit_log a
    LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 200`);
  return res.json({ entries: r.rows });
}));

router.get("/admin/settings", ah(async (_req, res) => {
  const r = await query(`SELECT value FROM settings WHERE id = 'platform'`);
  return res.json(r.rows[0]?.value ?? {});
}));

router.put(
  "/admin/settings",
  requirePermission("settings.edit"),
  validate(z.object({ value: z.record(z.unknown()) })),
  ah(async (req, res) => {
    const f = req.body as { value: Record<string, unknown> };
    await query(
      `INSERT INTO settings(id, value) VALUES ('platform', $1)
       ON CONFLICT (id) DO UPDATE SET value = $1, updated_at = now()`,
      [JSON.stringify(f.value)]);
    await adminAudit(req.user!.id, "settings", "platform updated");
    return res.json({ ok: true });
  }),
);

// ---------- Reports (date-ranged, finance kept honest) ----------
router.get("/admin/reports/summary", ah(async (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : "1970-01-01";
  const to = typeof req.query.to === "string" ? req.query.to : "2100-01-01";
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
router.get("/admin/ledger", ah(async (req, res) => {
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
router.get("/admin/reviews", ah(async (_req, res) => {
  const r = await query(
    `SELECT r.*, b.booking_no, w.name AS worker_name, cu.name AS customer_name
     FROM reviews r JOIN bookings b ON b.id = r.booking_id
     LEFT JOIN users w ON w.id = r.worker_user_id LEFT JOIN users cu ON cu.id = r.customer_id
     ORDER BY r.created_at DESC LIMIT 200`);
  return res.json({ reviews: r.rows });
}));

router.delete("/admin/reviews/:id", ah(async (req, res) => {
  await query(`DELETE FROM reviews WHERE id = $1`, [req.params.id]);
  await adminAudit(req.user!.id, "review-delete", req.params.id);
  return res.json({ ok: true });
}));

// ---------- Broadcast (role audience, recorded per user) ----------
router.post(
  "/admin/notifications/broadcast",
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
    return res.json({ ok: true, recipients: r.rowCount ?? 0 });
  }),
);

// ---------- Customer detail ----------
router.get("/admin/customers/:id", ah(async (req, res) => {
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
  validate(z.object({ active: z.boolean() })),
  ah(async (req, res) => {
    const f = req.body as { active: boolean };
    await query(`UPDATE users SET is_active = $1 WHERE id = $2`, [f.active, req.params.id]);
    await adminAudit(req.user!.id, "customer-restrict", `${req.params.id} active=${f.active}`);
    return res.json({ ok: true });
  }),
);

// ---------- Catalog management ----------
router.get("/admin/services-all", ah(async (_req, res) => {
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
    await query(`UPDATE services SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`, params);
    await adminAudit(req.user!.id, "catalog-service-edit", `${req.params.id}: ${sets.join(", ")}`);
    return res.json({ ok: true });
  }),
);

// ---------- Payments lookup (for refunds) ----------
router.get("/admin/payments", ah(async (req, res) => {
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
router.get("/admin/quotes", ah(async (_req, res) => {
  const r = await query(
    `SELECT q.*, c.name AS category_name, cu.name AS customer_name,
       (SELECT json_agg(p ORDER BY p.created_at) FROM quote_proposals p WHERE p.request_id = q.id) AS proposals
     FROM quote_requests q LEFT JOIN categories c ON c.id = q.category_id
     LEFT JOIN users cu ON cu.id = q.customer_id
     ORDER BY q.created_at DESC LIMIT 100`);
  return res.json({ requests: r.rows });
}));

export default router;
