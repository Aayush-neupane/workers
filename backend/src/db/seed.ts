import bcrypt from "bcryptjs";
import { pool, query } from "./pool.js";

const ADMIN_EMAIL = "admin@sajilo.local";
const ADMIN_PASSWORD = "ChangeMe123!";

async function role(name: string) {
  const r = await query(`INSERT INTO roles(name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [name]);
  return (r.rows[0] as { id: string }).id;
}

async function perm(name: string) {
  const r = await query(`INSERT INTO permissions(name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [name]);
  return (r.rows[0] as { id: string }).id;
}

const customerId = await role("CUSTOMER");
const workerId = await role("WORKER");
const adminId = await role("ADMIN");

const perms = [
  "worker.invite", "worker.verify", "worker.activate", "worker.assign",
  "catalog.edit", "coverage.edit", "commission.edit",
  "finance.settle", "finance.refund", "rewards.edit",
  "support.reply", "quotes.approve", "settings.edit", "audit.read",
];
const permIds: Record<string, string> = {};
for (const p of perms) permIds[p] = await perm(p);
for (const p of perms) {
  await query(`INSERT INTO role_permissions(role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [adminId, permIds[p]]);
}
// Support-light capabilities for future staff roles (least privilege ready).
for (const p of ["support.reply", "audit.read"]) {
  await query(`INSERT INTO role_permissions(role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [workerId, permIds[p]]);
}
void customerId;

const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
const u = await query(
  `INSERT INTO users(email, password_hash, name, phone) VALUES ($1, $2, 'Sajilo Admin', '9852600000')
   ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  [ADMIN_EMAIL, hash],
);
const adminUserId = (u.rows[0] as { id: string }).id;
await query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [adminUserId, adminId]);

const cats: [string, string, string, string, number, number][] = [
  ["Electrical", "electrical", "Wiring, switches, fixtures", "zap", 1500, 1],
  ["Plumbing", "plumbing", "Leaks, fittings, tanks", "droplet", 1500, 2],
  ["Cleaning", "cleaning", "Home & deep cleaning", "sparkles", 1200, 3],
  ["Appliance", "appliance", "Repair & installation", "plug", 1500, 4],
  ["Painting", "painting", "Rooms & exteriors", "paintbrush", 1200, 5],
  ["Carpentry", "carpentry", "Furniture & fittings", "hammer", 1200, 6],
];
for (const [name, slug, tagline, icon, bps, sort] of cats) {
  await query(
    `INSERT INTO categories(name, slug, tagline, icon, commission_bps, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (slug) DO NOTHING`,
    [name, slug, tagline, icon, bps, sort],
  );
}

const services: [string, string, string, string, number, number][] = [
  ["electrical", "Switch & socket repair", "Diagnose and fix faulty switches, sockets and holders.", "fixed", 80000, 45],
  ["electrical", "Ceiling fan installation", "Install or replace a ceiling fan with testing.", "fixed", 120000, 60],
  ["plumbing", "Tap & mixer repair", "Fix drips, replace washers and cartridges.", "fixed", 70000, 45],
  ["plumbing", "Water tank cleaning", "Scrub and disinfect rooftop plastic tanks.", "starting", 150000, 90],
  ["cleaning", "Full home deep cleaning", "Room-by-room deep clean by a trained team.", "starting", 350000, 240],
  ["cleaning", "Bathroom deep cleaning", "Descale, scrub and sanitize one bathroom.", "fixed", 120000, 60],
  ["appliance", "AC servicing", "Foam-jet indoor service with gas check.", "fixed", 250000, 90],
  ["painting", "Room repaint (quote)", "Site visit first, fixed quote after inspection.", "inspection-quote", 0, 120],
  ["carpentry", "Furniture repair (quote)", "Send photos, get a fixed quote before work.", "custom-quote", 0, 60],
];
for (const [slug, name, desc, model, price, dur] of services) {
  const c = await query<{ id: string }>(`SELECT id FROM categories WHERE slug = $1`, [slug]);
  if (c.rowCount === 0) continue;
  await query(
    `INSERT INTO services(category_id, name, description, pricing_model, base_price_paisa, duration_min)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [c.rows[0].id, name, desc, model, price, dur],
  );
}

console.log(`[db] seed ok — admin ${ADMIN_EMAIL} (change the password immediately)`);
await pool.end();
