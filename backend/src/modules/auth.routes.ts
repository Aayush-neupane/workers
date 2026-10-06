import { Router } from "express";
import bcrypt from "bcryptjs";
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
          await redeemReferralCode(client, f.referralCode, f.email, userId, phone);
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
      void audit(null, "AUTH", "login-failed", f.email).catch(() => {});
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!r.rows[0].is_active) return res.status(403).json({ error: "Account suspended" });
    const ok = await bcrypt.compare(f.password, r.rows[0].password_hash!);
    if (!ok) {
      void audit(null, "AUTH", "login-failed", f.email).catch(() => {});
      return res.status(401).json({ error: "Invalid email or password" });
    }
    setSession(res, await signSession(r.rows[0].id, Number(r.rows[0].pwdVersion)));
    return res.json({ ok: true });
  }),
);

router.post("/logout", ah(async (_req, res) => {
  clearSession(res);
  return res.json({ ok: true });
}));

/**
 * Sign out everywhere: bumps the session version so every token issued
 * before now dies — including tokens on stolen devices. The current cookie
 * is cleared too, so the caller re-logs-in.
 */
router.post("/logout-all", requireAuth, ah(async (req, res) => {
  await query(`UPDATE users SET password_changed_at = now() WHERE id = $1`, [req.user!.id]);
  await audit(req.user!.id, req.user!.roles[0] ?? "", "logout-all", req.user!.email);
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

export default router;
