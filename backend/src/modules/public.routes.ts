import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { ah } from "../middleware/async.js";

const router = Router();

const uuid = z.string().uuid();

router.get(
  "/categories",
  ah(async (_req, res) => {
    const r = await query(
      `SELECT id, name, slug, tagline, icon, commission_bps, sort_order
       FROM categories WHERE is_active = true ORDER BY sort_order, name`,
    );
    return res.json({ categories: r.rows });
  }),
);

const listQuery = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(40).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["popular", "price-asc", "price-desc", "rating"]).default("popular"),
});

router.get(
  "/services",
  ah(async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
    const { q, category, maxPrice, minRating, sort } = parsed.data;

    const conds = ["s.is_active = true"];
    const params: unknown[] = [];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(s.name ILIKE $${params.length} OR s.description ILIKE $${params.length})`);
    }
    if (category) {
      params.push(category);
      conds.push(`c.slug = $${params.length}`);
    }
    if (maxPrice !== undefined) {
      params.push(maxPrice);
      conds.push(`s.base_price_paisa <= $${params.length}`);
    }
    const order =
      sort === "price-asc"
        ? "s.base_price_paisa ASC"
        : sort === "price-desc"
          ? "s.base_price_paisa DESC"
          : sort === "rating"
            ? "rating DESC NULLS LAST, jobs_done DESC"
            : "jobs_done DESC";
    const having = minRating ? "HAVING COALESCE(AVG(r.rating), 0) >= $R" : "";

    const r = await query(
      `SELECT s.id, s.name, s.description, s.pricing_model, s.base_price_paisa,
              s.unit, s.duration_min, s.areas, s.requirements, s.exclusions,
              c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
              COALESCE(AVG(r.rating), 0)::float AS rating,
              COUNT(DISTINCT cb.id)::int AS jobs_done
       FROM services s
       LEFT JOIN categories c ON c.id = s.category_id
       LEFT JOIN bookings cb ON cb.service_id = s.id AND cb.status = 'completed'
       LEFT JOIN reviews r ON r.booking_id = cb.id
       WHERE ${conds.join(" AND ")}
       GROUP BY s.id, c.id ${having.replace("$R", `$${params.length + 1}`)}
       ORDER BY ${order} LIMIT 100`,
      minRating ? [...params, minRating] : params,
    );
    return res.json({ services: r.rows });
  }),
);

router.get(
  "/services/:id",
  ah(async (req, res) => {
    const parsed = uuid.safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
    const r = await query(
      `SELECT s.*, c.name AS category_name, c.slug AS category_slug,
              COALESCE((SELECT AVG(r.rating) FROM bookings cb JOIN reviews r ON r.booking_id = cb.id
                        WHERE cb.service_id = s.id AND cb.status = 'completed'), 0)::float AS rating,
              (SELECT COUNT(*)::int FROM bookings WHERE service_id = s.id AND status = 'completed') AS jobs_done
       FROM services s LEFT JOIN categories c ON c.id = s.category_id
       WHERE s.id = $1 AND s.is_active = true`,
      [parsed.data],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const service = r.rows[0] as Record<string, unknown>;
    const pros = await query(
      `SELECT u.id, u.name, wp.bio, wp.years_exp, wp.areas, wp.avatar_hue,
              COALESCE((SELECT AVG(r.rating) FROM bookings cb JOIN reviews r ON r.booking_id = cb.id
                        WHERE cb.worker_id = u.id AND cb.status = 'completed'), 0)::float AS rating,
              (SELECT COUNT(*)::int FROM bookings WHERE worker_id = u.id AND status = 'completed') AS jobs_done
       FROM users u JOIN worker_profiles wp ON wp.user_id = u.id
       JOIN worker_services ws ON ws.worker_user_id = u.id
       WHERE ws.service_id = $1 AND wp.verification_state = 'verified' AND wp.is_active = true AND u.is_active = true`,
      [parsed.data],
    );
    const reviews = await query(
      `SELECT r.id, r.rating, r.text, r.created_at, b.booking_no
       FROM reviews r JOIN bookings b ON b.id = r.booking_id
       WHERE b.service_id = $1 ORDER BY r.created_at DESC LIMIT 20`,
      [parsed.data],
    );
    return res.json({ service, pros: pros.rows, reviews: reviews.rows });
  }),
);

router.get(
  "/workers",
  ah(async (req, res) => {
    const eligible = req.query.eligible !== "0";
    const r = await query(
      `SELECT u.id, u.name, wp.bio, wp.years_exp, wp.areas, wp.avatar_hue,
              wp.verification_state, wp.is_active, wp.created_at AS joined_at,
              COALESCE((SELECT AVG(r.rating) FROM bookings cb JOIN reviews r ON r.booking_id = cb.id
                        WHERE cb.worker_id = u.id AND cb.status = 'completed'), 0)::float AS rating,
              (SELECT COUNT(*)::int FROM bookings WHERE worker_id = u.id AND status = 'completed') AS jobs_done
       FROM users u JOIN worker_profiles wp ON wp.user_id = u.id
       WHERE u.is_active = true ${eligible ? "AND wp.verification_state = 'verified' AND wp.is_active = true" : ""}
       ORDER BY jobs_done DESC LIMIT 50`,
    );
    return res.json({ workers: r.rows });
  }),
);

router.get(
  "/workers/:id",
  ah(async (req, res) => {
    const parsed = uuid.safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
    const r = await query(
      `SELECT u.id, u.name, wp.bio, wp.years_exp, wp.areas, wp.avatar_hue,
              wp.verification_state, wp.is_active, wp.created_at AS joined_at,
              COALESCE((SELECT AVG(r.rating) FROM bookings cb JOIN reviews r ON r.booking_id = cb.id
                        WHERE cb.worker_id = u.id AND cb.status = 'completed'), 0)::float AS rating,
              (SELECT COUNT(*)::int FROM bookings WHERE worker_id = u.id AND status = 'completed') AS jobs_done
       FROM users u JOIN worker_profiles wp ON wp.user_id = u.id
       WHERE u.id = $1 AND u.is_active = true`,
      [parsed.data],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const worker = r.rows[0] as Record<string, unknown>;
    const cats = await query(
      `SELECT DISTINCT c.id, c.name, c.slug FROM categories c
       JOIN services s ON s.category_id = c.id
       JOIN worker_services ws ON ws.service_id = s.id
       WHERE ws.worker_user_id = $1`,
      [parsed.data],
    );
    const offered = await query(
      `SELECT s.id, s.category_id, s.name, s.pricing_model, s.base_price_paisa,
              COALESCE((SELECT AVG(r.rating) FROM bookings cb JOIN reviews r ON r.booking_id = cb.id
                        WHERE cb.service_id = s.id AND cb.status = 'completed'), 0)::float AS rating
       FROM services s JOIN worker_services ws ON ws.service_id = s.id
       WHERE ws.worker_user_id = $1 AND s.is_active = true LIMIT 20`,
      [parsed.data],
    );
    const reviews = await query(
      `SELECT r.id, r.rating, r.text, r.created_at, b.booking_no
       FROM reviews r JOIN bookings b ON b.id = r.booking_id
       WHERE r.worker_user_id = $1 ORDER BY r.created_at DESC LIMIT 20`,
      [parsed.data],
    );
    return res.json({
      worker,
      categories: cats.rows,
      offered: offered.rows,
      reviews: reviews.rows,
      eligible: worker.verification_state === "verified" && worker.is_active === true,
    });
  }),
);

router.get(
  "/reviews",
  ah(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const workerId = typeof req.query.workerId === "string" ? req.query.workerId : "";
    const r = await query(
      `SELECT r.id, r.rating, r.text, r.created_at, b.booking_no,
              u.name AS worker_name
       FROM reviews r JOIN bookings b ON b.id = r.booking_id
       LEFT JOIN users u ON u.id = r.worker_user_id
       ${workerId ? "WHERE r.worker_user_id = $2" : ""}
       ORDER BY r.created_at DESC LIMIT $1`,
      workerId ? [limit, workerId] : [limit],
    );
    return res.json({ reviews: r.rows });
  }),
);

router.get(
  "/wards",
  ah(async (_req, res) => {
    const r = await query(`SELECT ward, is_open FROM coverage_wards ORDER BY ward`);
    return res.json({ zone: "Damak", wards: r.rows });
  }),
);

router.get(
  "/settings",
  ah(async (_req, res) => {
    const r = await query<{ value: unknown }>(`SELECT value FROM settings WHERE id = 'platform'`);
    return res.json(r.rows[0]?.value ?? {});
  }),
);

export default router;
