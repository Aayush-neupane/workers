import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { closedWardMessage } from "../utils/coverage.js";
import { parseWard, mentionsDamak, OUTSIDE_DAMAK } from "../utils/coverage.js";
import { notify } from "../services/notify.js";
import { audit } from "../services/notify.js";

const router = Router();

const requestSchema = z.object({
  categoryId: z.string().uuid().optional(),
  title: z.string().trim().min(8).max(160),
  description: z.string().trim().min(20).max(4000),
  photos: z.array(z.string().trim().max(500)).max(5).default([]),
  windowStart: z.string().datetime({ offset: true }),
  windowEnd: z.string().datetime({ offset: true }),
  ward: z.number().int().min(1).max(10).nullable().optional(),
  landmark: z.string().trim().min(5).max(300),
  lat: z.number().min(26).max(31).nullable().optional(),
  lng: z.number().min(80).max(89).nullable().optional(),
});

/** Mode B: customer describes a complex job; address stays masked from pros. */
router.post(
  "/quotes/requests",
  requireAuth,
  requireRole("CUSTOMER", "ADMIN"),
  validate(requestSchema),
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof requestSchema>;
    if (new Date(f.windowStart).getTime() >= new Date(f.windowEnd).getTime()) {
      return res.status(400).json({ error: "Window end must be after start" });
    }
    const ward = f.ward ?? parseWard(f.landmark);
    if (ward === null && !mentionsDamak(f.landmark)) {
      return res.status(400).json({ error: OUTSIDE_DAMAK });
    }
    if (ward !== null) {
      const open = await query<{ is_open: boolean }>(`SELECT is_open FROM coverage_wards WHERE ward = $1`, [ward]);
      if (open.rowCount === 0 || !open.rows[0].is_open) {
        return res.status(400).json({ error: closedWardMessage(ward) });
      }
    }
    const r = await query<{ id: string }>(
      `INSERT INTO quote_requests(customer_id, category_id, title, description, photos, window_start, window_end, ward, landmark, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [req.user!.id, f.categoryId ?? null, f.title, f.description, f.photos,
        f.windowStart, f.windowEnd, ward, f.landmark, f.lat ?? null, f.lng ?? null]);
    await query(
      `INSERT INTO notifications(user_id, title, body)
       SELECT u.id, 'New quote request', 'A complex job needs proposals.'
       FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'ADMIN'`);
    return res.status(201).json({ ok: true, id: r.rows[0].id });
  }),
);

router.get("/quotes/requests/mine", requireAuth, ah(async (req, res) => {
  const r = await query(
    `SELECT q.*, c.name AS category_name,
       (SELECT json_agg(p) FROM quote_proposals p WHERE p.request_id = q.id) AS proposals
     FROM quote_requests q LEFT JOIN categories c ON c.id = q.category_id
     WHERE q.customer_id = $1 ORDER BY q.created_at DESC`, [req.user!.id]);
  return res.json({ requests: r.rows });
}));

/** Open requests for eligible pros — customer identity and exact address masked. */
router.get("/quotes/requests/open", requireAuth, requireRole("WORKER", "ADMIN"), ah(async (req, res) => {
  const roles = req.user!.roles;
  const eligible = roles.includes("ADMIN") ? true : await (async () => {
    const r = await query(`SELECT verification_state, is_active FROM worker_profiles WHERE user_id = $1`, [req.user!.id]);
    return (r.rowCount ?? 0) > 0 && r.rows[0].verification_state === "verified" && r.rows[0].is_active === true;
  })();
  if (!eligible) return res.status(403).json({ error: "Only verified, active pros" });
  const r = await query(
    `SELECT q.id, q.title, q.description, q.photos, q.window_start, q.window_end, q.ward, q.status, q.created_at,
            c.name AS category_name,
            (SELECT COUNT(*)::int FROM quote_proposals p WHERE p.request_id = q.id) AS proposal_count
     FROM quote_requests q LEFT JOIN categories c ON c.id = q.category_id
     WHERE q.status IN ('open', 'quoted') ORDER BY q.created_at DESC LIMIT 100`);
  return res.json({ requests: r.rows });
}));

const proposalSchema = z.object({
  pricePaisa: z.number().int().min(0),
  scope: z.string().trim().min(10).max(2000),
  availability: z.string().trim().min(4).max(300),
});

/** A pro (or admin) proposes on a request. Admin approval per platform policy. */
router.post(
  "/quotes/requests/:id/proposals",
  requireAuth,
  requireRole("WORKER", "ADMIN"),
  validate(proposalSchema),
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof proposalSchema>;
    const uid = req.user!.id;
    const isAdmin = req.user!.roles.includes("ADMIN");
    const q = await query<{ id: string; status: string; category_id: string | null }>(
      `SELECT id, status, category_id FROM quote_requests WHERE id = $1`, [req.params.id]);
    if (q.rowCount === 0) return res.status(404).json({ error: "Not found" });
    if (!["open", "quoted"].includes(q.rows[0].status)) {
      return res.status(409).json({ error: "Request no longer open" });
    }
    let workerId: string | null = null;
    if (!isAdmin) {
      const w = await query<{ ok: boolean }>(
        `SELECT (verification_state = 'verified' AND is_active = true) AS ok FROM worker_profiles WHERE user_id = $1`, [uid]);
      if (w.rowCount === 0 || !w.rows[0].ok) return res.status(403).json({ error: "Only verified, active pros" });
      workerId = uid;
    }
    const settings = await query<{ value: Record<string, number | boolean> }>(`SELECT value FROM settings WHERE id = 'platform'`);
    const v = settings.rows[0]?.value ?? {};
    const needApproval = v.quotesRequireAdminApproval !== false && f.pricePaisa >= Number(v.quotesApprovalThresholdPaisa ?? 500000);
    const r = await query<{ id: string }>(
      `INSERT INTO quote_proposals(request_id, worker_user_id, price_paisa, scope, availability, approved, approved_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [q.rows[0].id, workerId, f.pricePaisa, f.scope, f.availability, !needApproval, !needApproval ? uid : null]);
    await query(`UPDATE quote_requests SET status = 'quoted' WHERE id = $1`, [q.rows[0].id]);
    return res.status(201).json({ ok: true, id: r.rows[0].id, needsApproval: needApproval });
  }),
);

