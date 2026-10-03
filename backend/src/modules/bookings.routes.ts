import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { bookingKey } from "../utils/lookup.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  canTransition,
  type BookingStatus,
} from "../utils/transitions.js";
import { calcCommission, earnPoints, redeemValue } from "../utils/money.js";

const router = Router();

async function bookingNo(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const no = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    const r = await query(`SELECT id FROM bookings WHERE booking_no = $1`, [no]);
    if (r.rowCount === 0) return no;
  }
  return `BK-${Date.now().toString().slice(-6)}`;
}

const createSchema = z.object({
  serviceId: z.string().uuid(),
  addressId: z.string().uuid().optional(),
  addressText: z.string().trim().max(300).optional(),
  slot: z.string().datetime({ offset: true }),
  instructions: z.string().trim().min(10).max(2000),
  paymentMethod: z.enum(["cash", "esewa", "khalti"]),
  useRewards: z.boolean().default(false),
});

// Customer creates a booking. Commission rate is snapshotted from the category.
router.post(
  "/bookings",
  requireAuth,
  requireRole("CUSTOMER", "ADMIN"),
  validate(createSchema),
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof createSchema>;
    const userId = req.user!.id;
    if (new Date(f.slot).getTime() < Date.now()) {
      return res.status(400).json({ error: "Slot must be in the future" });
    }
    const svc = await query<{
      id: string;
      base_price_paisa: string;
      category_id: string;
      commission_bps: number;
    }>(
      `SELECT s.id, s.base_price_paisa, s.category_id, c.commission_bps
       FROM services s JOIN categories c ON c.id = s.category_id
       WHERE s.id = $1 AND s.is_active = true`,
      [f.serviceId],
    );
    if (svc.rowCount === 0) return res.status(404).json({ error: "Service not available" });
    const service = svc.rows[0];
    const estimate = Number(service.base_price_paisa);

    let addressText = (f.addressText ?? "").trim();
    if (f.addressId) {
      const a = await query<{ line: string; city: string }>(
        `SELECT line, city FROM addresses WHERE id = $1 AND user_id = $2`,
        [f.addressId, userId],
      );
      if (a.rowCount === 0) return res.status(400).json({ error: "Unknown address" });
      addressText = `${a.rows[0].line}, ${a.rows[0].city}`;
    }
    if (!addressText) return res.status(400).json({ error: "Address is required" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let discount = 0;
      if (f.useRewards) {
        const bal = await client.query(
          `SELECT COALESCE(SUM(points), 0)::int AS pts FROM reward_ledger WHERE user_id = $1`,
          [userId],
        );
        const pts = (bal.rows[0] as { pts: number }).pts;
        if (pts < 100) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Not enough points (100 needed)" });
        }
        await client.query(
          `INSERT INTO reward_ledger(user_id, points, kind, reason) VALUES ($1, -100, 'redeem', 'Checkout discount')`,
          [userId],
        );
        discount = redeemValue(100);
      }
      const no = await bookingNo();
      const b = await client.query(
        `INSERT INTO bookings(booking_no, customer_id, service_id, status, address_id, address_text,
                              slot, instructions, estimate_paisa, payment_method, payment_status, commission_bps)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, booking_no`,
        [
          no,
          userId,
          f.serviceId,
          f.addressId ?? null,
          addressText,
          f.slot,
          f.instructions,
          estimate,
          f.paymentMethod,
          f.paymentMethod === "cash" ? "unpaid" : "pending-verification",
          service.commission_bps,
        ],
      );
      const bookingId = (b.rows[0] as { id: string }).id;
      await client.query(
        `INSERT INTO booking_events(booking_id, status, by_role, by_user_id) VALUES ($1, 'pending', 'customer', $2)`,
        [bookingId, userId],
      );
      await client.query(
        `INSERT INTO payments(booking_id, provider, amount_paisa, status)
         VALUES ($1, $2, $3, 'pending')`,
        [bookingId, f.paymentMethod, Math.max(0, estimate - discount)],
      );
      await client.query("COMMIT");
      return res.status(201).json({ ok: true, bookingNo: no, id: bookingId, discountPaisa: discount });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

function rowToBooking(r: Record<string, unknown>) {
  return {
    ...r,
    estimate_paisa: Number(r.estimate_paisa),
    final_paisa: r.final_paisa === null ? null : Number(r.final_paisa),
    commission_paisa: r.commission_paisa === null ? null : Number(r.commission_paisa),
  };
}

router.get(
  "/bookings/mine",
  requireAuth,
  ah(async (req, res) => {
    const r = await query(
      `SELECT b.*, s.name AS service_name, u.name AS worker_name
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN users u ON u.id = b.worker_id
       WHERE b.customer_id = $1 ORDER BY b.created_at DESC LIMIT 100`,
      [req.user!.id],
    );
    return res.json({ bookings: r.rows });
  }),
);

router.get(
  "/bookings/:id",
  requireAuth,
  ah(async (req, res) => {
    const key = bookingKey(req.params.id);
    if (!key) return res.status(400).json({ error: "Invalid request" });
    const r = await query(
      `SELECT b.*, s.name AS service_name, s.description AS service_description,
              u.name AS worker_name, c.name AS category_name
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN users u ON u.id = b.worker_id
       LEFT JOIN categories c ON c.id = s.category_id
       WHERE b.${key.column} = $1`,
      [key.value],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const b = r.rows[0] as Record<string, unknown>;
    const roles = req.user!.roles;
    const mine =
      b.customer_id === req.user!.id || b.worker_id === req.user!.id || roles.includes("ADMIN");
    if (!mine) return res.status(403).json({ error: "Forbidden" });
    const events = await query(
      `SELECT status, by_role, note, created_at AS at FROM booking_events WHERE booking_id = $1 ORDER BY created_at`,
      [b.id],
    );
    return res.json({ booking: rowToBooking(b), history: events.rows });
  }),
);

const transitionSchema = z.object({
  to: z.enum([
    "awaiting-worker",
    "confirmed",
    "en-route",
    "in-progress",
    "awaiting-confirmation",
    "completed",
    "cancelled",
    "disputed",
  ]),
  note: z.string().max(500).default(""),
  finalPaisa: z.number().int().min(0).optional(),
  workerId: z.string().uuid().optional(),
});

// Role-aware state machine. All writes happen in one transaction.
router.post(
  "/bookings/:id/transition",
  requireAuth,
  validate(transitionSchema),
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof transitionSchema>;
    const to = f.to as BookingStatus;
    const roles = req.user!.roles;
    const uid = req.user!.id;
    const isAdmin = roles.includes("ADMIN");

    const key = bookingKey(req.params.id);
    if (!key) return res.status(400).json({ error: "Invalid request" });
    const r = await query<{
      id: string;
      status: string;
      customer_id: string;
      worker_id: string | null;
      service_id: string;
      estimate_paisa: string;
      payment_method: string;
      commission_bps: number;
    }>(`SELECT * FROM bookings WHERE ${key.column} = $1`, [key.value]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const b = r.rows[0];
    const from = b.status as BookingStatus;

    if (!canTransition(from, to)) {
      return res.status(409).json({ error: `Cannot move from ${from} to ${to}` });
    }

    const isCustomer = b.customer_id === uid;
    const isWorker = b.worker_id === uid && roles.includes("WORKER");
    let byRole = "admin";
    if (!isAdmin) {
      if (isCustomer && ["cancelled", "completed", "disputed"].includes(to)) byRole = "customer";
      else if (
        isWorker &&
        ["confirmed", "en-route", "in-progress", "awaiting-confirmation"].includes(to)
      )
        byRole = "worker";
      // Workers accept open requests (no worker yet) via confirmed.
      else if (
        roles.includes("WORKER") &&
        !b.worker_id &&
        from === "awaiting-worker" &&
        to === "confirmed"
      )
        byRole = "worker";
      else return res.status(403).json({ error: "Forbidden for your role" });
    }
    // Completion from disputed needs customer or admin sign-off.
    if (to === "completed" && from === "disputed" && !(isCustomer || isAdmin)) {
      return res.status(403).json({ error: "Forbidden for your role" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (f.workerId) {
        if (!isAdmin) {
          await client.query("ROLLBACK");
          return res.status(403).json({ error: "Only admins assign workers" });
        }
        const w = await client.query(
          `SELECT u.id FROM users u JOIN worker_profiles wp ON wp.user_id = u.id
           JOIN worker_services ws ON ws.worker_user_id = u.id
           WHERE u.id = $1 AND u.is_active = true AND wp.verification_state = 'verified'
             AND wp.is_active = true AND ws.service_id = $2`,
          [f.workerId, b.service_id],
        );
        if (w.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Worker not eligible for this service" });
        }
        await client.query(`UPDATE bookings SET worker_id = $1 WHERE id = $2`, [f.workerId, b.id]);
      } else if (byRole === "worker" && !b.worker_id && to === "confirmed") {
        await client.query(`UPDATE bookings SET worker_id = $1 WHERE id = $2`, [uid, b.id]);
      }
      const finalPaisa = f.finalPaisa ?? Number(b.estimate_paisa);
      if (to === "completed") {
        await client.query(
          `UPDATE bookings SET status = $1, updated_at = now(), final_paisa = $2, payment_status = 'paid' WHERE id = $3`,
          [to, finalPaisa, b.id],
        );
      } else {
        await client.query(`UPDATE bookings SET status = $1, updated_at = now() WHERE id = $2`, [
          to,
          b.id,
        ]);
      }
      await client.query(
        `INSERT INTO booking_events(booking_id, status, by_role, by_user_id, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [b.id, to, byRole, uid, f.note],
      );
      if (to === "completed") {
        const commission = calcCommission(finalPaisa, b.commission_bps);
        await client.query(
          `INSERT INTO commission_ledger(booking_id, total_paisa, commission_paisa, worker_paisa, rate_bps)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (booking_id) DO NOTHING`,
          [b.id, finalPaisa, commission, finalPaisa - commission, b.commission_bps],
        );
        const pts = earnPoints(finalPaisa);
        if (pts > 0) {
          await client.query(
            `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
             VALUES ($1, $2, 'earn', 'Booking completed', $3)
             ON CONFLICT DO NOTHING`,
            [b.customer_id, pts, b.id],
          );
        }
        // Milestone bonus every 5 completions.
        const done = await client.query(
          `SELECT COUNT(*)::int AS n FROM bookings WHERE customer_id = $1 AND status = 'completed'`,
          [b.customer_id],
        );
        const n = (done.rows[0] as { n: number }).n;
        if (n > 0 && n % 5 === 0) {
          await client.query(
            `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
             VALUES ($1, 100, 'bonus', '5-booking milestone', $2) ON CONFLICT DO NOTHING`,
            [b.customer_id, b.id],
          );
        }
        await client.query(
          `INSERT INTO notifications(user_id, title, body) VALUES
           ($1, 'Job completed', 'Your booking is complete — please rate the job.'),
           ($2, 'Job completed', 'Booking marked complete. Earnings updated.')`,
          [b.customer_id, b.worker_id ?? uid],
        );
      }
      if (to === "awaiting-worker") {
        await client.query(
          `INSERT INTO notifications(user_id, title, body)
           SELECT u.id, 'New assignment', 'A booking needs a pro.'
           FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
           WHERE r.name = 'ADMIN'`,
        );
      }
      await client.query("COMMIT");
      return res.json({ ok: true, from, to });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

export default router;
