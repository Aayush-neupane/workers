import { Router } from "express";
import type { Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { query } from "../db/pool.js";
import { pool } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole, signSession, SESSION_COOKIE } from "../middleware/auth.js";
import { env, isProd } from "../config/env.js";

const router = Router();

async function issueSession(res: Response, userId: string) {
  const token = await signSession(userId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

async function grantRole(userId: string, role: string) {
  const r = await query<{ id: string }>(`SELECT id FROM roles WHERE name = $1`, [role]);
  if (r.rowCount === 0) throw new Error(`unknown role ${role}`);
  await query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    userId,
    r.rows[0].id,
  ]);
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(20),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

// Customers self-register. Workers/admins are created by admins — never here.
router.post(
  "/register",
  validate(registerSchema),
  ah(async (req, res) => {
    const { name, phone, email, password } = req.body as z.infer<typeof registerSchema>;
    const dupe = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (dupe.rowCount > 0) return res.status(409).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 10);
    const u = await query<{ id: string }>(
      `INSERT INTO users(email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
      [email, hash, name, phone],
    );
    await grantRole(u.rows[0].id, "CUSTOMER");
    await issueSession(res, u.rows[0].id);
    return res.status(201).json({ ok: true });
  }),
);

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  validate(loginSchema),
  ah(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const r = await query<{ id: string; password_hash: string | null }>(
      `SELECT id, password_hash FROM users WHERE email = $1 AND is_active = true`,
      [email],
    );
    if (r.rowCount === 0 || !r.rows[0].password_hash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, r.rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    await issueSession(res, r.rows[0].id);
    return res.json({ ok: true });
  }),
);

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  return res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user, env: env.NODE_ENV });
});

const createWorkerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).default(""),
  bio: z.string().max(2000).default(""),
  yearsExp: z.number().int().min(0).max(60).default(0),
  areas: z.array(z.string().max(60)).max(20).default(["Damak"]),
  avatarHue: z.number().int().min(0).max(360).default(150),
});

// Admin-only: create the worker account + profile, return a one-time invite token.
router.post(
  "/workers",
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

const acceptSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8).max(128),
});

// Invited worker sets their password and activates the invite.
router.post(
  "/worker/accept",
  validate(acceptSchema),
  ah(async (req, res) => {
    const { token, password } = req.body as z.infer<typeof acceptSchema>;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const inv = await query<{ id: string; email: string; expires_at: string; accepted_at: string | null }>(
      `SELECT id, email, expires_at, accepted_at FROM worker_invites WHERE token_hash = $1`,
      [tokenHash],
    );
    if (inv.rowCount === 0) return res.status(404).json({ error: "Invalid invitation" });
    const invite = inv.rows[0];
    if (invite.accepted_at) return res.status(410).json({ error: "Invitation already used" });
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ error: "Invitation expired" });
    }
    const hash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const u = await client.query(`UPDATE users SET password_hash = $1, is_active = true WHERE email = $2 RETURNING id`, [
        hash,
        invite.email,
      ]);
      await client.query(`UPDATE worker_invites SET accepted_at = now() WHERE id = $1`, [invite.id]);
      await client.query(
        `UPDATE worker_profiles SET verification_state = 'awaiting-documents' WHERE user_id = $1`,
        [u.rows[0].id],
      );
      await client.query(
        `INSERT INTO verification_records(worker_user_id, state, notes) VALUES ($1, 'awaiting-documents', 'Invite accepted; documents requested.')`,
        [u.rows[0].id],
      );
      await client.query("COMMIT");
      await issueSession(res, u.rows[0].id);
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
