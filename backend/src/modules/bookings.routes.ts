import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { canTransition, type BookingStatus } from "../utils/transitions.js";
import { calcCommission } from "../utils/money.js";
import {
  OUTSIDE_DAMAK,
  closedWardMessage,
  isDamakCity,
  mentionsDamak,
  parseWard,
  serviceServesDamak,
} from "../utils/coverage.js";
import { notify } from "../services/notify.js";

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

/** Customer creates a booking. Commission rate snapshotted from the category. */
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
      id: string; base_price_paisa: string; category_id: string; commission_bps: number; areas: string[];
    }>(
      `SELECT s.id, s.base_price_paisa, s.category_id, s.areas, c.commission_bps
       FROM services s JOIN categories c ON c.id = s.category_id
       WHERE s.id = $1 AND s.is_active = true`,
      [f.serviceId],
    );
    if (svc.rowCount === 0) return res.status(404).json({ error: "Service not available" });
    const service = svc.rows[0];
    if (!serviceServesDamak(service.areas)) {
      return res.status(400).json({ error: "This service is not offered in Damak." });
    }
    const estimate = Number(service.base_price_paisa);

    // Strict Damak-only gate — re-validated server-side on every booking.
    let addressText = (f.addressText ?? "").trim();
    let ward: number | null = null;
    if (f.addressId) {
      const a = await query<{ line: string; city: string; ward: number | null }>(
        `SELECT line, city, ward FROM addresses WHERE id = $1 AND user_id = $2`,
        [f.addressId, userId],
      );
      if (a.rowCount === 0) return res.status(400).json({ error: "Unknown address" });
      if (!isDamakCity(a.rows[0].city)) return res.status(400).json({ error: OUTSIDE_DAMAK });
      ward = a.rows[0].ward ?? parseWard(a.rows[0].line);
      addressText = `${a.rows[0].line}, Damak`;
    } else {
      if (!addressText) return res.status(400).json({ error: "Address is required" });
      if (!mentionsDamak(addressText)) return res.status(400).json({ error: OUTSIDE_DAMAK });
      ward = parseWard(addressText);
    }
    if (ward !== null) {
      const open = await query<{ is_open: boolean }>(`SELECT is_open FROM coverage_wards WHERE ward = $1`, [ward]);
      if (open.rowCount === 0 || !open.rows[0].is_open) {
        return res.status(400).json({ error: closedWardMessage(ward) });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const settings = await client.query<{ value: Record<string, number> }>(`SELECT value FROM settings WHERE id = 'platform'`);
      const rules = settings.rows[0]?.value ?? {};
      const redeemPoints = rules.redeemPoints ?? 100;
      const redeemDiscount = rules.redeemDiscountPaisa ?? 5000;
      let discount = 0;
      if (f.useRewards) {
        const bal = await client.query<{ pts: number }>(
          `SELECT COALESCE(SUM(points), 0)::int AS pts FROM reward_ledger WHERE user_id = $1`, [userId]);
        if (bal.rows[0].pts < redeemPoints) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: `Not enough points (${redeemPoints} needed)` });
        }
        await client.query(
          `INSERT INTO reward_ledger(user_id, points, kind, reason) VALUES ($1, $2, 'redeem', 'Checkout discount')`,
          [userId, -redeemPoints]);
        discount = redeemDiscount;
      }
      let no = await bookingNo();
      let b;
      const insertSql = `INSERT INTO bookings(booking_no, customer_id, service_id, status, address_id, address_text, ward,
        slot, instructions, estimate_paisa, discount_paisa, payment_method, payment_status, commission_bps)
        VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, booking_no`;
      const params = [no, userId, f.serviceId, f.addressId ?? null, addressText, ward, f.slot,
        f.instructions, estimate, Math.min(discount, estimate), f.paymentMethod,
        f.paymentMethod === "cash" ? "unpaid" : "pending-verification", service.commission_bps];
      try {
        b = await client.query(insertSql, params);
      } catch (e) {
        if ((e as { code?: string }).code !== "23505") throw e;
        no = await bookingNo();
        b = await client.query(insertSql, [no, ...params.slice(1)]);
      }
      const bookingId = (b.rows[0] as { id: string }).id;
      await client.query(
        `INSERT INTO booking_events(booking_id, status, by_role, by_user_id) VALUES ($1, 'pending', 'customer', $2)`,
        [bookingId, userId]);
      await client.query(
        `INSERT INTO payments(booking_id, provider, amount_paisa, status) VALUES ($1, $2, $3, 'pending')`,
        [bookingId, f.paymentMethod, Math.max(0, estimate - discount)]);
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

router.get("/bookings/mine", requireAuth, ah(async (req, res) => {
  const r = await query(
    `SELECT b.*, s.name AS service_name, u.name AS worker_name
     FROM bookings b LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN users u ON u.id = b.worker_id
     WHERE b.customer_id = $1 ORDER BY b.created_at DESC LIMIT 100`,
    [req.user!.id]);
  return res.json({ bookings: r.rows });
}));

