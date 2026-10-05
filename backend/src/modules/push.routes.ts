import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { pushEnabled, pushToUser } from "../services/push.js";

const router = Router();

router.get("/push/vapid-key", ah(async (_req, res) => {
  if (!pushEnabled) return res.status(503).json({ error: "Push not configured" });
  return res.json({ key: env.VAPID_PUBLIC_KEY });
}));

const subSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(10).max(200),
  audience: z.enum(["customer", "worker", "admin"]),
});

/** Register a device. Audience must match a role the user actually holds. */
router.post("/push/subscribe", requireAuth, validate(subSchema), ah(async (req, res) => {
  if (!pushEnabled) return res.status(503).json({ error: "Push not configured" });
  const f = req.body as z.infer<typeof subSchema>;
  const need = f.audience.toUpperCase();
  const roles = req.user!.roles;
  const audienceOk = roles.includes(need) || (need === "ADMIN" && roles.includes("SUB_ADMIN"));
  if (!audienceOk) {
    return res.status(403).json({ error: "Audience does not match your role" });
  }
  // One endpoint belongs to one owner: only the owner can re-register it,
  // and each user gets at most 10 devices (table-bloat guard).
  const owner = await query<{ user_id: string }>(
    `SELECT user_id FROM push_subscriptions WHERE endpoint = $1`, [f.endpoint]);
  if ((owner.rowCount ?? 0) > 0 && owner.rows[0].user_id !== req.user!.id) {
    return res.status(409).json({ error: "This device is registered to another account" });
  }
  const count = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE user_id = $1`, [req.user!.id]);
  if (count.rows[0].n >= 10 && (owner.rowCount ?? 0) === 0) {
    return res.status(400).json({ error: "Too many devices — remove one first" });
  }
  await query(
    `INSERT INTO push_subscriptions(endpoint, user_id, audience, p256dh, auth)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, audience = EXCLUDED.audience,
       p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [f.endpoint, req.user!.id, f.audience, f.p256dh, f.auth]);
  return res.json({ ok: true });
}));

router.post(
  "/push/unsubscribe",
  requireAuth,
  validate(z.object({ endpoint: z.string().url().max(2000) })),
  ah(async (req, res) => {
    const f = req.body as { endpoint: string };
    await query(`DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`, [f.endpoint, req.user!.id]);
    return res.json({ ok: true });
  }),
);

router.get("/push/devices", requireAuth, ah(async (req, res) => {
  const r = await query(
    `SELECT audience, created_at FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user!.id]);
  return res.json({ devices: r.rows, enabled: pushEnabled });
}));

/** Buzz yourself — proves the whole chain works on this device. */
router.post("/push/test", requireAuth, ah(async (req, res) => {
  if (!pushEnabled) return res.status(503).json({ error: "Push not configured" });
  const sent = await pushToUser(req.user!.id, {
    title: "Sajilo Damak",
    body: "Push is working — booking updates will arrive here.",
    url: "/dashboard",
    tag: "push-test",
  });
  return res.json({ ok: true, sent });
}));

export default router;
