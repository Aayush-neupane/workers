import { Router } from "express";
import { pool, query } from "../db/pool.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { pageLimit } from "../utils/pagination.js";

const router = Router();
// Per-route guards (NOT router-level): several admin routers share the
// /api prefix — see admin-workers.routes.ts.
const adminOnly = [requireAuth, requireRole("ADMIN")];

// ---------- Invitations ----------
router.get(
  "/admin/invites",
  ...adminOnly,
  ah(async (req, res) => {
    const { page, limit, offset } = pageLimit(req.query, 20, 50);
    const total = await query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM worker_invites`);
    const r = await query(
      `SELECT i.id, i.email, i.name, i.expires_at, i.accepted_at, i.created_at,
              u.id AS user_id
       FROM worker_invites i LEFT JOIN users u ON u.email = i.email
       ORDER BY i.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return res.json({ invites: r.rows, total: Number(total.rows[0]?.total ?? 0), page, limit });
  }),
);

router.delete(
  "/admin/invites/:id",
  ...adminOnly,
  ah(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inv = await client.query(`SELECT * FROM worker_invites WHERE id = $1`, [req.params.id]);
      if (inv.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Not found" });
      }
      const invite = inv.rows[0] as { accepted_at: string | null; email: string };
      if (invite.accepted_at) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Already accepted — suspend the worker instead" });
      }
      const jobs = await client.query(
        `SELECT 1 FROM bookings b JOIN users u ON u.email = $1
         WHERE b.worker_id = u.id OR b.customer_id = u.id LIMIT 1`,
        [invite.email],
      );
      if ((jobs.rowCount ?? 0) > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Worker has bookings — suspend instead" });
      }
      await client.query(`DELETE FROM users WHERE email = $1`, [invite.email]);
      await client.query(`DELETE FROM worker_invites WHERE id = $1`, [req.params.id]);
      await client.query(
        `INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, 'ADMIN', 'invite-revoke', $2)`,
        [req.user!.id, `Invite revoked for ${invite.email}`],
      );
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