function bookingKey(id: string): { column: string; value: string } | null {
  if (/^BK-\d{4,}$/.test(id)) return { column: "booking_no", value: id };
  if (/^[0-9a-f-]{36}$/i.test(id)) return { column: "id", value: id };
  return null;
}

router.get("/bookings/:id", requireAuth, ah(async (req, res) => {
  const key = bookingKey(req.params.id);
  if (!key) return res.status(400).json({ error: "Invalid request" });
  const r = await query(
    `SELECT b.*, s.name AS service_name, s.description AS service_description,
            u.name AS worker_name, c.name AS category_name, cu.phone AS customer_phone
     FROM bookings b LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN users u ON u.id = b.worker_id
     LEFT JOIN categories c ON c.id = s.category_id
     LEFT JOIN users cu ON cu.id = b.customer_id
     WHERE b.${key.column} = $1`, [key.value]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
  const b = r.rows[0] as Record<string, unknown>;
  const roles = req.user!.roles;
  const mine = b.customer_id === req.user!.id || b.worker_id === req.user!.id || roles.includes("ADMIN");
  if (!mine) return res.status(403).json({ error: "Forbidden" });
  const events = await query(
    `SELECT status, by_role, note, created_at AS at FROM booking_events WHERE booking_id = $1 ORDER BY created_at`, [b.id]);
  const assigns = await query(
    `SELECT a.*, u.name AS worker_name FROM assignments a LEFT JOIN users u ON u.id = a.worker_user_id
     WHERE booking_id = $1 ORDER BY created_at`, [b.id]);
  return res.json({ booking: b, history: events.rows, assignments: assigns.rows });
}));
/**
 * Explicit assign / reassign (admin only). Validates eligibility, records the
 * assignment row, notifies the pro, and audit-logs the reason.
 */
router.post(
  "/bookings/:id/assign",
  requireAuth,
  requireRole("ADMIN"),
  validate(z.object({
    workerId: z.string().uuid(),
    reason: z.string().trim().max(300).default(""),
  })),
  ah(async (req, res) => {
    const f = req.body as { workerId: string; reason: string };
    const key = bookingKey(req.params.id);
    if (!key) return res.status(400).json({ error: "Invalid request" });
    const b = await query<{ id: string; service_id: string; worker_id: string | null; status: string }>(
      `SELECT id, service_id, worker_id, status FROM bookings WHERE ${key.column} = $1`, [key.value]);
    if (b.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const booking = b.rows[0];
    if (["completed", "cancelled"].includes(booking.status)) {
      return res.status(409).json({ error: `Cannot reassign a ${booking.status} booking` });
    }
    const w = await query(
      `SELECT u.id FROM users u JOIN worker_profiles wp ON wp.user_id = u.id
       JOIN worker_services ws ON ws.worker_user_id = u.id
       WHERE u.id = $1 AND u.is_active = true AND wp.verification_state = 'verified'
         AND wp.is_active = true AND ws.service_id = $2`,
      [f.workerId, booking.service_id]);
    if (w.rowCount === 0) return res.status(400).json({ error: "Worker not eligible for this service" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE bookings SET worker_id = $1, updated_at = now() WHERE id = $2`, [f.workerId, booking.id]);
      await client.query(
        `INSERT INTO assignments(booking_id, worker_user_id, assigned_by, reason) VALUES ($1, $2, $3, $4)`,
        [booking.id, f.workerId, req.user!.id, f.reason || (booking.worker_id ? "reassignment" : "assignment")]);
      await client.query(
        `INSERT INTO booking_events(booking_id, status, by_role, by_user_id, note)
         VALUES ($1, $2, 'admin', $3, $4)`,
        [booking.id, booking.status, req.user!.id, `Assigned to pro${booking.worker_id ? " (reassigned)" : ""}`]);
      await notify(client, f.workerId, "New assignment", "A booking was assigned to you.");
      if (booking.worker_id && booking.worker_id !== f.workerId) {
        await notify(client, booking.worker_id, "Assignment changed", "A booking was reassigned away from you.");
      }
      await client.query("COMMIT");
      const { audit } = await import("../services/notify.js");
      await audit(req.user!.id, "ADMIN", "booking-assign", `${booking.id} -> ${f.workerId}: ${f.reason}`);
      return res.json({ ok: true, reassigned: Boolean(booking.worker_id) });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

const transitionSchema = z.object({
  to: z.enum(["awaiting-worker", "confirmed", "en-route", "in-progress",
    "awaiting-confirmation", "completed", "cancelled", "disputed"]),
  note: z.string().max(500).default(""),
  finalPaisa: z.number().int().min(0).optional(),
  workerId: z.string().uuid().optional(),
});

/**
 * Role-aware state machine. Completion normally requires the OTP endpoint;
 * direct `completed` here is only the dispute-exception path (customer/admin).
 */
router.post("/bookings/:id/transition", requireAuth, validate(transitionSchema), ah(async (req, res) => {
  const f = req.body as z.infer<typeof transitionSchema>;
  const to = f.to as BookingStatus;
  const roles = req.user!.roles;
  const uid = req.user!.id;
  const isAdmin = roles.includes("ADMIN");
  const key = bookingKey(req.params.id);
  if (!key) return res.status(400).json({ error: "Invalid request" });
  const r = await query<{
    id: string; status: string; customer_id: string; worker_id: string | null;
    service_id: string; estimate_paisa: string; commission_bps: number;
  }>(`SELECT * FROM bookings WHERE ${key.column} = $1`, [key.value]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
  const b = r.rows[0];
  const from = b.status as BookingStatus;
  if (!canTransition(from, to)) return res.status(409).json({ error: `Cannot move from ${from} to ${to}` });

  if (to === "completed") {
    const isCustomer = b.customer_id === uid;
    if (!(from === "disputed" && (isCustomer || isAdmin))) {
      return res.status(400).json({ error: "Complete with the OTP code sent to the customer." });
    }
  }

  const isCustomer = b.customer_id === uid;
  const isWorker = b.worker_id === uid && roles.includes("WORKER");
  let byRole = "admin";
  if (!isAdmin) {
    if (isCustomer && ["cancelled", "disputed"].includes(to)) byRole = "customer";
    else if (isWorker && ["confirmed", "en-route", "in-progress", "awaiting-confirmation"].includes(to)) byRole = "worker";
    else if (roles.includes("WORKER") && !b.worker_id && from === "awaiting-worker" && to === "confirmed") byRole = "worker";
    else return res.status(403).json({ error: "Forbidden for your role" });
  }
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
        [f.workerId, b.service_id]);
      if (w.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Worker not eligible for this service" });
      }
      await client.query(`UPDATE bookings SET worker_id = $1 WHERE id = $2`, [f.workerId, b.id]);
      await client.query(
        `INSERT INTO assignments(booking_id, worker_user_id, assigned_by, reason) VALUES ($1, $2, $3, $4)`,
        [b.id, f.workerId, uid, f.note || "admin assignment"]);
      await notify(client, f.workerId, "New assignment", "A booking was assigned to you.");
    } else if (byRole === "worker" && !b.worker_id && to === "confirmed") {
      await client.query(`UPDATE bookings SET worker_id = $1 WHERE id = $2`, [uid, b.id]);
      await client.query(
        `INSERT INTO assignments(booking_id, worker_user_id, assigned_by, reason) VALUES ($1, $2, $2, 'self-accept')`,
        [b.id, uid]);
    }
    const finalPaisa = f.finalPaisa ?? Number(b.estimate_paisa);
    if (to === "completed") {
      await client.query(
        `UPDATE bookings SET status = $1, updated_at = now(), final_paisa = $2, payment_status = 'paid' WHERE id = $3`,
        [to, finalPaisa, b.id]);
    } else {
      await client.query(`UPDATE bookings SET status = $1, updated_at = now() WHERE id = $2`, [to, b.id]);
    }
    await client.query(
      `INSERT INTO booking_events(booking_id, status, by_role, by_user_id, note) VALUES ($1, $2, $3, $4, $5)`,
      [b.id, to, byRole, uid, f.note]);
    if (to === "completed") {
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
      const mileEvery = rules.rows[0]?.value.milestoneBookings ?? 5;
      const mileBonus = rules.rows[0]?.value.milestoneBonus ?? 100;
      const pts = Math.floor(finalPaisa / 10000) * per100;
      if (pts > 0) {
        await client.query(
          `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
           VALUES ($1, $2, 'earn', 'Booking completed', $3) ON CONFLICT DO NOTHING`,
          [b.customer_id, pts, b.id]);
      }
      const done = await client.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM bookings WHERE customer_id = $1 AND status = 'completed'`, [b.customer_id]);
      if (mileEvery > 0 && done.rows[0].n > 0 && done.rows[0].n % mileEvery === 0) {
        await client.query(
          `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
           VALUES ($1, $2, 'bonus', 'Milestone bonus', $3) ON CONFLICT DO NOTHING`,
          [b.customer_id, mileBonus, b.id]);
      }
      await notify(client, b.customer_id, "Job completed", "Your booking is complete — please rate the job.");
      if (b.worker_id) await notify(client, b.worker_id, "Job completed", "Booking marked complete. Earnings updated.");
    }
    if (to === "awaiting-worker" && !f.workerId) {
      await client.query(
        `INSERT INTO notifications(user_id, title, body)
         SELECT u.id, 'New booking needs a pro', 'An unassigned booking is waiting.'
         FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'ADMIN'`);
    }
    await client.query("COMMIT");
    return res.json({ ok: true, from, to });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

export default router;
