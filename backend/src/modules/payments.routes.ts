import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, effectivePermissions } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { resolveBookingId } from "../utils/booking.js";

const router = Router();

router.get("/payments/providers", ah(async (_req, res) => {
  return res.json({
    cash: true,
    esewa: Boolean(env.ESEWA_MERCHANT_CODE),
    khalti: Boolean(env.KHALTI_SECRET_KEY),
    note: "Online providers appear only after merchant configuration.",
  });
}));

/** Worker confirms cash received on site. One record per booking. */
router.post(
  "/bookings/:id/cash-collect",
  requireAuth,
  validate(z.object({ amountPaisa: z.number().int().min(1) })),
  ah(async (req, res) => {
    const f = req.body as { amountPaisa: number };
    const uid = req.user!.id;
    const roles = req.user!.roles;
    const bookingId = await resolveBookingId({ query }, req.params.id);
    if (!bookingId) return res.status(404).json({ error: "Not found" });
    const b = await query<{ id: string; worker_id: string | null; status: string }>(
      `SELECT id, worker_id, status FROM bookings WHERE id = $1`, [bookingId]);
    if (b.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const booking = b.rows[0];
    const isSuper = roles.includes("ADMIN");
    const isStaff = !isSuper && roles.includes("SUB_ADMIN") &&
      (await effectivePermissions(uid)).includes("bookings.assign");
    const allowed = isSuper || isStaff || (booking.worker_id === uid && roles.includes("WORKER"));
    if (!allowed) return res.status(403).json({ error: "Forbidden for your role" });
    // Cash only, on an active cash booking, for the outstanding amount.
    const full = await query(
      `SELECT b.payment_method, b.status, b.estimate_paisa, b.discount_paisa, b.final_paisa
       FROM bookings b WHERE b.id = $1`, [booking.id]);
    if ((full.rowCount ?? 0) === 0) return res.status(404).json({ error: "Not found" });
    const row = full.rows[0];
    if (row.payment_method !== "cash") {
      return res.status(400).json({ error: "No cash payment expected for this booking" });
    }
    const outstanding = row.final_paisa != null
      ? Number(row.final_paisa)
      : Math.max(0, Number(row.estimate_paisa) - Number(row.discount_paisa ?? 0));
    if (!["confirmed", "en-route", "in-progress", "awaiting-confirmation", "completed"].includes(row.status)) {
      return res.status(409).json({ error: `Cash cannot be collected while ${row.status}` });
    }
    if (f.amountPaisa !== outstanding) {
      return res.status(400).json({ error: `Collect exactly Rs ${(outstanding / 100).toFixed(0)}` });
    }
    try {
      await query(
        `INSERT INTO cash_collections(booking_id, amount_paisa, collected_by) VALUES ($1, $2, $3)`,
        [booking.id, f.amountPaisa, uid]);
      return res.status(201).json({ ok: true });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        return res.status(409).json({ error: "Already recorded" });
      }
      throw e;
    }
  }),
);

/**
 * Sandbox online-payment flow. Initiate records a pending payment with a
 * unique provider ref; verify marks it verified idempotently.
 * Frontend success is never trusted — only this server-side step counts.
 * Live gateway signing lands here after merchant approval (keys empty now).
 */
router.post(
  "/payments/:id/esewa/initiate",
  requireAuth,
  ah(async (req, res) => {
    if (!env.ESEWA_MERCHANT_CODE) return res.status(400).json({ error: "eSewa not configured — use cash" });
    const bookingId = await resolveBookingId({ query }, req.params.id);
    if (!bookingId) return res.status(404).json({ error: "Not found" });
    const b = await query<{ customer_id: string }>(
      `SELECT customer_id FROM bookings WHERE id = $1`, [bookingId]);
    if ((b.rowCount ?? 0) === 0) return res.status(404).json({ error: "Not found" });
    const mine = b.rows[0].customer_id === req.user!.id || req.user!.roles.includes("ADMIN");
    if (!mine) return res.status(403).json({ error: "Forbidden" });
    const ref = `ESEWA-${bookingId.slice(0, 8)}-${Date.now().toString(36)}`.toUpperCase();
    // Record the ref up front so the callback can only transition a payment
    // this server created — never a client-invented one.
    await query(
      `UPDATE payments SET provider_ref = $1 WHERE booking_id = $2 AND provider = 'esewa' AND status = 'pending'`,
      [ref, bookingId]);
    return res.json({ ok: true, ref, sandbox: true });
  }),
);

