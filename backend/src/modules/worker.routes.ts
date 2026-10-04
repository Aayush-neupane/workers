import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("WORKER", "ADMIN"));

function eligible(req: { user?: { id: string } }) {
  return query(
    `SELECT verification_state = 'verified' AND is_active = true AS ok FROM worker_profiles WHERE user_id = $1`,
    [req.user!.id],
  );
}

/** Today's schedule + new assignment requests + upcoming — the pro's four questions. */
router.get("/worker/jobs", ah(async (req, res) => {
  const e = await eligible(req);
  if (!e.rows[0]?.ok && !req.user!.roles.includes("ADMIN")) {
    return res.status(403).json({ error: "Only verified, active pros" });
  }
  const r = await query(
    `SELECT b.*, s.name AS service_name
     FROM bookings b LEFT JOIN services s ON s.id = b.service_id
     WHERE b.worker_id = $1 AND b.status NOT IN ('completed', 'cancelled')
     ORDER BY b.slot`, [req.user!.id]);
  const open = await query(
    `SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id = b.service_id
     JOIN worker_services ws ON ws.service_id = s.id
     WHERE b.status = 'awaiting-worker' AND ws.worker_user_id = $1 ORDER BY b.slot LIMIT 20`,
    [req.user!.id]);
  return res.json({ jobs: r.rows, requests: open.rows });
}));

router.get("/worker/earnings", ah(async (req, res) => {
  const r = await query(
    `SELECT cl.*, b.booking_no FROM commission_ledger cl JOIN bookings b ON b.id = cl.booking_id
     WHERE b.worker_id = $1 ORDER BY cl.created_at DESC`, [req.user!.id]);
  const rows = r.rows as { worker_paisa: string; commission_paisa: string; is_settled: boolean }[];
  const net = rows.reduce((n, x) => n + Number(x.worker_paisa), 0);
  const owed = rows.filter((x) => !x.is_settled).reduce((n, x) => n + Number(x.commission_paisa), 0);
  const s = await query(`SELECT * FROM settlements WHERE worker_user_id = $1 ORDER BY created_at DESC`, [req.user!.id]);
  return res.json({ ledger: r.rows, netPaisa: net, owedPaisa: owed, settlements: s.rows });
}));

router.get("/worker/availability", ah(async (req, res) => {
  const r = await query(`SELECT dow, is_open FROM worker_availability WHERE user_id = $1 ORDER BY dow`, [req.user!.id]);
  return res.json({ days: r.rows });
}));

router.put(
  "/worker/availability",
  validate(z.object({ days: z.array(z.object({ dow: z.number().int().min(0).max(6), open: z.boolean() })).length(7) })),
  ah(async (req, res) => {
    const { days } = req.body as { days: { dow: number; open: boolean }[] };
    for (const d of days) {
      await query(
        `INSERT INTO worker_availability(user_id, dow, is_open) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, dow) DO UPDATE SET is_open = EXCLUDED.is_open`,
        [req.user!.id, d.dow, d.open]);
    }
    return res.json({ ok: true });
  }),
);

/** Verification document metadata (private-storage upload wiring lands here later). */
router.post(
  "/worker/documents",
  validate(z.object({ kind: z.string().trim().min(2).max(60), storagePath: z.string().trim().min(3).max(500) })),
  ah(async (req, res) => {
    const f = req.body as { kind: string; storagePath: string };
    const r = await query(
      `INSERT INTO verification_documents(worker_user_id, kind, storage_path) VALUES ($1, $2, $3) RETURNING id`,
      [req.user!.id, f.kind, f.storagePath]);
    await query(
      `UPDATE worker_profiles SET verification_state = 'under-review', updated_at = now()
       WHERE user_id = $1 AND verification_state IN ('draft', 'awaiting-documents', 'rejected')`, [req.user!.id]);
    return res.status(201).json({ ok: true, id: (r.rows[0] as { id: string }).id });
  }),
);

export default router;
