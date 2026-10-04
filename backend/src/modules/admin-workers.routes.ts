import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { likePattern } from "../utils/sql.js";
import { pageLimit } from "../utils/pagination.js";

const router = Router();
// Per-route guards (NOT router-level): several admin routers share the
// /api prefix, and a router-level guard would 403 other teams before
// their own router is reached.
const adminOnly = [requireAuth, requireRole("ADMIN")];

async function audit(actorId: string, action: string, detail: string) {
  await query(`INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, 'ADMIN', $2, $3)`, [
    actorId,
    action,
    detail,
  ]);
}

// ---------- Workers ----------
router.get(
  "/admin/workers",
  ...adminOnly,
  ah(async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const { page, limit, offset } = pageLimit(req.query, 20, 50);
    const conds = ["1=1"];
    const params: unknown[] = [];
    if (state) {
      params.push(state);
      conds.push(`wp.verification_state = $${params.length}`);
    }
    if (q) {
      params.push(likePattern(q));
      conds.push(
        `(u.name ILIKE $${params.length} ESCAPE '\\' OR u.email ILIKE $${params.length} ESCAPE '\\')`,
      );
    }
    const where = `WHERE ${conds.join(" AND ")}`;
    const total = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM users u JOIN worker_profiles wp ON wp.user_id = u.id ${where}`,
      params,
    );
    const r = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active AS user_active,
              wp.bio, wp.years_exp, wp.areas, wp.avatar_hue, wp.verification_state, wp.is_active,
              (SELECT COUNT(*)::int FROM bookings WHERE worker_id = u.id AND status = 'completed') AS jobs_done,
              COALESCE((SELECT array_agg(DISTINCT c.slug) FROM worker_services ws
                        JOIN services s ON s.id = ws.service_id
                        JOIN categories c ON c.id = s.category_id
                        WHERE ws.worker_user_id = u.id), '{}') AS categories
       FROM users u JOIN worker_profiles wp ON wp.user_id = u.id
       ${where} ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return res.json({ workers: r.rows, total: Number(total.rows[0]?.total ?? 0), page, limit });
  }),
);

const verifySchema = z.object({
  state: z.enum(["verified", "rejected", "suspended", "under-review", "awaiting-documents"]),
  notes: z.string().max(1000).default(""),
});

const createWorkerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).default(""),
  bio: z.string().max(2000).default(""),
  yearsExp: z.number().int().min(0).max(60).default(0),
  areas: z.array(z.string().max(60)).max(20).default(["Damak"]),
  avatarHue: z.number().int().min(0).max(360).default(150),
  categoryIds: z.array(z.string().uuid()).max(20).default([]),
});

// Admin-only: create the worker account + profile, return a one-time invite token.
router.post(
  "/admin/workers",
  requireAuth,
  requireRole("ADMIN"),
  validate(createWorkerSchema),
  ah(async (req, res) => {
    const body = req.body as z.infer<typeof createWorkerSchema>;
    const dupe = await query(`SELECT id FROM users WHERE email = $1`, [body.email]);
    if (dupe.rowCount > 0) return res.status(409).json({ error: "Email already in use" });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const u = await client.query(
        `INSERT INTO users(email, name, phone, is_active) VALUES ($1, $2, $3, $4) RETURNING id`,
        [body.email, body.name, body.phone, false],
      );
      const userId = u.rows[0].id as string;
      const role = await client.query(`SELECT id FROM roles WHERE name = 'WORKER'`);
      await client.query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)`, [
        userId,
        role.rows[0].id,
      ]);
      await client.query(
        `INSERT INTO worker_profiles(user_id, bio, years_exp, areas, avatar_hue, verification_state, is_active)
         VALUES ($1, $2, $3, $4, $5, 'draft', false)`,
        [userId, body.bio, body.yearsExp, body.areas, body.avatarHue],
      );
      // Capabilities: every active service in the chosen categories.
      if (body.categoryIds.length > 0) {
        await client.query(
          `INSERT INTO worker_services(worker_user_id, service_id)
           SELECT $1, s.id FROM services s WHERE s.category_id = ANY($2::uuid[]) AND s.is_active = true
           ON CONFLICT DO NOTHING`,
          [userId, body.categoryIds],
        );
      }
      await client.query(
        `INSERT INTO worker_invites(email, name, token_hash, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [body.email, body.name, tokenHash, expires.toISOString(), req.user!.id],
      );
      await client.query(
        `INSERT INTO verification_records(worker_user_id, state, reviewer_id, notes)
         VALUES ($1, 'draft', $2, 'Account created by admin; invite issued.')`,
        [userId, req.user!.id],
      );
      await client.query(
        `INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, 'ADMIN', 'worker-create', $2)`,
        [req.user!.id, `Worker account created for ${body.email}`],
      );
      await client.query("COMMIT");
      return res.status(201).json({ ok: true, userId, inviteToken: rawToken, expiresAt: expires.toISOString() });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

router.post(
  "/admin/workers/:id/verify",
  validate(verifySchema),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof verifySchema>;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const u = await client.query(`UPDATE worker_profiles SET verification_state = $1, updated_at = now(),
        is_active = CASE WHEN $1 = 'verified' THEN true WHEN $1 IN ('rejected','suspended') THEN false ELSE is_active END
        WHERE user_id = $2 RETURNING user_id`, [f.state, req.params.id]);
      if (u.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Not found" });
      }
      await client.query(
        `INSERT INTO verification_records(worker_user_id, state, reviewer_id, notes) VALUES ($1, $2, $3, $4)`,
        [req.params.id, f.state, req.user!.id, f.notes],
      );
      await client.query(
        `INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, 'ADMIN', 'verify', $2)`,
        [req.user!.id, `${req.params.id} -> ${f.state}: ${f.notes}`.slice(0, 400)],
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

router.post(
  "/admin/workers/:id/activate",
  validate(z.object({ active: z.boolean() })),
  ...adminOnly,
  ah(async (req, res) => {
    const { active } = req.body as { active: boolean };
    const r = await query(`UPDATE worker_profiles SET is_active = $1, updated_at = now() WHERE user_id = $2`, [
      active,
      req.params.id,
    ]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await audit(req.user!.id, active ? "worker-activate" : "worker-suspend", req.params.id);
    return res.json({ ok: true });
  }),
);

export default router;