router.post(
  "/payments/esewa/callback",
  validate(z.object({ ref: z.string().min(4), status: z.enum(["success", "failed"]) })),
  ah(async (req, res) => {
    const f = req.body as { ref: string; status: string };
    // Live gateway integration MUST verify this callback server-to-server
    // (transaction lookup with the merchant secret + HMAC) before trusting
    // it. Until then only previously-recorded pending refs can transition.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const p = await client.query<{ id: string; status: string; booking_id: string }>(
        `SELECT id, status, booking_id FROM payments WHERE provider_ref = $1 FOR UPDATE`, [f.ref]);
      if ((p.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Unknown payment" });
      }
      if (p.rows[0].status === "verified") return res.json({ ok: true, duplicate: true });
      if (p.rows[0].status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: `Payment is ${p.rows[0].status} — cannot transition` });
      }
      await client.query(
        `UPDATE payments SET status = $1, verified_at = CASE WHEN $1 = 'verified' THEN now() ELSE NULL END WHERE id = $2`,
        [f.status === "success" ? "verified" : "failed", p.rows[0].id]);
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
  "/payments/:id/khalti/initiate",
  requireAuth,
  ah(async (req, res) => {
    if (!env.KHALTI_SECRET_KEY) return res.status(400).json({ error: "Khalti not configured — use cash" });
    const bookingId = await resolveBookingId({ query }, req.params.id);
    if (!bookingId) return res.status(404).json({ error: "Not found" });
    const b = await query<{ customer_id: string }>(
      `SELECT customer_id FROM bookings WHERE id = $1`, [bookingId]);
    if ((b.rowCount ?? 0) === 0) return res.status(404).json({ error: "Not found" });
    const mine = b.rows[0].customer_id === req.user!.id || req.user!.roles.includes("ADMIN");
    if (!mine) return res.status(403).json({ error: "Forbidden" });
    const ref = `KHALTI-${bookingId.slice(0, 8)}-${Date.now().toString(36)}`.toUpperCase();
    await query(
      `UPDATE payments SET provider_ref = $1 WHERE booking_id = $2 AND provider = 'khalti' AND status = 'pending'`,
      [ref, bookingId]);
    return res.json({ ok: true, ref, sandbox: true });
  }),
);

router.post(
  "/payments/khalti/verify",
  validate(z.object({ ref: z.string().min(4), amountPaisa: z.number().int().min(1) })),
  ah(async (req, res) => {
    const f = req.body as { ref: string; amountPaisa: number };
    // Same live-verification requirement as the eSewa callback above.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const p = await client.query<{ id: string; status: string; amount_paisa: string }>(
        `SELECT id, status, amount_paisa FROM payments WHERE provider_ref = $1 FOR UPDATE`, [f.ref]);
      if ((p.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Unknown payment" });
      }
      if (p.rows[0].status === "verified") return res.json({ ok: true, duplicate: true });
      if (p.rows[0].status !== "pending") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: `Payment is ${p.rows[0].status} — cannot transition` });
      }
      // Sandbox amount check stands in for the live lookup call.
      if (Number(p.rows[0].amount_paisa) !== f.amountPaisa) {
        await client.query(`UPDATE payments SET status = 'failed' WHERE id = $1`, [p.rows[0].id]);
        await client.query("COMMIT");
        return res.status(400).json({ error: "Amount mismatch" });
      }
      await client.query(`UPDATE payments SET status = 'verified', verified_at = now() WHERE id = $1`, [p.rows[0].id]);
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
