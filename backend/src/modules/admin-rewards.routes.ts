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

// ---------- Rewards admin ----------
router.get(
  "/admin/rewards/rules",
  ...adminOnly,
  ah(async (_req, res) => {
    const r = await query(`SELECT value FROM settings WHERE id = 'platform'`);
    return res.json((r.rows[0] as { value: unknown } | undefined)?.value ?? {});
  }),
);

router.put(
  "/admin/rewards/rules",
  validate(z.object({
    rewardPerNpr100: z.number().int().min(0).optional(),
    milestoneBookings: z.number().int().min(0).optional(),
    milestoneBonus: z.number().int().min(0).optional(),
    redeemPoints: z.number().int().min(1).optional(),
    redeemDiscountPaisa: z.number().int().min(0).optional(),
  })),
  ...adminOnly,
  ah(async (req, res) => {
    const patch = req.body as Record<string, number>;
    await query(
      `UPDATE settings SET value = value || $1::jsonb, updated_at = now() WHERE id = 'platform'`,
      [JSON.stringify(patch)],
    );
    await audit(req.user!.id, "rewards-rules", JSON.stringify(patch).slice(0, 300));
    return res.json({ ok: true });
  }),
);

router.get(
  "/admin/rewards/ledger",
  ...adminOnly,
  ah(async (req, res) => {
    const { page, limit, offset } = pageLimit(req.query, 20, 50);
    const total = await query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM reward_ledger`);
    const r = await query(
      `SELECT rl.*, u.name AS user_name FROM reward_ledger rl JOIN users u ON u.id = rl.user_id
       ORDER BY rl.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return res.json({ ledger: r.rows, total: Number(total.rows[0]?.total ?? 0), page, limit });
  }),
);

export default router;
