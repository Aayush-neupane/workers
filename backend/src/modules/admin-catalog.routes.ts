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

// ---------- Catalog management ----------
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80),
  tagline: z.string().max(200).default(""),
  icon: z.string().max(40).default("wrench"),
  commissionBps: z.number().int().min(0).max(10000).default(1500),
  sortOrder: z.number().int().default(0),
});

router.post(
  "/admin/categories",
  validate(categorySchema),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof categorySchema>;
    try {
      const r = await query(
        `INSERT INTO categories(name, slug, tagline, icon, commission_bps, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [f.name, f.slug, f.tagline, f.icon, f.commissionBps, f.sortOrder],
      );
      await audit(req.user!.id, "category-create", f.slug);
      return res.status(201).json({ ok: true, id: (r.rows[0] as { id: string }).id });
    } catch {
      return res.status(409).json({ error: "Slug already exists" });
    }
  }),
);

router.put(
  "/admin/categories/:id",
  validate(categorySchema.partial()),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as Partial<z.infer<typeof categorySchema>>;
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      name: "name",
      slug: "slug",
      tagline: "tagline",
      icon: "icon",
      commissionBps: "commission_bps",
      sortOrder: "sort_order",
    };
    for (const [k, col] of Object.entries(map)) {
      const v = (f as Record<string, unknown>)[k];
      if (v !== undefined) {
        params.push(v);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });
    params.push(req.params.id);
    const r = await query(`UPDATE categories SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await audit(req.user!.id, "category-update", req.params.id);
    return res.json({ ok: true });
  }),
);

const serviceSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(4000).default(""),
  pricingModel: z.enum(["fixed", "starting", "hourly", "inspection-quote", "custom-quote"]),
  basePricePaisa: z.number().int().min(0),
  unit: z.string().max(40).default(""),
  durationMin: z.number().int().min(0).default(60),
  areas: z.array(z.string().max(60)).default(["Damak"]),
  requirements: z.array(z.string().max(300)).default([]),
  exclusions: z.array(z.string().max(300)).default([]),
  isActive: z.boolean().default(true),
});

router.post(
  "/admin/services",
  validate(serviceSchema),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as z.infer<typeof serviceSchema>;
    const r = await query(
      `INSERT INTO services(category_id, name, description, pricing_model, base_price_paisa, unit,
                            duration_min, areas, requirements, exclusions, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [f.categoryId, f.name, f.description, f.pricingModel, f.basePricePaisa, f.unit, f.durationMin, f.areas, f.requirements, f.exclusions, f.isActive],
    );
    await audit(req.user!.id, "service-create", f.name.slice(0, 120));
    return res.status(201).json({ ok: true, id: (r.rows[0] as { id: string }).id });
  }),
);

router.put(
  "/admin/services/:id",
  validate(serviceSchema.partial()),
  ...adminOnly,
  ah(async (req, res) => {
    const f = req.body as Partial<z.infer<typeof serviceSchema>>;
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      categoryId: "category_id",
      name: "name",
      description: "description",
      pricingModel: "pricing_model",
      basePricePaisa: "base_price_paisa",
      unit: "unit",
      durationMin: "duration_min",
      areas: "areas",
      requirements: "requirements",
      exclusions: "exclusions",
      isActive: "is_active",
    };
    for (const [k, col] of Object.entries(map)) {
      const v = (f as Record<string, unknown>)[k];
      if (v !== undefined) {
        params.push(v);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });
    params.push(req.params.id);
    const r = await query(
      `UPDATE services SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`,
      params,
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await audit(req.user!.id, "service-update", req.params.id);
    return res.json({ ok: true });
  }),
);

router.get(
  "/admin/services-all",
  ...adminOnly,
  ah(async (req, res) => {
    const { page, limit, offset } = pageLimit(req.query, 20, 50);
    const total = await query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM services`);
    const r = await query(
      `SELECT s.*, c.name AS category_name FROM services s
       LEFT JOIN categories c ON c.id = s.category_id ORDER BY s.name LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return res.json({ services: r.rows, total: Number(total.rows[0]?.total ?? 0), page, limit });
  }),
);

export default router;
