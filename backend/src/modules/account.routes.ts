import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth } from "../middleware/auth.js";
import {
  OUTSIDE_DAMAK, closedWardMessage, isDamakCity, parseWard,
} from "../utils/coverage.js";

const router = Router();
router.use(requireAuth);

// ---------- Addresses (Damak-only) ----------
router.get("/addresses", ah(async (req, res) => {
  const r = await query(`SELECT * FROM addresses WHERE user_id = $1 ORDER BY created_at`, [req.user!.id]);
  return res.json({ addresses: r.rows });
}));

const addressSchema = z.object({
  label: z.string().trim().min(2).max(40),
  line: z.string().trim().min(5).max(300),
  city: z.string().trim().max(60).default("Damak"),
  ward: z.number().int().min(1).max(10).nullable().optional(),
  phone: z.string().trim().min(10).max(20),
});

router.post("/addresses", validate(addressSchema), ah(async (req, res) => {
  const f = req.body as z.infer<typeof addressSchema>;
  if (!isDamakCity(f.city)) return res.status(400).json({ error: OUTSIDE_DAMAK });
  const ward = f.ward ?? parseWard(f.line);
  if (ward !== null) {
    const open = await query<{ is_open: boolean }>(`SELECT is_open FROM coverage_wards WHERE ward = $1`, [ward]);
    if (open.rowCount === 0 || !open.rows[0].is_open) {
      return res.status(400).json({ error: closedWardMessage(ward) });
    }
  }
  const n = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM addresses WHERE user_id = $1`, [req.user!.id]);
  if (n.rows[0].n >= 5) return res.status(400).json({ error: "Maximum 5 addresses" });
  const r = await query(
    `INSERT INTO addresses(user_id, label, line, city, ward, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user!.id, f.label, f.line, "Damak", ward, f.phone]);
  return res.status(201).json({ address: r.rows[0] });
}));

router.delete("/addresses/:id", ah(async (req, res) => {
  const r = await query(`DELETE FROM addresses WHERE id = $1 AND user_id = $2`, [req.params.id, req.user!.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true });
}));

// ---------- Reviews (one per completed booking, owner only) ----------
router.post(
  "/reviews",
  validate(z.object({
    bookingId: z.string().min(3).max(40),
    rating: z.number().int().min(1).max(5),
    text: z.string().trim().max(2000).default(""),
  })),
  ah(async (req, res) => {
    const f = req.body as { bookingId: string; rating: number; text: string };
    const b = await query<{ id: string; customer_id: string; worker_id: string | null; status: string }>(
      `SELECT id, customer_id, worker_id, status FROM bookings WHERE id = $1 OR booking_no = $1`, [f.bookingId]);
    if (b.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const booking = b.rows[0];
    if (booking.customer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
    if (booking.status !== "completed") return res.status(400).json({ error: "Only completed bookings can be reviewed" });
    if (!booking.worker_id) return res.status(400).json({ error: "No worker to review" });
    try {
      const r = await query<{ id: string }>(
        `INSERT INTO reviews(booking_id, worker_user_id, customer_id, rating, text) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [booking.id, booking.worker_id, req.user!.id, f.rating, f.text]);
      return res.status(201).json({ ok: true, id: r.rows[0].id });
    } catch {
      return res.status(409).json({ error: "Already reviewed" });
    }
  }),
);

// ---------- Support tickets ----------
router.get("/tickets", ah(async (req, res) => {
  const r = await query(
    `SELECT t.*, (SELECT json_agg(json_build_object('from', m.from_role, 'text', m.body, 'at', m.created_at) ORDER BY m.created_at)
      FROM ticket_messages m WHERE m.ticket_id = t.id) AS messages
     FROM support_tickets t WHERE t.user_id = $1 ORDER BY t.updated_at DESC`, [req.user!.id]);
  return res.json({ tickets: r.rows });
}));

router.post(
  "/tickets",
  validate(z.object({ subject: z.string().trim().min(8).max(200), message: z.string().trim().min(20).max(4000) })),
  ah(async (req, res) => {
    const f = req.body as { subject: string; message: string };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const t = await client.query<{ id: string }>(
        `INSERT INTO support_tickets(user_id, subject) VALUES ($1, $2) RETURNING id`, [req.user!.id, f.subject]);
      await client.query(`INSERT INTO ticket_messages(ticket_id, from_role, body) VALUES ($1, 'customer', $2)`,
        [t.rows[0].id, f.message]);
      await client.query("COMMIT");
      return res.status(201).json({ ok: true, id: t.rows[0].id });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

// ---------- Rewards + notifications ----------
router.get("/rewards/mine", ah(async (req, res) => {
  const r = await query(
    `SELECT id, points, kind, reason, created_at AS at FROM reward_ledger WHERE user_id = $1 ORDER BY created_at`,
    [req.user!.id]);
  const balance = (r.rows as { points: number }[]).reduce((n, t) => n + t.points, 0);
  return res.json({ txs: r.rows, balance });
}));

// ---------- Referrals (own code, invites, rewards) ----------
router.get("/referrals/mine", ah(async (req, res) => {
  const { ensureReferralCode } = await import("../services/referrals.js");
  const code = await ensureReferralCode(pool, req.user!.id, req.user!.name);
  const uses = await query(
    `SELECT u.name AS referee, ru.rewarded, ru.created_at
     FROM referral_uses ru JOIN users u ON u.id = ru.referee_user_id
     JOIN referral_codes rc ON rc.code = ru.code
     WHERE rc.owner_user_id = $1 ORDER BY ru.created_at DESC`, [req.user!.id]);
  const settings = await query<{ value: Record<string, number> }>(`SELECT value FROM settings WHERE id = 'platform'`);
  return res.json({ code, uses: uses.rows, bonus: settings.rows[0]?.value.referralBonus ?? 50 });
}));

router.get("/notifications", ah(async (req, res) => {
  const r = await query(`SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [req.user!.id]);
  return res.json({ notifications: r.rows });
}));

router.post("/notifications/:id/read", ah(async (req, res) => {
  await query(`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [req.params.id, req.user!.id]);
  return res.json({ ok: true });
}));

// ---------- Cookie consent records ----------
const consentSchema = z.object({
  preferences: z.boolean().default(false),
  analytics: z.boolean().default(false),
  marketing: z.boolean().default(false),
  policyVersion: z.string().max(20).default("v1"),
});

router.post("/consent", validate(consentSchema), ah(async (req, res) => {
  const f = req.body as z.infer<typeof consentSchema>;
  const settings = await query<{ value: Record<string, number> }>(`SELECT value FROM settings WHERE id = 'platform'`);
  const v = settings.rows[0]?.value ?? {};
  await query(
    `INSERT INTO consent_records(user_id, categories, policy_version, consent_version)
     VALUES ($1, $2, $3, $4)`,
    [req.user!.id,
      JSON.stringify({ necessary: true, preferences: f.preferences, analytics: f.analytics, marketing: f.marketing }),
      f.policyVersion, Number(v.consentVersion ?? 1)]);
  return res.json({ ok: true });
}));

router.get("/consent/latest", ah(async (req, res) => {
  const r = await query(`SELECT * FROM consent_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [req.user!.id]);
  return res.json({ consent: r.rows[0] ?? null });
}));

export default router;
