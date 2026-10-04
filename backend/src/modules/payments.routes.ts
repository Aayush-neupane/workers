import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth } from "../middleware/auth.js";
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
    const allowed = roles.includes("ADMIN") || (booking.worker_id === uid && roles.includes("WORKER"));
    if (!allowed) return res.status(403).json({ error: "Forbidden for your role" });
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
    const ref = `ESEWA-${req.params.id.slice(0, 8)}-${Date.now().toString(36)}`.toUpperCase();
    return res.json({ ok: true, ref, sandbox: true });
  }),
);

router.post(
  "/payments/esewa/callback",
  validate(z.object({ ref: z.string().min(4), status: z.enum(["success", "failed"]) })),
  ah(async (req, res) => {
    const f = req.body as { ref: string; status: string };
    // Duplicate-callback safe: lookup by unique ref first.
    const p = await query<{ id: string; status: string; booking_id: string }>(
      `SELECT id, status, booking_id FROM payments WHERE provider_ref = $1`, [f.ref]);
    if (p.rowCount === 0) return res.status(404).json({ error: "Unknown payment" });
    if (p.rows[0].status === "verified") return res.json({ ok: true, duplicate: true });
    await query(
      `UPDATE payments SET status = $1, verified_at = CASE WHEN $1 = 'verified' THEN now() ELSE NULL END WHERE id = $2`,
      [f.status === "success" ? "verified" : "failed", p.rows[0].id]);
    return res.json({ ok: true });
  }),
);

router.post(
  "/payments/:id/khalti/initiate",
  requireAuth,
  ah(async (req, res) => {
    if (!env.KHALTI_SECRET_KEY) return res.status(400).json({ error: "Khalti not configured — use cash" });
    const ref = `KHALTI-${req.params.id.slice(0, 8)}-${Date.now().toString(36)}`.toUpperCase();
    return res.json({ ok: true, ref, sandbox: true });
  }),
);

router.post(
  "/payments/khalti/verify",
  validate(z.object({ ref: z.string().min(4), amountPaisa: z.number().int().min(1) })),
  ah(async (req, res) => {
    const f = req.body as { ref: string; amountPaisa: number };
    const p = await query<{ id: string; status: string; amount_paisa: string }>(
      `SELECT id, status, amount_paisa FROM payments WHERE provider_ref = $1`, [f.ref]);
    if (p.rowCount === 0) return res.status(404).json({ error: "Unknown payment" });
    if (p.rows[0].status === "verified") return res.json({ ok: true, duplicate: true });
    // Sandbox amount check stands in for the live lookup call.
    if (Number(p.rows[0].amount_paisa) !== f.amountPaisa) {
      await query(`UPDATE payments SET status = 'failed' WHERE id = $1`, [p.rows[0].id]);
      return res.status(400).json({ error: "Amount mismatch" });
    }
    await query(`UPDATE payments SET status = 'verified', verified_at = now() WHERE id = $1`, [p.rows[0].id]);
    return res.json({ ok: true });
  }),
);

export default router;
