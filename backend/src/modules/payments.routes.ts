import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth } from "../middleware/auth.js";
import { bookingKey } from "../utils/lookup.js";
import {
  esewaInitiate,
  esewaStatusCheck,
  esewaVerifyCallback,
  khaltiInitiate,
  khaltiLookup,
  providers,
} from "../services/payments.js";

const router = Router();

router.get(
  "/payments/providers",
  ah(async (_req, res) => {
    return res.json(providers());
  }),
);

/** Shared verified-marking with idempotency: second delivery is a no-op success. */
async function markVerified(paymentId: string, providerRef: string, raw: unknown) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const p = await client.query(
      `SELECT id, booking_id, amount_paisa, status FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId],
    );
    if (p.rowCount === 0) {
      await client.query("ROLLBACK");
      return { code: 404 as const };
    }
    const pay = p.rows[0] as { id: string; booking_id: string; amount_paisa: string; status: string };
    if (pay.status === "verified") {
      await client.query("COMMIT");
      return { code: 200 as const, already: true };
    }
    // Provider refs must be unique across payments (duplicate-callback guard).
    const dupe = await client.query(`SELECT id FROM payments WHERE provider_ref = $1 AND id <> $2`, [
      providerRef,
      paymentId,
    ]);
    if ((dupe.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      return { code: 409 as const };
    }
    await client.query(
      `UPDATE payments SET status = 'verified', provider_ref = $1, raw = $2, verified_at = now() WHERE id = $3`,
      [providerRef, JSON.stringify(raw ?? {}), paymentId],
    );
    await client.query(`UPDATE bookings SET payment_status = 'paid', updated_at = now() WHERE id = $1`, [
      pay.booking_id,
    ]);
    await client.query(
      `INSERT INTO booking_events(booking_id, status, by_role, note)
       SELECT $1, status, 'admin', 'Online payment verified' FROM bookings WHERE id = $1`,
      [pay.booking_id],
    );
    await client.query("COMMIT");
    return { code: 200 as const };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

const cashSchema = z.object({ amountPaisa: z.number().int().positive() });

// Assigned worker (or admin) records cash collected from the customer.
router.post(
  "/bookings/:id/cash-collect",
  requireAuth,
  validate(cashSchema),
  ah(async (req, res) => {
    const { amountPaisa } = req.body as z.infer<typeof cashSchema>;
    const key = bookingKey(req.params.id);
    if (!key) return res.status(400).json({ error: "Invalid request" });
    const r = await query<{
      id: string;
      customer_id: string;
      worker_id: string | null;
      status: string;
      estimate_paisa: string;
      final_paisa: string | null;
      payment_method: string;
    }>(`SELECT * FROM bookings WHERE ${key.column} = $1`, [key.value]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const b = r.rows[0];
    const roles = req.user!.roles;
    const allowed =
      roles.includes("ADMIN") || (roles.includes("WORKER") && b.worker_id === req.user!.id);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
    if (b.payment_method !== "cash") return res.status(400).json({ error: "Not a cash booking" });
    const due = Number(b.final_paisa ?? b.estimate_paisa);
    if (amountPaisa !== due) {
      return res.status(400).json({ error: `Collect exactly Rs ${(due / 100).toLocaleString("en-IN")}` });
    }
    const p = await query<{ id: string; status: string }>(
      `SELECT id, status FROM payments WHERE booking_id = $1 AND provider = 'cash' ORDER BY created_at DESC LIMIT 1`,
      [b.id],
    );
    if (p.rowCount === 0) return res.status(409).json({ error: "No cash payment record" });
    if (p.rows[0].status === "verified") return res.status(409).json({ error: "Already recorded" });
    const out = await markVerified(p.rows[0].id, `cash-${b.id}`, { collectedBy: req.user!.id });
    if (out.code !== 200) return res.status(out.code).json({ error: "Could not record payment" });
    await query(
      `INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, $2, 'cash-collect', $3)`,
      [req.user!.id, roles.includes("ADMIN") ? "ADMIN" : "WORKER", `Cash Rs ${due / 100} for booking ${b.id}`],
    );
    return res.json({ ok: true });
  }),
);

const esewaInitSchema = z.object({
  successUrl: z.string().url(),
  failureUrl: z.string().url(),
});

router.post(
  "/payments/:id/esewa/initiate",
  requireAuth,
  validate(esewaInitSchema),
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof esewaInitSchema>;
    const r = await query<{ id: string; booking_id: string; amount_paisa: string; status: string }>(
      `SELECT id, booking_id, amount_paisa, status FROM payments WHERE id = $1`,
      [req.params.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const pay = r.rows[0];
    const b = await query<{ customer_id: string }>(`SELECT customer_id FROM bookings WHERE id = $1`, [
      pay.booking_id,
    ]);
    if (b.rows[0]?.customer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
    try {
      const uuid = `${pay.booking_id.slice(0, 8)}-${Date.now().toString(36)}`;
      const out = esewaInitiate({
        amountPaisa: Number(pay.amount_paisa),
        transactionUuid: uuid,
        successUrl: f.successUrl,
        failureUrl: f.failureUrl,
      });
      await query(`UPDATE payments SET provider_ref = $1 WHERE id = $2`, [uuid, pay.id]);
      return res.json(out);
    } catch {
      return res.status(503).json({ error: "eSewa not configured — use cash for now" });
    }
  }),
);

// eSewa server-to-server result. Never trust the redirect alone: the status
// check below is the source of truth.
router.post(
  "/payments/esewa/callback",
  ah(async (req, res) => {
    const body = req.body as Record<string, string>;
    if (!esewaVerifyCallback(body)) return res.status(400).json({ error: "Invalid signature" });
    const decoded = JSON.parse(Buffer.from(body.data, "base64").toString("utf8")) as {
      transaction_uuid: string;
      total_amount: string;
    };
    const ok = await esewaStatusCheck(decoded.total_amount, decoded.transaction_uuid);
    if (!ok) return res.status(402).json({ error: "Payment not complete upstream" });
    const p = await query<{ id: string; amount_paisa: string }>(
      `SELECT id, amount_paisa FROM payments WHERE provider_ref = $1`,
      [decoded.transaction_uuid],
    );
    if (p.rowCount === 0) return res.status(404).json({ error: "Unknown payment" });
    const expected = Math.floor(Number(decoded.total_amount) * 100);
    if (Number(p.rows[0].amount_paisa) !== expected) {
      return res.status(400).json({ error: "Amount mismatch" });
    }
    const out = await markVerified(p.rows[0].id, decoded.transaction_uuid, decoded);
    return res.json({ ok: true, already: out.already ?? false });
  }),
);

const khaltiInitSchema = z.object({
  returnUrl: z.string().url(),
  websiteUrl: z.string().url(),
  purchaseOrderName: z.string().max(120).default("Workers booking"),
});

router.post(
  "/payments/:id/khalti/initiate",
  requireAuth,
  validate(khaltiInitSchema),
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof khaltiInitSchema>;
    const p = await query<{ id: string; booking_id: string; amount_paisa: string }>(
      `SELECT id, booking_id, amount_paisa FROM payments WHERE id = $1`,
      [req.params.id],
    );
    if (p.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const pay = p.rows[0];
    const b = await query<{ customer_id: string }>(`SELECT customer_id FROM bookings WHERE id = $1`, [
      pay.booking_id,
    ]);
    if (b.rows[0]?.customer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
    try {
      const out = await khaltiInitiate({
        amountPaisa: Number(pay.amount_paisa),
        purchaseOrderId: pay.booking_id,
        purchaseOrderName: f.purchaseOrderName,
        returnUrl: f.returnUrl,
        websiteUrl: f.websiteUrl,
      });
      await query(`UPDATE payments SET provider_ref = $1, raw = $2 WHERE id = $3`, [
        out.pidx,
        JSON.stringify({ pidx: out.pidx }),
        pay.id,
      ]);
      return res.json(out);
    } catch {
      return res.status(503).json({ error: "Khalti not configured — use cash for now" });
    }
  }),
);

const khaltiVerifySchema = z.object({ pidx: z.string().min(1) });

router.post(
  "/payments/khalti/verify",
  requireAuth,
  validate(khaltiVerifySchema),
  ah(async (req, res) => {
    const { pidx } = req.body as z.infer<typeof khaltiVerifySchema>;
    const p = await query<{ id: string; booking_id: string; amount_paisa: string }>(
      `SELECT id, booking_id, amount_paisa FROM payments WHERE provider_ref = $1`,
      [pidx],
    );
    if (p.rowCount === 0) return res.status(404).json({ error: "Unknown payment" });
    const pay = p.rows[0];
    const hit = await khaltiLookup(pidx);
    if (!hit.completed || hit.amountPaisa !== Number(pay.amount_paisa)) {
      return res.status(402).json({ error: "Payment not complete upstream" });
    }
    const out = await markVerified(pay.id, pidx, { pidx });
    return res.json({ ok: true, already: out.already ?? false });
  }),
);

export default router;
