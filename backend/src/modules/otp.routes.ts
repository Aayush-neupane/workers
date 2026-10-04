import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth } from "../middleware/auth.js";
import { calcCommission } from "../utils/money.js";
import { generateOtp, hashOtp, otpExpiry, OTP_MAX_ATTEMPTS } from "../utils/otp.js";
import { notify } from "../services/notify.js";

const router = Router();

/**
 * Issue the completion code. Called by the assigned pro (or admin) when the
 * work is done. Moves in-progress → awaiting-confirmation and delivers the
 * code ONLY to the customer (in-app today, SMS when configured).
 */
router.post("/bookings/:id/otp/issue", requireAuth, ah(async (req, res) => {
  const id = req.params.id;
  const uid = req.user!.id;
  const roles = req.user!.roles;
  const isAdmin = roles.includes("ADMIN");
  const r = await query<{
    id: string; status: string; customer_id: string; worker_id: string | null;
  }>(`SELECT id, status, customer_id, worker_id FROM bookings WHERE id = $1 OR booking_no = $1`, [id]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
  const b = r.rows[0];
  const isWorker = b.worker_id === uid && roles.includes("WORKER");
  if (!isAdmin && !isWorker) return res.status(403).json({ error: "Only the assigned pro can issue the code" });
  if (b.status !== "in-progress") {
    return res.status(409).json({ error: `Code can only be issued while in progress (now: ${b.status})` });
  }
  const code = generateOtp();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE booking_otps SET consumed_at = now() WHERE booking_id = $1 AND consumed_at IS NULL`, [b.id]);
    await client.query(
      `INSERT INTO booking_otps(booking_id, code_hash, expires_at) VALUES ($1, $2, $3)`,
      [b.id, hashOtp(code), otpExpiry()]);
    await client.query(`UPDATE bookings SET status = 'awaiting-confirmation', updated_at = now() WHERE id = $1`, [b.id]);
    await client.query(
      `INSERT INTO booking_events(booking_id, status, by_role, by_user_id, note)
       VALUES ($1, 'awaiting-confirmation', $2, $3, 'Completion code issued')`,
      [b.id, isAdmin ? "admin" : "worker", uid]);
    // Delivery channel today: in-app notification. SMS attaches here later.
    // The code is never returned to the issuer — only the customer sees it.
    await notify(client, b.customer_id, "Completion code",
      `Share this code with your pro only when the work is done: ${code}. Valid 10 minutes. (Demo delivery — SMS when configured.)`);
    await client.query("COMMIT");
    return res.json({ ok: true, delivered: true, attemptsAllowed: OTP_MAX_ATTEMPTS });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

/**
 * Verify the code. Called by the assigned pro (or admin) with the code the
 * customer reads out. Correct → completed + commission + rewards.
 */
router.post(
  "/bookings/:id/otp/verify",
  requireAuth,
  validate(z.object({ code: z.string().regex(/^\d{6}$/, "6-digit code required") })),
  ah(async (req, res) => {
    const id = req.params.id;
    const { code } = req.body as { code: string };
    const uid = req.user!.id;
    const roles = req.user!.roles;
    const isAdmin = roles.includes("ADMIN");
    const r = await query<{
      id: string; status: string; customer_id: string; worker_id: string | null;
      estimate_paisa: string; commission_bps: number;
    }>(`SELECT * FROM bookings WHERE id = $1 OR booking_no = $1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const b = r.rows[0];
    const isWorker = b.worker_id === uid && roles.includes("WORKER");
    if (!isAdmin && !isWorker) return res.status(403).json({ error: "Only the assigned pro can submit the code" });
    if (b.status !== "awaiting-confirmation") {
      return res.status(409).json({ error: `No code pending (now: ${b.status})` });
    }
    const o = await query<{ id: string; code_hash: string; expires_at: string; attempts: number }>(
      `SELECT id, code_hash, expires_at, attempts FROM booking_otps
       WHERE booking_id = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`, [b.id]);
    if (o.rowCount === 0) return res.status(400).json({ error: "No active code — ask for a new one" });
    const otp = o.rows[0];
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "Code expired — issue a new one" });
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Too many attempts — issue a new code" });
    }
    if (otp.code_hash !== hashOtp(code)) {
      await query(`UPDATE booking_otps SET attempts = attempts + 1 WHERE id = $1`, [otp.id]);
      return res.status(400).json({ error: `Wrong code (${OTP_MAX_ATTEMPTS - otp.attempts - 1} tries left)` });
    }
    const finalPaisa = Number(b.estimate_paisa);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE booking_otps SET consumed_at = now() WHERE id = $1`, [otp.id]);
      await client.query(
        `UPDATE bookings SET status = 'completed', updated_at = now(), final_paisa = $1, payment_status = 'paid' WHERE id = $2`,
        [finalPaisa, b.id]);
      await client.query(
        `INSERT INTO booking_events(booking_id, status, by_role, by_user_id, note)
         VALUES ($1, 'completed', $2, $3, 'OTP verified')`,
        [b.id, isAdmin ? "admin" : "worker", uid]);
      const commission = calcCommission(finalPaisa, b.commission_bps);
      await client.query(
        `INSERT INTO commission_ledger(booking_id, total_paisa, commission_paisa, worker_paisa, rate_bps)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (booking_id) DO NOTHING`,
        [b.id, finalPaisa, commission, finalPaisa - commission, b.commission_bps]);
      await client.query(
        `UPDATE payments SET status = 'verified', verified_at = COALESCE(verified_at, now())
         WHERE booking_id = $1 AND provider <> 'cash' AND status = 'pending'`, [b.id]);
      const rules = await client.query<{ value: Record<string, number> }>(`SELECT value FROM settings WHERE id = 'platform'`);
      const per100 = rules.rows[0]?.value.rewardPerNpr100 ?? 1;
      const pts = Math.floor(finalPaisa / 10000) * per100;
      if (pts > 0) {
        await client.query(
          `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
           VALUES ($1, $2, 'earn', 'Booking completed', $3) ON CONFLICT DO NOTHING`,
          [b.customer_id, pts, b.id]);
      }
      await notify(client, b.customer_id, "Job completed", "Verified complete — please rate the job.");
      if (b.worker_id) await notify(client, b.worker_id, "Job completed", "Code accepted. Earnings updated.");
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
