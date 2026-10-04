import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

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

// ---------- Coverage ----------
router.get(
  "/admin/wards",
  ...adminOnly,
  ah(async (_req, res) => {
    const r = await query(`SELECT ward, is_open FROM coverage_wards ORDER BY ward`);
    return res.json({ zone: "Damak", wards: r.rows });
  }),
);

router.put(
  "/admin/wards",
  validate(z.object({ wards: z.array(z.boolean()).length(10) })),
  ...adminOnly,
  ah(async (req, res) => {
    const { wards } = req.body as { wards: boolean[] };
    for (let i = 0; i < 10; i++) {
      await query(`UPDATE coverage_wards SET is_open = $1, updated_at = now() WHERE ward = $2`, [
        wards[i],
        i + 1,
      ]);
    }
    await audit(req.user!.id, "coverage", `wards open: ${wards.filter(Boolean).length}/10`);
    return res.json({ ok: true });
  }),
);

// ---------- Commission overrides ----------
router.get(
  "/admin/commission-overrides",
  ...adminOnly,
  ah(async (_req, res) => {
    const r = await query(
      `SELECT o.*, cu.name AS customer_name, c.name AS category_name
       FROM commission_overrides o
       LEFT JOIN users cu ON cu.id = o.worker_user_id
       LEFT JOIN categories c ON c.id = o.category_id`,
    );
    return res.json({ overrides: r.rows });
  }),
);

router.post(
  "/admin/commission-overrides",
  validate(z.object({
    workerId: z.string().uuid().nullable().default(null),
    categoryId: z.string().uuid().nullable().default(null),
    rateBps: z.number().int().min(0).max(10000),
  })),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as { workerId: string | null; categoryId: string | null; rateBps: number };
    if (!f.workerId && !f.categoryId) return res.status(400).json({ error: "Scope required" });
    await query(
      `INSERT INTO commission_overrides(worker_user_id, category_id, rate_bps)
       VALUES ($1, $2, $3) ON CONFLICT (worker_user_id, category_id) DO UPDATE SET rate_bps = EXCLUDED.rate_bps`,
      [f.workerId, f.categoryId, f.rateBps],
    );
    await audit(req.user!.id, "commission-override", `${f.workerId ?? "*"} / ${f.categoryId ?? "*"} = ${f.rateBps}bps`);
    return res.json({ ok: true });
  }),
);

export default router;
