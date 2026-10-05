import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, setSession, clearSession, signSession, effectivePermissions, isSuperAdmin } from "../middleware/auth.js";
import { audit } from "../services/notify.js";
import { ensureReferralCode, redeemReferralCode } from "../services/referrals.js";

const router = Router();

// Pre-computed dummy hash so unknown-email logins cost the same bcrypt work
// as real ones (no timing oracle for account enumeration).
const DUMMY_HASH = bcrypt.hashSync("no-such-account", 12);

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(20),
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(8).max(128),
  referralCode: z.string().trim().max(20).optional(),
});

/** Normalize phone: drop spaces/dashes/parens, require +?\d{10,15}. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.trim().replace(/[\s\-().]/g, "");
  return /^\+?\d{10,15}$/.test(digits) ? digits : null;
}

/** Public registration creates CUSTOMERs only — roles are never client-assignable. */
router.post(
  "/register",
  validate(registerSchema),
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof registerSchema>;
    const phone = normalizePhone(f.phone);
    if (!phone) return res.status(400).json({ error: "Enter a valid phone number (10–15 digits)" });
    const hash = await bcrypt.hash(f.password, 12);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let userId: string;
      try {
        const u = await client.query<{ id: string }>(
          `INSERT INTO users(email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
          [f.email, hash, f.name, phone],
        );
        userId = u.rows[0].id;
      } catch (e) {
        if ((e as { code?: string }).code !== "23505") throw e;
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Email already registered" });
      }
      const role = await client.query<{ id: string }>(
        `INSERT INTO roles(name) VALUES ('CUSTOMER') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      );
      if (role.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(500).json({ error: "Signup is not ready yet — please try again shortly" });
      }
      await client.query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2)`, [userId, role.rows[0].id]);
      await ensureReferralCode(client, userId, f.name);
      if (f.referralCode) {
        try {
          await redeemReferralCode(client, f.referralCode, f.email, userId);
        } catch (e) {
          await client.query("ROLLBACK");
          return res.status((e as { status?: number }).status ?? 400).json({
            error: e instanceof Error ? e.message : "Invalid referral code",
          });
        }
      }
      await client.query("COMMIT");
      const ver = await query<{ v: number }>(
        `SELECT (EXTRACT(EPOCH FROM password_changed_at) * 1000)::bigint AS v FROM users WHERE id = $1`, [userId]);
      setSession(res, await signSession(userId, ver.rows[0] ? Number(ver.rows[0].v) : undefined));
      return res.status(201).json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

router.post(
  "/login",
  validate(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) })),
  ah(async (req, res) => {
    const f = req.body as { email: string; password: string };
    const r = await query<{ id: string; password_hash: string | null; is_active: boolean; pwdVersion: number }>(
      `SELECT id, password_hash, is_active, (EXTRACT(EPOCH FROM password_changed_at) * 1000)::bigint AS "pwdVersion"
       FROM users WHERE email = $1`,
      [f.email],
    );
    // Constant-time path for unknown emails: same bcrypt cost either way, so
    // response timing doesn't reveal which emails are registered.
    if (r.rowCount === 0 || !r.rows[0].password_hash) {
      try {
        await bcrypt.compare(f.password, DUMMY_HASH);
      } catch {
        /* timing only — result discarded */
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!r.rows[0].is_active) return res.status(403).json({ error: "Account suspended" });
    const ok = await bcrypt.compare(f.password, r.rows[0].password_hash!);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });
    setSession(res, await signSession(r.rows[0].id, Number(r.rows[0].pwdVersion)));
    return res.json({ ok: true });
  }),
);

router.post("/logout", ah(async (_req, res) => {
  clearSession(res);
  return res.json({ ok: true });
}));

router.get("/me", requireAuth, ah(async (req, res) => {
  const permissions = await effectivePermissions(req.user!.id);
  return res.json({
    user: {
      ...req.user,
      permissions,
      isSuperAdmin: isSuperAdmin(req.user!.roles),
    },
  });
}));

router.patch(
  "/me",
  requireAuth,
  validate(z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().min(10).max(20) })),
  ah(async (req, res) => {
    const f = req.body as { name: string; phone: string };
    await query(`UPDATE users SET name = $1, phone = $2, updated_at = now() WHERE id = $3`, [
      f.name,
      f.phone,
      req.user!.id,
    ]);
    return res.json({ ok: true });
  }),
);

router.patch(
  "/me/onboarding",
  requireAuth,
  validate(z.object({ done: z.boolean() })),
  ah(async (req, res) => {
    const f = req.body as { done: boolean };
    if (!f.done) return res.status(400).json({ error: "Nothing to do" });
    await query(`UPDATE users SET onboarded = true WHERE id = $1`, [req.user!.id]);
    return res.json({ ok: true });
  }),
);

// ---------- Worker invite accept (admin-created invites only) ----------
router.post(
  "/worker/invite/check",
  validate(z.object({ token: z.string().min(8) })),
  ah(async (req, res) => {
    const token = (req.body as { token: string }).token;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const r = await query(
      `SELECT email, name, expires_at, accepted_at FROM worker_invites WHERE token_hash = $1`,
      [tokenHash],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Invalid invitation" });
    return res.json({ invite: r.rows[0] });
  }),
);

router.post(
  "/worker/accept",
  validate(z.object({
    token: z.string().min(8),
    phone: z.string().trim().min(10).max(20),
    password: z.string().min(8).max(128),
  })),
  ah(async (req, res) => {
    const f = req.body as { token: string; phone: string; password: string };
    const tokenHash = createHash("sha256").update(f.token).digest("hex");
    const inv = await query<{ id: string; email: string; name: string; expires_at: string; accepted_at: string | null }>(
      `SELECT * FROM worker_invites WHERE token_hash = $1`,
      [tokenHash],
    );
    if (inv.rowCount === 0) return res.status(404).json({ error: "Invalid invitation" });
    const invite = inv.rows[0];
    if (invite.accepted_at) return res.status(400).json({ error: "Invitation already used" });
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "Invitation expired" });
    }
    const hash = await bcrypt.hash(f.password, 12);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Never overwrite an existing account: invite acceptance must not
      // hijack whoever already owns the email (e.g. an admin address).
      const existing = await client.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [invite.email]);
      if ((existing.rowCount ?? 0) > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "An account with this email already exists — sign in with it, then accept the invitation from your dashboard" });
      }
      const u = await client.query<{ id: string }>(
        `INSERT INTO users(email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
        [invite.email, hash, invite.name, f.phone],
      );
      const userId = u.rows[0].id;
      const role = await client.query<{ id: string }>(
        `INSERT INTO roles(name) VALUES ('WORKER') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      );
      await client.query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, role.rows[0].id]);
      await client.query(
        `INSERT INTO worker_profiles(user_id, verification_state) VALUES ($1, 'awaiting-documents') ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      await client.query(`UPDATE worker_invites SET accepted_at = now() WHERE id = $1`, [invite.id]);
      await client.query("COMMIT");
      await audit(null, "WORKER", "invite-accepted", invite.email);
      const ver = await query<{ v: number }>(
        `SELECT (EXTRACT(EPOCH FROM password_changed_at) * 1000)::bigint AS v FROM users WHERE id = $1`, [userId]);
      setSession(res, await signSession(userId, ver.rows[0] ? Number(ver.rows[0].v) : undefined));
      return res.status(201).json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);

export default router;
