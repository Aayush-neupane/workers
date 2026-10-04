import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth } from "../middleware/auth.js";
import { bookingKey } from "../utils/lookup.js";
import {
  OUTSIDE_DAMAK,
  closedWardMessage,
  isDamakCity,
  parseWard,
} from "../utils/coverage.js";

const router = Router();
router.use(requireAuth);

// ---------- Addresses ----------
router.get(
  "/addresses",
  ah(async (req, res) => {
    const r = await query(`SELECT * FROM addresses WHERE user_id = $1 ORDER BY created_at`, [
      req.user!.id,
    ]);
    return res.json({ addresses: r.rows });
  }),
);

const addressSchema = z.object({
  label: z.string().trim().min(2).max(40),
  line: z.string().trim().min(5).max(300),
  city: z.string().trim().max(60).default("Damak"),
  ward: z.number().int().min(1).max(10).nullable().optional(),
  phone: z.string().trim().min(10).max(20),
});

router.post(
  "/addresses",
  validate(addressSchema),
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof addressSchema>;
    // Strict Damak-only gate: never trust the client city at face value.
    if (!isDamakCity(f.city)) {
      return res.status(400).json({ error: OUTSIDE_DAMAK });
    }
    const ward = f.ward ?? parseWard(f.line);
    if (ward !== null) {
      const open = await query<{ is_open: boolean }>(
        `SELECT is_open FROM coverage_wards WHERE ward = $1`,
        [ward],
      );
      if (open.rowCount === 0 || open.rows[0].is_open === false) {
        return res.status(400).json({ error: closedWardMessage(ward) });
      }
    }
    const n = await query(`SELECT COUNT(*)::int AS n FROM addresses WHERE user_id = $1`, [
      req.user!.id,
    ]);
    if ((n.rows[0] as { n: number }).n >= 5) {
      return res.status(400).json({ error: "Maximum 5 addresses" });
    }
    const r = await query(
      `INSERT INTO addresses(user_id, label, line, city, ward, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user!.id, f.label, f.line, "Damak", ward, f.phone],
    );
    return res.status(201).json({ address: r.rows[0] });
  }),
);

router.delete(
  "/addresses/:id",
  ah(async (req, res) => {
    const r = await query(`DELETE FROM addresses WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user!.id,
    ]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  }),
);

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
    const key = bookingKey(f.bookingId);
    if (!key) return res.status(400).json({ error: "Invalid request" });
    const b = await query<{ id: string; customer_id: string; worker_id: string | null; status: string }>(
      `SELECT id, customer_id, worker_id, status FROM bookings WHERE ${key.column} = $1`,
      [key.value],
    );
    if (b.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const booking = b.rows[0];
    if (booking.customer_id !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
    if (booking.status !== "completed") {
      return res.status(400).json({ error: "Only completed bookings can be reviewed" });
    }
    if (!booking.worker_id) return res.status(400).json({ error: "No worker to review" });
    try {
      const r = await query(
        `INSERT INTO reviews(booking_id, worker_user_id, customer_id, rating, text)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [f.bookingId, booking.worker_id, req.user!.id, f.rating, f.text],
      );
      return res.status(201).json({ ok: true, id: (r.rows[0] as { id: string }).id });
    } catch {
      return res.status(409).json({ error: "Already reviewed" });
    }
  }),
);

// ---------- Support tickets (own) ----------
router.get(
  "/tickets",
  ah(async (req, res) => {
    const r = await query(
      `SELECT t.*, (SELECT json_agg(json_build_object('from', m.from_role, 'text', m.body, 'at', m.created_at)
                                   ORDER BY m.created_at)
                   FROM ticket_messages m WHERE m.ticket_id = t.id) AS messages
       FROM support_tickets t WHERE t.user_id = $1 ORDER BY t.updated_at DESC`,
      [req.user!.id],
    );
    return res.json({ tickets: r.rows });
  }),
);

router.post(
  "/tickets",
  validate(z.object({
    subject: z.string().trim().min(8).max(200),
    message: z.string().trim().min(20).max(4000),
  })),
  ah(async (req, res) => {
    const f = req.body as { subject: string; message: string };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const t = await client.query(
        `INSERT INTO support_tickets(user_id, subject) VALUES ($1, $2) RETURNING id`,
        [req.user!.id, f.subject],
      );
      const id = (t.rows[0] as { id: string }).id;
      await client.query(`INSERT INTO ticket_messages(ticket_id, from_role, body) VALUES ($1, 'customer', $2)`, [
        id,
        f.message,
      ]);
      await client.query("COMMIT");
      return res.status(201).json({ ok: true, id });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

router.post(
  "/tickets/:id/messages",
  validate(z.object({ body: z.string().trim().min(1).max(2000) })),
  ah(async (req, res) => {
    const f = req.body as { body: string };
    const t = await query(`SELECT id FROM support_tickets WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user!.id,
    ]);
    if (t.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await query(
      `INSERT INTO ticket_messages(ticket_id, from_role, body) VALUES ($1, 'customer', $2)`,
      [req.params.id, f.body],
    );
    // A customer follow-up reopens a resolved thread.
    await query(
      `UPDATE support_tickets SET status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END,
                                  updated_at = now() WHERE id = $1`,
      [req.params.id],
    );
    return res.json({ ok: true });
  }),
);

// ---------- Rewards (own ledger + balance) ----------
router.get(
  "/rewards/mine",
  ah(async (req, res) => {
    const r = await query(
      `SELECT id, points, kind, reason, created_at AS at FROM reward_ledger
       WHERE user_id = $1 ORDER BY created_at`,
      [req.user!.id],
    );
    const txs = r.rows as { points: number }[];
    const balance = txs.reduce((n, t) => n + t.points, 0);
    return res.json({ txs: r.rows, balance });
  }),
);

// ---------- Notifications (own) ----------
router.get(
  "/notifications",
  ah(async (req, res) => {
    const r = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user!.id],
    );
    return res.json({ notifications: r.rows });
  }),
);

router.post(
  "/notifications/:id/read",
  ah(async (req, res) => {
    await query(`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user!.id,
    ]);
    return res.json({ ok: true });
  }),
);

export default router;