/** Admin approves a proposal for sensitive/high-value jobs. */
router.post(
  "/quotes/proposals/:id/approve",
  requireAuth,
  requireRole("ADMIN"),
  ah(async (req, res) => {
    await query(`UPDATE quote_proposals SET approved = true, approved_by = $1 WHERE id = $2`, [req.user!.id, req.params.id]);
    await audit(req.user!.id, "ADMIN", "quote-approve", req.params.id);
    return res.json({ ok: true });
  }),
);

/** Customer accepts an approved proposal → a confirmed booking with the pro assigned. */
router.post("/quotes/proposals/:id/accept", requireAuth, ah(async (req, res) => {
  const uid = req.user!.id;
  const p = await query<{
    id: string; request_id: string; worker_user_id: string | null; price_paisa: number; approved: boolean;
    customer_id: string; req_status: string; title: string; description: string; ward: number | null; landmark: string;
  }>(
    `SELECT p.*, q.customer_id, q.status AS req_status, q.title, q.description, q.ward, q.landmark
     FROM quote_proposals p JOIN quote_requests q ON q.id = p.request_id WHERE p.id = $1`, [req.params.id]);
  if (p.rowCount === 0) return res.status(404).json({ error: "Not found" });
  const prop = p.rows[0];
  if (prop.customer_id !== uid && !req.user!.roles.includes("ADMIN")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!prop.approved) return res.status(400).json({ error: "Proposal needs admin approval first" });
  if (prop.req_status !== "quoted" && prop.req_status !== "open") {
    return res.status(409).json({ error: "Request already handled" });
  }
  if (!prop.worker_user_id) return res.status(400).json({ error: "Admin-authored proposal needs a pro assigned first" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Quote services resolve to a generic inspection service if none matches.
    const svc = await client.query<{ id: string; commission_bps: number }>(
      `SELECT s.id, c.commission_bps FROM services s JOIN categories c ON c.id = s.category_id
       WHERE s.is_active = true AND 'Damak' = ANY (s.areas) ORDER BY s.created_at LIMIT 1`);
    if (svc.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No active Damak service to attach" });
    }
    const no = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    const b = await client.query<{ id: string }>(
      `INSERT INTO bookings(booking_no, customer_id, service_id, worker_id, status, address_text, ward,
        slot, instructions, estimate_paisa, final_paisa, payment_method, payment_status, commission_bps)
       VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, now() + interval '2 days', $7, $8, $8, 'cash', 'unpaid', $9)
       RETURNING id`,
      [no, prop.customer_id, svc.rows[0].id, prop.worker_user_id,
        `${prop.landmark}, Damak`, prop.ward, `${prop.title} — ${prop.description}`.slice(0, 2000),
        prop.price_paisa, svc.rows[0].commission_bps]);
    const bookingId = b.rows[0].id;
    await client.query(
      `INSERT INTO booking_events(booking_id, status, by_role, by_user_id, note) VALUES
       ($1, 'pending', 'customer', $2, 'via accepted quote'),
       ($1, 'confirmed', 'customer', $2, 'quote accepted')`, [bookingId, prop.customer_id]);
    await client.query(
      `INSERT INTO assignments(booking_id, worker_user_id, assigned_by, reason) VALUES ($1, $2, $3, 'quote accepted')`,
      [bookingId, prop.worker_user_id, uid]);
    await client.query(
      `INSERT INTO payments(booking_id, provider, amount_paisa, status) VALUES ($1, 'cash', $2, 'pending')`,
      [bookingId, prop.price_paisa]);
    await client.query(`UPDATE quote_requests SET status = 'accepted', booking_id = $1 WHERE id = $2`, [bookingId, prop.request_id]);
    await notify(client, prop.worker_user_id, "Quote accepted", "A customer accepted your proposal.");
    await client.query("COMMIT");
    return res.status(201).json({ ok: true, bookingNo: no, id: bookingId });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

export default router;
