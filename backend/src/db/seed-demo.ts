import bcrypt from "bcryptjs";
import { pool, query } from "./pool.js";

/**
 * Demo dataset for local development — Sajilo Damak.
 * Run AFTER db:seed (needs roles, categories, services, settings).
 *   npm run db:seed-demo
 * Re-runnable: skips when demo users already exist.
 * Demo password for every demo account: Demo1234! (local only, never prod).
 */

const DEMO_PASSWORD = "Demo1234!";

async function userId(email: string, name: string, phone: string, role: string): Promise<string> {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const u = await query<{ id: string }>(
    `INSERT INTO users(email, password_hash, name, phone) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [email, hash, name, phone],
  );
  const id = u.rows[0].id;
  const r = await query<{ id: string }>(`SELECT id FROM roles WHERE name = $1`, [role]);
  if (r.rowCount === 0) throw new Error(`Role ${role} missing — run db:seed first`);
  await query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, r.rows[0].id]);
  return id;
}

async function serviceId(name: string): Promise<string> {
  const r = await query<{ id: string }>(`SELECT id FROM services WHERE name = $1`, [name]);
  if (r.rowCount === 0) throw new Error(`Service "${name}" missing — run db:seed first`);
  return r.rows[0].id;
}

async function serviceRate(id: string): Promise<{ bps: number; price: number }> {
  const r = await query<{ commission_bps: number; base_price_paisa: string }>(
    `SELECT c.commission_bps, s.base_price_paisa FROM services s
     JOIN categories c ON c.id = s.category_id WHERE s.id = $1`, [id]);
  return { bps: r.rows[0].commission_bps, price: Number(r.rows[0].base_price_paisa) };
}

const existing = await query(`SELECT id FROM users WHERE email = 'gita@demo.local'`);
if ((existing.rowCount ?? 0) > 0) {
  console.log("[db] demo data already present — skipping");
  await pool.end();
  process.exit(0);
}

// ---------- Customers ----------
const gita = await userId("gita@demo.local", "Gita Sharma", "9852611111", "CUSTOMER");
const ram = await userId("ram@demo.local", "Ram Thapa", "9852622222", "CUSTOMER");

for (const [uid, label, line, ward, phone] of [
  [gita, "Home", "Damak-5, Himal Chowk, House 12", 5, "9852611111"],
  [gita, "Shop", "Damak-6, Main Road, Shutter 4", 6, "9852611111"],
  [ram, "Home", "Damak-2, Campus Chowk, House 8", 2, "9852622222"],
] as const) {
  await query(
    `INSERT INTO addresses(user_id, label, line, city, ward, phone) VALUES ($1, $2, $3, 'Damak', $4, $5)`,
    [uid, label, line, ward, phone],
  );
}
const gitaAddr = (await query<{ id: string }>(
  `SELECT id FROM addresses WHERE user_id = $1 AND label = 'Home'`, [gita])).rows[0].id;

// ---------- Workers ----------
// Bijay: verified + active electrician. Sita: verified + active plumber/cleaner.
// Hari: documents submitted, waiting in the verification queue.
const bijay = await userId("bijay@demo.local", "Bijay Rai", "9852633333", "WORKER");
const sita = await userId("sita@demo.local", "Sita Limbu", "9852644444", "WORKER");
const hari = await userId("hari@demo.local", "Hari Karki", "9852655555", "WORKER");

async function profile(uid: string, state: string, active: boolean, bio: string, yrs: number) {
  await query(
    `INSERT INTO worker_profiles(user_id, verification_state, is_active, bio, years_exp)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET verification_state = $2, is_active = $3, bio = $4, years_exp = $5`,
    [uid, state, active, bio, yrs],
  );
  await query(
    `INSERT INTO verification_records(worker_user_id, state, notes) VALUES ($1, $2, $3)`,
    [uid, state, state === "verified" ? "ID + trade certificate checked at Damak-5 office." : "Documents submitted, awaiting reviewer."],
  );
}

await profile(bijay, "verified", true, "Licensed electrician, 6 years across Damak wards.", 6);
await profile(sita, "verified", true, "Plumber and deep-cleaning lead.", 4);
await profile(hari, "under-review", false, "Painter, new applicant.", 3);

const switchRepair = await serviceId("Switch & socket repair");
const fanInstall = await serviceId("Ceiling fan installation");
const tapRepair = await serviceId("Tap & mixer repair");
const deepClean = await serviceId("Full home deep cleaning");
const bathClean = await serviceId("Bathroom deep cleaning");

for (const sid of [switchRepair, fanInstall]) {
  await query(`INSERT INTO worker_services(worker_user_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [bijay, sid]);
}
for (const sid of [tapRepair, deepClean, bathClean]) {
  await query(`INSERT INTO worker_services(worker_user_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [sita, sid]);
}
for (let dow = 0; dow < 7; dow++) {
  await query(
    `INSERT INTO worker_availability(user_id, dow, is_open) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [bijay, dow, dow !== 6],
  );
  await query(
    `INSERT INTO worker_availability(user_id, dow, is_open) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [sita, dow, true],
  );
}
await query(
  `INSERT INTO verification_documents(worker_user_id, kind, storage_path) VALUES
   ($1, 'citizenship', 'demo/verify/bijay-citizenship.jpg'),
   ($1, 'trade-certificate', 'demo/verify/bijay-trade.jpg'),
   ($2, 'citizenship', 'demo/verify/sita-citizenship.jpg')`,
  [bijay, sita],
);

// ---------- Bookings across the lifecycle ----------
interface DemoBooking {
  no: string; customer: string; service: string; worker: string | null;
  status: string; daysAgo: number; final: boolean; method: "cash" | "esewa";
}

const bookings: DemoBooking[] = [
  { no: "BK-2001", customer: gita, service: switchRepair, worker: bijay, status: "completed", daysAgo: 12, final: true, method: "cash" },
  { no: "BK-2002", customer: gita, service: bathClean, worker: sita, status: "completed", daysAgo: 6, final: true, method: "cash" },
  { no: "BK-2003", customer: ram, service: fanInstall, worker: bijay, status: "in-progress", daysAgo: 0, final: false, method: "cash" },
  { no: "BK-2004", customer: ram, service: tapRepair, worker: sita, status: "confirmed", daysAgo: -1, final: false, method: "cash" },
  { no: "BK-2005", customer: gita, service: deepClean, worker: null, status: "awaiting-worker", daysAgo: -2, final: false, method: "esewa" },
  { no: "BK-2006", customer: ram, service: switchRepair, worker: null, status: "cancelled", daysAgo: 3, final: false, method: "cash" },
];

for (const b of bookings) {
  const { bps, price } = await serviceRate(b.service);
  const slot = new Date(Date.now() + (b.daysAgo <= 0 ? -b.daysAgo + 1 : -b.daysAgo) * 86400000);
  await query(
    `INSERT INTO bookings(booking_no, customer_id, service_id, worker_id, status, address_id,
       address_text, ward, slot, instructions, estimate_paisa, discount_paisa,
       final_paisa, payment_method, payment_status, commission_bps)
     VALUES ($1, $2, $3, $4, $5, $6, 'Damak-5, Himal Chowk, House 12, Damak', 5, $7,
       'Demo booking — fan testing and cleanup.', $8, 0, $9, $10, $11, $12)
     ON CONFLICT (booking_no) DO NOTHING`,
    [b.no, b.customer, b.service, b.worker, b.status, b.customer === gita ? gitaAddr : null,
      slot.toISOString(), price, b.final ? price : null, b.method,
      b.status === "completed" ? "paid" : b.method === "cash" ? "unpaid" : "pending-verification", bps],
  );
  const bid = (await query<{ id: string }>(`SELECT id FROM bookings WHERE booking_no = $1`, [b.no])).rows[0].id;
  const chain: Record<string, string[]> = {
    completed: ["pending", "awaiting-worker", "confirmed", "en-route", "in-progress", "awaiting-confirmation", "completed"],
    "in-progress": ["pending", "awaiting-worker", "confirmed", "en-route", "in-progress"],
    confirmed: ["pending", "awaiting-worker", "confirmed"],
    "awaiting-worker": ["pending", "awaiting-worker"],
    cancelled: ["pending", "cancelled"],
  };
  for (const s of chain[b.status] ?? ["pending"]) {
    await query(
      `INSERT INTO booking_events(booking_id, status, by_role, note) VALUES ($1, $2, 'admin', 'demo seed')`,
      [bid, s],
    );
  }
  if (b.worker) {
    await query(
      `INSERT INTO assignments(booking_id, worker_user_id, reason) VALUES ($1, $2, 'demo dispatch') ON CONFLICT DO NOTHING`,
      [bid, b.worker],
    );
  }
  await query(
    `INSERT INTO payments(booking_id, provider, amount_paisa, status, verified_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $4 = 'verified' THEN now() ELSE NULL END)
     ON CONFLICT DO NOTHING`,
    [bid, b.method, price, b.status === "completed" && b.method !== "cash" ? "verified" : b.status === "completed" ? "verified" : "pending"],
  );
  if (b.status === "completed") {
    const commission = Math.floor((price * bps) / 10000);
    await query(
      `INSERT INTO commission_ledger(booking_id, total_paisa, commission_paisa, worker_paisa, rate_bps)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (booking_id) DO NOTHING`,
      [bid, price, commission, price - commission, bps],
    );
    const pts = Math.floor(price / 10000);
    await query(
      `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
       VALUES ($1, $2, 'earn', 'Booking completed', $3) ON CONFLICT DO NOTHING`,
      [b.customer, pts, bid],
    );
  }
  if (b.no === "BK-2001") {
    await query(
      `INSERT INTO cash_collections(booking_id, amount_paisa, collected_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [bid, price, bijay],
    );
    await query(
      `INSERT INTO reviews(booking_id, worker_user_id, customer_id, rating, text)
       VALUES ($1, $2, $3, 5, 'Arrived on time, fixed both switches and cleaned up. Highly recommended.')
       ON CONFLICT (booking_id) DO NOTHING`,
      [bid, bijay, gita],
    );
  }
  if (b.no === "BK-2002") {
    await query(
      `INSERT INTO reviews(booking_id, worker_user_id, customer_id, rating, text)
       VALUES ($1, $2, $3, 4, 'Thorough bathroom clean, a bit late but quality work.')
       ON CONFLICT (booking_id) DO NOTHING`,
      [bid, sita, gita],
    );
  }
}
await query(
  `INSERT INTO reward_ledger(user_id, points, kind, reason) VALUES ($1, -100, 'redeem', 'Discount used')`,
  [gita],
);

// ---------- Quote request (Mode B) + proposal ----------
const paintCat = (await query<{ id: string }>(`SELECT id FROM categories WHERE slug = 'painting'`)).rows[0].id;
const qr = await query<{ id: string }>(
  `INSERT INTO quote_requests(customer_id, category_id, title, description, window_start, window_end, ward, landmark, status)
   VALUES ($1, $2, 'Repaint two bedrooms', 'Two 12x14 rooms, ceiling cracks in one, paint not on site.',
     now() + interval '3 days', now() + interval '5 days', 5, 'Damak-5, near Himal Chowk')
   RETURNING id`,
  [ram, paintCat],
);
await query(
  `INSERT INTO quote_proposals(request_id, worker_user_id, price_paisa, scope, availability, approved)
   VALUES ($1, $2, 1800000, 'Putty + primer + two coats Asian Paints, 3 days, furniture covered.', 'Thu–Sat mornings', true)`,
  [qr.rows[0].id, hari],
);
await query(`UPDATE quote_requests SET status = 'quoted' WHERE id = $1`, [qr.rows[0].id]);

// ---------- Support, notifications, consent ----------
const t = await query<{ id: string }>(
  `INSERT INTO support_tickets(user_id, subject) VALUES ($1, 'Pro arrived late for BK-2002') RETURNING id`,
  [gita],
);
await query(
  `INSERT INTO ticket_messages(ticket_id, from_role, body) VALUES
   ($1, 'customer', 'Bathroom cleaning started 40 minutes late. Work itself was good.'),
   ($1, 'admin', 'Noted — punctuality flagged on the pro record. Rs 100 loyalty credit added.')`,
  [t.rows[0].id],
);
await query(
  `INSERT INTO notifications(user_id, title, body) VALUES
   ($1, 'Job completed', 'BK-2001 is complete — please rate the job.'),
   ($2, 'New assignment', 'BK-2003 was assigned to you.'),
   ($3, 'New booking needs a pro', 'BK-2005 is waiting for dispatch.')`,
  [gita, bijay, (await query<{ id: string }>(`SELECT id FROM users WHERE email = 'admin@sajilo.local'`)).rows[0]?.id ?? gita],
);
for (const [uid, analytics] of [[gita, true], [ram, false]] as const) {
  await query(
    `INSERT INTO consent_records(user_id, categories, policy_version, consent_version)
     VALUES ($1, $2, 'v1', 1)`,
    [uid, JSON.stringify({ necessary: true, preferences: true, analytics, marketing: false })],
  );
}

console.log(`[db] demo ok
  customers  gita@demo.local / ram@demo.local
  pros       bijay@demo.local (verified+active) / sita@demo.local (verified+active) / hari@demo.local (under-review)
  password   ${DEMO_PASSWORD} (all demo accounts, local only)
  bookings   BK-2001..BK-2006 across completed/in-progress/confirmed/awaiting-worker/cancelled
  quotes     1 quoted request with an approved proposal`);
await pool.end();
