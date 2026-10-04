import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { pageLimit } from "../utils/pagination.js";

const router = Router();
// Per-route guards (NOT router-level): several admin routers share the
// /api prefix — see admin-workers.routes.ts.
const adminOnly = [requireAuth, requireRole("ADMIN")];

async function audit(actorId: string, action: string, detail: string) {
  await query(`INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, 'ADMIN', $2, $3)`, [
    actorId,
    action,
    detail,
  ]);
}

// ---------- Support admin ----------
router.get(
  "/admin/tickets",
  ...adminOnly,
  ah(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const { page, limit, offset } = pageLimit(req.query, 20, 50);
    const params: unknown[] = [];
    if (status) params.push(status);
    const clause = status ? "WHERE t.status = $1" : "";
    const total = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM support_tickets t ${clause}`,
      params,
    );
    const r = await query(
      `SELECT t.*, u.name AS user_name,
              (SELECT json_agg(json_build_object('from', m.from_role, 'text', m.body, 'at', m.created_at)
                               ORDER BY m.created_at)
               FROM ticket_messages m WHERE m.ticket_id = t.id) AS messages
       FROM support_tickets t JOIN users u ON u.id = t.user_id
       ${clause} ORDER BY t.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return res.json({ tickets: r.rows, total: Number(total.rows[0]?.total ?? 0), page, limit });
  }),
);

router.post(
  "/admin/tickets/:id/reply",
  validate(z.object({ body: z.string().trim().min(1).max(2000) })),
  ...adminOnly,
  ah(async (req, res) => {
    const { body } = req.body as { body: string };
    const t = await query(`SELECT id FROM support_tickets WHERE id = $1`, [req.params.id]);
    if (t.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await query(
      `INSERT INTO ticket_messages(ticket_id, from_role, body) VALUES ($1, 'support', $2)`,
      [req.params.id, body],
    );
    await query(`UPDATE support_tickets SET status = 'in-progress', updated_at = now() WHERE id = $1`, [
      req.params.id,
    ]);
    await audit(req.user!.id, "support-reply", req.params.id);
    return res.json({ ok: true });
  }),
);

router.post(
  "/admin/tickets/:id/status",
  validate(z.object({ status: z.enum(["open", "in-progress", "resolved"]) })),
  ...adminOnly,
  ah(async (req, res) => {
    const { status } = req.body as { status: string };
    const r = await query(`UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2`, [
      status,
      req.params.id,
    ]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  }),
);

export default router;
