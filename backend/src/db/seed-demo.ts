import bcrypt from "bcryptjs";
import { pool, query } from "./pool.js";

// Real Damak demo dataset. Idempotent: safe to re-run, never duplicates.

const CATEGORIES = [
  ["Plumbing", "plumbing", "Leaks, fittings & pipework", "wrench", 1500, 1],
  ["Electrical", "electrical", "Wiring, switches & safety", "zap", 1500, 2],
  ["Carpentry", "carpentry", "Furniture & woodwork", "hammer", 1400, 3],
  ["Painting", "painting", "Rooms, exteriors & polish", "paintbrush", 1400, 4],
  ["Home Cleaning", "cleaning", "Deep clean & upkeep", "sparkles", 1200, 5],
  ["Appliance Repair", "appliance", "Fridge, washer & more", "refrigerator", 1500, 6],
  ["AC Services", "ac", "Install & maintenance", "snowflake", 1500, 7],
  ["Internet & Networking", "network", "Wi-Fi, LAN & setup", "wifi", 1300, 8],
  ["Mechanical", "mechanical", "Motors, pumps & grills", "cog", 1500, 9],
  ["Pest Control", "pest", "Safe, lasting treatment", "bug", 1300, 10],
  ["General Maintenance", "maintenance", "Odd jobs & upkeep", "toolbox", 1200, 11],
  ["Masonry & Tiling", "masonry", "Walls, floors & finish", "brick", 1400, 12],
] as const;

const SERVICES = [
  // categorySlug, name, description, pricing, paisa, unit, mins, requirements, exclusions
  ["plumbing", "Tap & Mixer Repair", "Dripping taps, broken mixers and washroom fittings fixed on the spot. Genuine spares with 30-day service warranty.", "fixed", 80000, "", 60, ["Clear access to the fitting", "Main valve location known"], ["Concealed pipe replacement", "Bathroom re-tiling"]],
  ["plumbing", "Full Bathroom Plumbing", "Complete bathroom pipework, drainage and sanitary installation by licensed plumbers. Site inspection first, fixed quote after.", "inspection-quote", 50000, "inspection visit", 120, ["Floor plan or site access", "Owner present for inspection"], ["Tiles and sanitary ware cost"]],
  ["electrical", "Switch, Socket & MCB Repair", "Faulty switches, burnt sockets, tripping MCBs and doorbell faults diagnosed and repaired with branded components.", "starting", 60000, "", 60, ["Power supply accessible", "Load details for MCB sizing"], ["Full house rewiring"]],
  ["electrical", "House Wiring (per room)", "Safe concealed or casing-cap wiring per room with load calculation, earthing check and safety certification.", "fixed", 650000, "per room", 480, ["Site inspection", "Load list of appliances"], ["NEA meter and main line charges"]],
  ["carpentry", "Furniture Repair", "Wobbly chairs, broken hinges, drawer channels and bed frames restored. On-site carpentry with seasoned timber options.", "hourly", 90000, "per hour", 120, ["Photos of damage help estimation"], ["Antique restoration", "Upholstery fabric cost"]],
  ["carpentry", "Modular Kitchen (custom quote)", "Designed, built and installed modular kitchens. Free design consult, 3D view, then a customer-approved quote before work begins.", "custom-quote", 0, "", 0, ["Kitchen measurements", "Design consult"], ["Chimney and appliance cost"]],
  ["painting", "Room Painting (per room)", "Two-coat premium emulsion with putty touch-up, masking and post-job cleanup. Colour shade card provided before start.", "fixed", 750000, "per room", 480, ["Furniture moved or covered", "Shade selection before day one"], ["Wall crack structural repair", "Wallpaper material"]],
  ["cleaning", "Full Home Deep Clean", "Top-to-bottom deep cleaning: kitchen degreasing, bathroom descaling, sofa vacuuming and balcony wash. Eco chemicals.", "starting", 350000, "", 300, ["Water supply", "Parking for equipment van"], ["Facade glass above ground floor", "Pest treatment"]],
  ["appliance", "Refrigerator Repair", "Cooling issues, compressor faults, gas refill and thermostat replacement for all major brands. 90-day repair warranty.", "starting", 90000, "", 90, ["Model number and symptom photos"], ["Compressor replacement cost above quote"]],
  ["ac", "Split AC Deep Service", "Foam-jet indoor service, outdoor unit wash, gas pressure check and cooling performance report. All tonnages.", "fixed", 150000, "", 90, ["Outdoor unit access", "Power point near indoor unit"], ["Gas refill charged separately", "Copper piping extension"]],
  ["ac", "AC Installation", "Uninstall, relocation and fresh installation with vacuuming, wall mounting and drainage. Stabilizer advice included.", "fixed", 300000, "", 180, ["Mounting wall confirmed", "Drainage point available"], ["Extra copper pipe beyond 3m", "Core cutting in RCC"]],
  ["network", "Home Wi-Fi Setup & Optimization", "Dead-zone survey, router placement, mesh setup and speed tuning for work-from-home ready coverage in every room.", "fixed", 120000, "", 120, ["ISP credentials", "Floor plan or walkthrough"], ["Router hardware cost", "ISP subscription charges"]],
  ["mechanical", "Water Pump & Motor Repair", "Noisy motors, winding faults, pressure issues and automatic controller setup for household and boring pumps.", "starting", 100000, "", 120, ["Pump HP and head details"], ["Rewinding above quoted cost", "Boring work"]],
  ["pest", "General Pest Treatment (2BHK)", "Cockroach, ant and spider gel + spray treatment with child-safe chemicals. One free re-service within 45 days.", "fixed", 280000, "", 90, ["Kitchen accessible", "Pets secured during treatment"], ["Termite drilling treatment", "Bird netting"]],
  ["maintenance", "Handyman Visit (half day)", "One visit, many small fixes: curtain rods, wall hangings, minor plumbing and electrical touch-ups. Materials at MRP.", "fixed", 180000, "", 240, ["List of tasks in advance"], ["Specialist repairs needing extra visits"]],
  ["masonry", "Bathroom Tiling (per sq ft)", "Precision tiling with waterproofing coat, epoxy grout option and level-checked finish. Materials billed at MRP.", "starting", 14000, "per sq ft", 480, ["Tile selection confirmed", "Waterproofing scope agreed"], ["Tile material cost", "Plumbing point shifting"]],
] as const;

const WORKERS = [
  // email, name, phone, bio, years, hue, categorySlugs
  ["ram@workers.local", "Ram Shrestha", "9852600011", "Licensed plumber, 9 years across residential and commercial sites. Known for clean pipework and on-time arrival.", 9, 160, ["plumbing", "maintenance"]],
  ["sita@workers.local", "Sita Maharjan", "9852600012", "Deep-clean specialist leading a 3-person crew. Eco chemicals, checklist-driven handover.", 6, 280, ["cleaning", "maintenance"]],
  ["bikash@workers.local", "Bikash Thapa", "9852600013", "Electrician with NEA safety training. Load calculation, earthing and tidy casing work.", 7, 210, ["electrical", "network"]],
  ["anita@workers.local", "Anita Karki", "9852600014", "Painter focused on premium emulsion finishes with dust-free sanding and sharp masking lines.", 5, 330, ["painting"]],
] as const;

async function roleId(name: string): Promise<string> {
  const r = await query<{ id: string }>(`SELECT id FROM roles WHERE name = $1`, [name]);
  return r.rows[0].id;
}

const workerRole = await roleId("WORKER");
const customerRole = await roleId("CUSTOMER");
const passHash = await bcrypt.hash("Worker123!", 10);

// Categories
const catIds: Record<string, string> = {};
for (const [name, slug, tagline, icon, bps, sort] of CATEGORIES) {
  const r = await query<{ id: string }>(
    `INSERT INTO categories(name, slug, tagline, icon, commission_bps, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [name, slug, tagline, icon, bps, sort],
  );
  catIds[slug] = r.rows[0].id;
}

// Services
const svcIds: Record<string, string> = {};
for (const s of SERVICES) {
  const [slug, name, desc, pricing, paisa, unit, mins, req, exc] = s;
  const existing = await query<{ id: string }>(`SELECT id FROM services WHERE name = $1`, [name]);
  if (existing.rowCount > 0) {
    svcIds[name] = existing.rows[0].id;
    continue;
  }
  const r = await query<{ id: string }>(
    `INSERT INTO services(category_id, name, description, pricing_model, base_price_paisa, unit, duration_min, areas, requirements, exclusions)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'{Damak}',$8,$9) RETURNING id`,
    [catIds[slug], name, desc, pricing, paisa, unit, mins, req as unknown as string[], exc as unknown as string[]],
  );
  svcIds[name] = r.rows[0].id;
}

// Workers (login-capable demo accounts, verified + active)
const workerIds: Record<string, string> = {};
for (const [email, name, phone, bio, years, hue, cats] of WORKERS) {
  let uid: string;
  const existing = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rowCount > 0) {
    uid = existing.rows[0].id;
  } else {
    const u = await query<{ id: string }>(
      `INSERT INTO users(email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
      [email, passHash, name, phone],
    );
    uid = u.rows[0].id;
    await query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [uid, workerRole]);
  }
  await query(
    `INSERT INTO worker_profiles(user_id, bio, years_exp, areas, avatar_hue, verification_state, is_active)
     VALUES ($1, $2, $3, '{Damak}', $4, 'verified', true)
     ON CONFLICT (user_id) DO UPDATE SET verification_state = 'verified', is_active = true`,
    [uid, bio, years, hue],
  );
  for (const slug of cats as readonly string[]) {
    const sid = await query<{ id: string }>(`SELECT id FROM services WHERE category_id = $1 LIMIT 20`, [catIds[slug]]);
    for (const row of sid.rows) {
      await query(`INSERT INTO worker_services(worker_user_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
        uid,
        row.id,
      ]);
    }
  }
  workerIds[name] = uid;
}

// Demo customer
const custHash = await bcrypt.hash("Customer123!", 10);
let customerId: string;
{
  const existing = await query<{ id: string }>(`SELECT id FROM users WHERE email = 'customer@demo.local'`);
  if (existing.rowCount > 0) {
    customerId = existing.rows[0].id;
  } else {
    const u = await query<{ id: string }>(
      `INSERT INTO users(email, password_hash, name, phone) VALUES ('customer@demo.local', $1, 'Demo Customer', '9852600009') RETURNING id`,
      [custHash],
    );
    customerId = u.rows[0].id;
    await query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      customerId,
      customerRole,
    ]);
  }
}
await query(
  `INSERT INTO addresses(user_id, label, line, city, phone)
   SELECT $1, 'Home', 'Damak-5, Himal Chowk, House 12', 'Damak', '9852600009'
   WHERE NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = $1 AND label = 'Home')`,
  [customerId],
);
await query(
  `INSERT INTO addresses(user_id, label, line, city, phone)
   SELECT $1, 'Shop', 'Damak-2, Station Road', 'Damak', '9852600009'
   WHERE NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = $1 AND label = 'Shop')`,
  [customerId],
);
const addrHome = (
  await query<{ id: string }>(`SELECT id FROM addresses WHERE user_id = $1 AND label = 'Home'`, [customerId])
).rows[0].id;
const addrShop = (
  await query<{ id: string }>(`SELECT id FROM addresses WHERE user_id = $1 AND label = 'Shop'`, [customerId])
).rows[0].id;

// Bookings across the lifecycle (idempotent by booking_no)
const BOOKINGS = [
  // no, service, workerName|null, status, addr, slot, instructions, estimate, final, method, payStatus, events[[status,by,note]]
  ["BK-1042", "Tap & Mixer Repair", "Ram Shrestha", "completed", "home", "2026-09-28T10:00:00+05:45", "Kitchen mixer dripping constantly.", 80000, 80000, "cash", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""], ["completed", "customer", ""]]],
  ["BK-1057", "Full Home Deep Clean", "Sita Maharjan", "in-progress", "home", "2026-10-03T09:00:00+05:45", "3BHK deep clean, focus on kitchen and balconies.", 420000, null, "esewa", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""]]],
  ["BK-1061", "Split AC Deep Service", null, "awaiting-worker", "shop", "2026-10-05T11:00:00+05:45", "Two split units, weak cooling.", 300000, null, "cash", "unpaid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""]]],
  ["BK-1059", "Home Wi-Fi Setup & Optimization", "Bikash Thapa", "confirmed", "home", "2026-10-04T15:00:00+05:45", "Dead zone in back bedrooms.", 120000, null, "khalti", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""]]],
  ["BK-1049", "Room Painting (per room)", "Anita Karki", "awaiting-confirmation", "shop", "2026-09-30T09:00:00+05:45", "Two rooms, off-white emulsion.", 1500000, 1560000, "esewa", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""]]],
  ["BK-1033", "Refrigerator Repair", null, "disputed", "home", "2026-09-20T10:00:00+05:45", "Fridge not cooling after gas refill.", 90000, 140000, "cash", "unpaid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["in-progress", "worker", ""], ["disputed", "customer", "Charged above estimate without approval"]]],
  ["BK-1021", "Switch, Socket & MCB Repair", null, "cancelled", "home", "2026-09-15T10:00:00+05:45", "Bedroom switch sparking.", 60000, null, "cash", "unpaid", [["pending", "customer", ""], ["cancelled", "customer", "Fixed by building electrician"]]],
] as const;

for (const b of BOOKINGS) {
  const [no, svcName, wName, status, addr, slot, instr, est, fin, method, payStatus, events] = b;
  const exists = await query(`SELECT id FROM bookings WHERE booking_no = $1`, [no]);
  if (exists.rowCount > 0) continue;
  const svc = svcIds[svcName];
  const catBps = (
    await query<{ commission_bps: number }>(
      `SELECT c.commission_bps FROM services s JOIN categories c ON c.id = s.category_id WHERE s.id = $1`,
      [svc],
    )
  ).rows[0].commission_bps;
  const wid = wName ? (workerIds[wName] ?? null) : null;
  const ins = await query<{ id: string }>(
    `INSERT INTO bookings(booking_no, customer_id, service_id, worker_id, status, address_id,
                          address_text, slot, instructions, estimate_paisa, final_paisa,
                          payment_method, payment_status, commission_bps, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now() - interval '2 days') RETURNING id`,
    [no, customerId, svc, wid, status, addr === "home" ? addrHome : addrShop,
     addr === "home" ? "Damak-5, Himal Chowk, House 12, Damak" : "Damak-2, Station Road, Damak",
     slot, instr, est, fin, method, payStatus, catBps],
  );
  const bid = ins.rows[0].id;
  for (const [st, by, note] of events as readonly (readonly [string, string, string])[]) {
    await query(
      `INSERT INTO booking_events(booking_id, status, by_role, note, created_at) VALUES ($1,$2,$3,$4, now() - interval '2 days')`,
      [bid, st, by, note],
    );
  }
  await query(`INSERT INTO payments(booking_id, provider, amount_paisa, status) VALUES ($1,$2,$3,$4)`, [
    bid,
    method,
    fin ?? est,
    payStatus === "paid" ? "verified" : "pending",
  ]);
  if (status === "completed" && fin !== null) {
    const comm = Math.floor((fin as number) * catBps / 10000);
    await query(
      `INSERT INTO commission_ledger(booking_id, total_paisa, commission_paisa, worker_paisa, rate_bps, is_settled)
       VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT (booking_id) DO NOTHING`,
      [bid, fin, comm, (fin as number) - comm, catBps],
    );
  }
}

// Rewards + reviews + tickets + notifications for the demo customer
const rew = await query(`SELECT id FROM reward_ledger WHERE user_id = $1 LIMIT 1`, [customerId]);
if (rew.rowCount === 0) {
  await query(`INSERT INTO reward_ledger(user_id, points, kind, reason) VALUES
    ($1, 50, 'bonus', 'Welcome bonus'),
    ($1, 8, 'earn', 'BK-1042 completed'),
    ($1, -100, 'redeem', 'Discount on BK-1057')`, [customerId]);
}
const b42 = await query<{ id: string }>(`SELECT id FROM bookings WHERE booking_no = 'BK-1042'`);
if (b42.rowCount > 0) {
  await query(
    `INSERT INTO reviews(booking_id, worker_user_id, customer_id, rating, text)
     VALUES ($1, $2, $3, 5, 'Arrived on time, fixed the mixer in 40 minutes and cleaned up. Highly recommended.')
     ON CONFLICT (booking_id) DO NOTHING`,
    [b42.rows[0].id, workerIds["Ram Shrestha"], customerId],
  );
}
const tix = await query(`SELECT id FROM support_tickets WHERE user_id = $1 LIMIT 1`, [customerId]);
if (tix.rowCount === 0) {
  const t = await query<{ id: string }>(
    `INSERT INTO support_tickets(user_id, subject, status) VALUES ($1, 'Overcharged vs estimate on BK-1033', 'in-progress') RETURNING id`,
    [customerId],
  );
  await query(`INSERT INTO ticket_messages(ticket_id, from_role, body) VALUES
    ($1, 'customer', 'Worker charged Rs 1,400 against Rs 900 estimate without approval.'),
    ($1, 'support', 'We have paused settlement and asked the worker for the revised quote sheet.')`, [t.rows[0].id]);
  await query(`INSERT INTO notifications(user_id, title, body) VALUES
    ($1, 'Worker assigned', 'Sita Maharjan accepted BK-1057.'),
    ($1, 'Reward credit', '+8 points for BK-1042.')`, [customerId]);
}

/* ---------------- Wave 2: more users, workers, bookings ---------------- */

async function ensureUser(email: string, name: string, phone: string, password: string, role: string): Promise<string> {
  const existing = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const hash = await bcrypt.hash(password, 10);
  const u = await query<{ id: string }>(
    `INSERT INTO users(email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
    [email, hash, name, phone],
  );
  await query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    u.rows[0].id,
    role === "WORKER" ? workerRole : customerRole,
  ]);
  return u.rows[0].id;
}

async function ensureWorker(
  email: string, name: string, phone: string, bio: string, years: number, hue: number,
  cats: readonly string[], state: "verified" | "under-review" | "suspended", active: boolean,
) {
  const uid = await ensureUser(email, name, phone, "Worker123!", "WORKER");
  await query(
    `INSERT INTO worker_profiles(user_id, bio, years_exp, areas, avatar_hue, verification_state, is_active)
     VALUES ($1, $2, $3, '{Damak}', $4, $5, $6)
     ON CONFLICT (user_id) DO NOTHING`,
    [uid, bio, years, hue, state, active],
  );
  for (const slug of cats) {
    const sid = await query<{ id: string }>(`SELECT id FROM services WHERE category_id = $1`, [catIds[slug]]);
    for (const row of sid.rows) {
      await query(`INSERT INTO worker_services(worker_user_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
        uid,
        row.id,
      ]);
    }
  }
  // Default availability Mon-Sat.
  for (let dow = 1; dow <= 6; dow++) {
    await query(
      `INSERT INTO worker_availability(user_id, dow, is_open) VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
      [uid, dow],
    );
  }
  workerIds[name] = uid;
  return uid;
}

await ensureWorker("deepak@workers.local", "Deepak Chaudhary", "9852600021",
  "Refrigeration and HVAC technician. Gas handling certified, 90-day warranty on every repair.", 8, 200,
  ["appliance", "ac"], "verified", true);
await ensureWorker("sunita@workers.local", "Sunita Tamang", "9852600022",
  "Home cleaning lead with a trained 2-person crew. Pet-friendly products on request.", 4, 300,
  ["cleaning"], "verified", true);
await ensureWorker("hari@workers.local", "Hari Prasad", "9852600023",
  "Pump mechanic and mason. Motors, tiling and waterproofing with level-checked finish.", 12, 30,
  ["mechanical", "masonry"], "verified", true);
await ensureWorker("nabin@workers.local", "Nabin KC", "9852600024",
  "Network field tech. Home Wi-Fi surveys, mesh setups and small-office LAN.", 5, 250,
  ["network", "electrical"], "verified", true);
await ensureWorker("kamal@workers.local", "Kamal BK", "9852600025",
  "Pest control trainee. Documents submitted, reference check in progress.", 2, 90,
  ["pest", "maintenance"], "under-review", false);
await ensureWorker("manoj@workers.local", "Manoj Limbu", "9852600026",
  "Suspended pending complaint resolution. Historic jobs remain visible.", 4, 0,
  ["mechanical"], "suspended", false);

const gita = await ensureUser("gita@demo.local", "Gita Sharma", "9852600031", "Customer123!", "CUSTOMER");
const prakash = await ensureUser("prakash@demo.local", "Prakash Limbu", "9852600032", "Customer123!", "CUSTOMER");
const mina = await ensureUser("mina@demo.local", "Mina Rai", "9852600033", "Customer123!", "CUSTOMER");

async function ensureAddress(uid: string, label: string, line: string, phone: string) {
  await query(
    `INSERT INTO addresses(user_id, label, line, city, phone)
     SELECT $1, $2, $3, 'Damak', $4 WHERE NOT EXISTS
     (SELECT 1 FROM addresses WHERE user_id = $1 AND label = $2)`,
    [uid, label, line, phone],
  );
}

await ensureAddress(gita, "Home", "Damak-3, Campus Chowk, House 7", "9852600031");
await ensureAddress(prakash, "Home", "Damak-7, Jyoti Chowk", "9852600032");
await ensureAddress(prakash, "Farm", "Damak-9, Beldangi Road", "9852600032");
await ensureAddress(mina, "Home", "Damak-1, Station Road, House 3", "9852600033");

async function addressId(uid: string, label: string): Promise<string> {
  return (
    await query<{ id: string }>(`SELECT id FROM addresses WHERE user_id = $1 AND label = $2`, [uid, label])
  ).rows[0].id;
}

const WAVE2 = [
  // no, customer, service, workerName|null, status, addrLabel, slot, instructions, estimate, final, method, pay, events
  ["BK-2001", "Gita Sharma", "Split AC Deep Service", "Deepak Chaudhary", "completed", "Home", "2026-09-22T10:00:00+05:45", "Living room split AC, weak cooling.", 150000, 150000, "esewa", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""], ["completed", "customer", ""]]],
  ["BK-2002", "Gita Sharma", "Full Home Deep Clean", "Sunita Tamang", "completed", "Home", "2026-09-25T09:00:00+05:45", "2BHK full clean before Dashain guests.", 350000, 380000, "cash", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""], ["completed", "customer", ""]]],
  ["BK-2003", "Prakash Limbu", "Water Pump & Motor Repair", "Hari Prasad", "in-progress", "Farm", "2026-10-03T10:00:00+05:45", "Boring pump humming, no water.", 100000, null, "cash", "unpaid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""]]],
  ["BK-2004", "Prakash Limbu", "Bathroom Tiling (per sq ft)", "Hari Prasad", "confirmed", "Home", "2026-10-06T09:00:00+05:45", "Small bathroom floor retiling.", 140000, null, "cash", "unpaid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""]]],
  ["BK-2005", "Mina Rai", "Home Wi-Fi Setup & Optimization", "Nabin KC", "completed", "Home", "2026-09-27T15:00:00+05:45", "No signal in kitchen and store room.", 120000, 120000, "khalti", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""], ["completed", "customer", ""]]],
  ["BK-2006", "Mina Rai", "General Pest Treatment (2BHK)", null, "awaiting-worker", "Home", "2026-10-07T10:00:00+05:45", "Cockroaches in kitchen at night.", 280000, null, "cash", "unpaid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""]]],
  ["BK-2007", "Gita Sharma", "Room Painting (per room)", "Anita Karki", "completed", "Home", "2026-09-29T09:00:00+05:45", "Bedroom repaint, light green.", 750000, 750000, "esewa", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""], ["completed", "customer", ""]]],
  ["BK-2008", "Prakash Limbu", "Tap & Mixer Repair", null, "cancelled", "Home", "2026-09-26T10:00:00+05:45", "Bathroom tap leaking.", 80000, null, "cash", "unpaid", [["pending", "customer", ""], ["cancelled", "customer", "Fixed by neighbour"]]],
  ["BK-2009", "Mina Rai", "Refrigerator Repair", "Deepak Chaudhary", "disputed", "Home", "2026-10-01T11:00:00+05:45", "Fridge icing up in fresh-food section.", 90000, 130000, "cash", "unpaid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["in-progress", "worker", ""], ["disputed", "customer", "Extra part charged without approval"]]],
  ["BK-2010", "Prakash Limbu", "Handyman Visit (half day)", "Manoj Limbu", "completed", "Farm", "2026-09-18T09:00:00+05:45", "Gate hinges, shed roofing sheets, tap washers.", 180000, 180000, "cash", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""], ["completed", "customer", ""]]],
  ["BK-2011", "Gita Sharma", "Switch, Socket & MCB Repair", "Bikash Thapa", "awaiting-confirmation", "Home", "2026-10-02T14:00:00+05:45", "Two dead sockets in bedrooms.", 60000, 75000, "cash", "unpaid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""]]],
] as const;

const custByName: Record<string, string> = {
  "Gita Sharma": gita,
  "Prakash Limbu": prakash,
  "Mina Rai": mina,
};

for (const b of WAVE2) {
  const [no, cname, svcName, wName, status, addrLabel, slot, instr, est, fin, method, payStatus, events] = b;
  const exists = await query(`SELECT id FROM bookings WHERE booking_no = $1`, [no]);
  if (exists.rowCount > 0) continue;
  const cid = custByName[cname as string];
  const svc = svcIds[svcName as string];
  const catBps = (
    await query<{ commission_bps: number }>(
      `SELECT c.commission_bps FROM services s JOIN categories c ON c.id = s.category_id WHERE s.id = $1`,
      [svc],
    )
  ).rows[0].commission_bps;
  const wid = wName ? (workerIds[wName as string] ?? null) : null;
  const aid = await addressId(cid, addrLabel as string);
  const addrLine = (
    await query<{ line: string }>(`SELECT line FROM addresses WHERE id = $1`, [aid])
  ).rows[0].line;
  const ins = await query<{ id: string }>(
    `INSERT INTO bookings(booking_no, customer_id, service_id, worker_id, status, address_id,
                          address_text, slot, instructions, estimate_paisa, final_paisa,
                          payment_method, payment_status, commission_bps, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now() - interval '3 days') RETURNING id`,
    [no, cid, svc, wid, status, aid, `${addrLine}, Damak`, slot, instr, est, fin, method, payStatus, catBps],
  );
  const bid = ins.rows[0].id;
  for (const [st, by, note] of events as readonly (readonly [string, string, string])[]) {
    await query(
      `INSERT INTO booking_events(booking_id, status, by_role, note, created_at) VALUES ($1,$2,$3,$4, now() - interval '3 days')`,
      [bid, st, by, note],
    );
  }
  await query(`INSERT INTO payments(booking_id, provider, amount_paisa, status) VALUES ($1,$2,$3,$4)`, [
    bid,
    method,
    (fin ?? est) as number,
    payStatus === "paid" ? "verified" : "pending",
  ]);
  if (status === "completed" && fin !== null) {
    const f = fin as number;
    const comm = Math.floor((f * catBps) / 10000);
    await query(
      `INSERT INTO commission_ledger(booking_id, total_paisa, commission_paisa, worker_paisa, rate_bps, is_settled)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (booking_id) DO NOTHING`,
      [bid, f, comm, f - comm, catBps, method === "esewa" || method === "khalti"],
    );
    const pts = Math.floor(f / 10000);
    if (pts > 0) {
      await query(
        `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
         VALUES ($1, $2, 'earn', $3 || ' completed', $4) ON CONFLICT DO NOTHING`,
        [cid, pts, no, bid],
      );
    }
  }
}

// Gita redeems once (has 15+38+75 = 128 points).
{
  const bal = await query<{ pts: number }>(
    `SELECT COALESCE(SUM(points),0)::int AS pts FROM reward_ledger WHERE user_id = $1`, [gita],
  );
  if (bal.rows[0].pts >= 100) {
    const has = await query(`SELECT id FROM reward_ledger WHERE user_id = $1 AND kind = 'redeem' LIMIT 1`, [gita]);
    if (has.rowCount === 0) {
      await query(`INSERT INTO reward_ledger(user_id, points, kind, reason) VALUES ($1, -100, 'redeem', 'Discount used')`, [gita]);
    }
  }
}

// Reviews for newly completed jobs.
const WAVE_REVIEWS = [
  ["BK-2001", "Deepak Chaudhary", "Gita Sharma", 5, "Gas pressure checked, cooling perfect now. Clean work."],
  ["BK-2002", "Sunita Tamang", "Gita Sharma", 5, "Kitchen looks brand new. The crew was polite and thorough."],
  ["BK-2005", "Nabin KC", "Mina Rai", 4, "Wi-Fi reaches every room now. Took a bit longer than quoted."],
  ["BK-2007", "Anita Karki", "Gita Sharma", 5, "Flawless finish, zero paint splatter anywhere."],
  ["BK-2010", "Manoj Limbu", "Prakash Limbu", 3, "Work okay, but arrived two hours late without notice."],
] as const;

for (const [no, wName, cname, rating, text] of WAVE_REVIEWS) {
  const bk = await query<{ id: string }>(`SELECT id FROM bookings WHERE booking_no = $1`, [no]);
  if (bk.rowCount === 0) continue;
  await query(
    `INSERT INTO reviews(booking_id, worker_user_id, customer_id, rating, text)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (booking_id) DO NOTHING`,
    [bk.rows[0].id, workerIds[wName as string], custByName[cname as string], rating, text],
  );
}

// Extra tickets + notifications.
async function ensureTicket(email: string, subject: string, status: string, msgs: [string, string][]) {
  const u = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  const uid = u.rows[0].id;
  const ex = await query(`SELECT id FROM support_tickets WHERE user_id = $1 AND subject = $2`, [uid, subject]);
  if (ex.rowCount > 0) return;
  const t = await query<{ id: string }>(
    `INSERT INTO support_tickets(user_id, subject, status) VALUES ($1, $2, $3) RETURNING id`,
    [uid, subject, status],
  );
  for (const [from, body] of msgs) {
    await query(`INSERT INTO ticket_messages(ticket_id, from_role, body) VALUES ($1, $2, $3)`, [t.rows[0].id, from, body]);
  }
}

await ensureTicket("gita@demo.local", "AC cooling weak again after BK-2001", "open", [
  ["customer", "The same AC is cooling less just a week after service."],
]);
await ensureTicket("prakash@demo.local", "Invoice copy for BK-2004", "resolved", [
  ["customer", "Need a VAT invoice for the tiling job for my records."],
  ["support", "Invoice emailed. Let us know if you need anything else."],
]);
await ensureTicket("mina@demo.local", "Reschedule pest visit BK-2006", "in-progress", [
  ["customer", "Can we move the pest treatment to next week?"],
  ["support", "Sure — tell us a day and we will reassign the slot."],
]);

for (const [email, title, body] of [
  ["gita@demo.local", "Reward credit", "+75 points for BK-2007."],
  ["prakash@demo.local", "Worker assigned", "Hari Prasad accepted BK-2003."],
  ["mina@demo.local", "Payment received", "Khalti payment for BK-2005 confirmed."],
] as const) {
  const u = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  const ex = await query(`SELECT id FROM notifications WHERE user_id = $1 AND title = $2 LIMIT 1`, [u.rows[0].id, title]);
  if (ex.rowCount === 0) {
    await query(`INSERT INTO notifications(user_id, title, body) VALUES ($1, $2, $3)`, [u.rows[0].id, title, body]);
  }
}

// BK-1042 cash commission was seeded settled — back it with a settlement row.
{
  const ram = workerIds["Ram Shrestha"];
  const ex = await query(`SELECT id FROM settlements WHERE worker_user_id = $1 AND kind = 'collection' LIMIT 1`, [ram]);
  if (ex.rowCount === 0) {
    await query(
      `INSERT INTO settlements(worker_user_id, amount_paisa, kind, note) VALUES ($1, 12000, 'collection', 'Cash commission for BK-1042')`,
      [ram],
    );
  }
}

/* ---------------- Wave 3: edge cases + history ---------------- */

await ensureWorker("sagar@workers.local", "Sagar Rai", "9852600027",
  "Furniture maker and repairer. Custom shelves, door alignment and polish.", 6, 120,
  ["carpentry"], "verified", true);

const ramesh = await ensureUser("ramesh@demo.local", "Ramesh Thapa", "9852600034", "Customer123!", "CUSTOMER");
await ensureAddress(ramesh, "Home", "Damak-4, Rabi Chowk, House 21", "9852600034");

// Verification history for wave-2 workers (admin verify tab reads this).
{
  const admin = await query<{ id: string }>(`SELECT id FROM users WHERE email = 'admin@workers.local'`);
  const aid = admin.rows[0].id;
  const hist: [string, string, string][] = [
    ["Deepak Chaudhary", "verified", "ID + gas-handling certificate verified."],
    ["Sunita Tamang", "verified", "References from 2 housing societies checked."],
    ["Hari Prasad", "verified", "Trade test passed, background clear."],
    ["Nabin KC", "verified", "ID verified, skill assessed on demo setup."],
    ["Kamal BK", "under-review", "Documents received; reference check pending."],
    ["Manoj Limbu", "suspended", "Suspended after upheld late-arrival complaint (BK-2010 review)."],
  ];
  for (const [wname, state, notes] of hist) {
    const ex = await query(`SELECT id FROM verification_records WHERE worker_user_id = $1 AND state = $2 LIMIT 1`, [
      workerIds[wname],
      state,
    ]);
    if (ex.rowCount === 0) {
      await query(
        `INSERT INTO verification_records(worker_user_id, state, reviewer_id, notes) VALUES ($1, $2, $3, $4)`,
        [workerIds[wname], state, aid, notes],
      );
    }
  }
  // Private verification documents (admin eyes only).
  const docs: [string, string][] = [
    ["Kamal BK", "citizenship-front.jpg"],
    ["Kamal BK", "experience-letter.pdf"],
    ["Deepak Chaudhary", "gas-certificate.jpg"],
  ];
  for (const [wname, kind] of docs) {
    const ex = await query(
      `SELECT id FROM verification_documents WHERE worker_user_id = $1 AND kind = $2 LIMIT 1`,
      [workerIds[wname], kind],
    );
    if (ex.rowCount === 0) {
      await query(
        `INSERT INTO verification_documents(worker_user_id, kind, storage_path) VALUES ($1, $2, $3)`,
        [workerIds[wname], kind, `verification/${workerIds[wname]}/${kind}`],
      );
    }
  }
}

// An expired, never-accepted invite (shows the expiry path).
{
  const ex = await query(`SELECT id FROM worker_invites WHERE email = 'ghost@demo.local'`);
  if (ex.rowCount === 0) {
    await query(
      `INSERT INTO worker_invites(email, name, token_hash, expires_at)
       VALUES ('ghost@demo.local', 'Ghost Invite', 'expired-token-hash-demo', now() - interval '1 day')`,
    );
  }
}

const WAVE3 = [
  // no, customerEmail, service, workerName|null, status, addrLabel, slot, instructions, est, final, method, pay, events
  ["BK-2012", "ramesh@demo.local", "Furniture Repair", "Sagar Rai", "completed", "Home", "2026-09-24T10:00:00+05:45", "Dining table leg loose, 6 chairs wobbly.", 180000, 180000, "esewa", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""], ["completed", "customer", ""]]],
  ["BK-2013", "gita@demo.local", "Switch, Socket & MCB Repair", "Bikash Thapa", "completed", "Home", "2026-09-26T11:00:00+05:45", "Hall MCB tripping on load.", 60000, 60000, "cash", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""], ["completed", "customer", ""]]],
  ["BK-2014", "gita@demo.local", "Water Pump & Motor Repair", "Hari Prasad", "completed", "Home", "2026-09-28T10:00:00+05:45", "Motor not priming after outage.", 100000, 100000, "cash", "paid", [["pending", "customer", ""], ["awaiting-worker", "admin", ""], ["confirmed", "worker", ""], ["en-route", "worker", ""], ["in-progress", "worker", ""], ["awaiting-confirmation", "worker", ""], ["completed", "customer", ""]]],
  ["BK-2015", "ramesh@demo.local", "Home Wi-Fi Setup & Optimization", "Nabin KC", "awaiting-worker", "Home", "2026-10-08T11:00:00+05:45", "New rental, ISP router only.", 120000, null, "esewa", "pending-verification", [["pending", "customer", ""], ["awaiting-worker", "admin", ""]]],
] as const;

for (const b of WAVE3) {
  const [no, email, svcName, wName, status, addrLabel, slot, instr, est, fin, method, payStatus, events] = b;
  const exists = await query(`SELECT id FROM bookings WHERE booking_no = $1`, [no]);
  if (exists.rowCount > 0) continue;
  const cu = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  const cid = cu.rows[0].id;
  const svc = svcIds[svcName as string];
  const catBps = (
    await query<{ commission_bps: number }>(
      `SELECT c.commission_bps FROM services s JOIN categories c ON c.id = s.category_id WHERE s.id = $1`,
      [svc],
    )
  ).rows[0].commission_bps;
  const wid = wName ? (workerIds[wName as string] ?? null) : null;
  const aid = await addressId(cid, addrLabel as string);
  const addrLine = (
    await query<{ line: string }>(`SELECT line FROM addresses WHERE id = $1`, [aid])
  ).rows[0].line;
  const ins = await query<{ id: string }>(
    `INSERT INTO bookings(booking_no, customer_id, service_id, worker_id, status, address_id,
                          address_text, slot, instructions, estimate_paisa, final_paisa,
                          payment_method, payment_status, commission_bps, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now() - interval '4 days') RETURNING id`,
    [no, cid, svc, wid, status, aid, `${addrLine}, Damak`, slot, instr, est, fin, method, payStatus, catBps],
  );
  const bid = ins.rows[0].id;
  for (const [st, by, note] of events as readonly (readonly [string, string, string])[]) {
    await query(
      `INSERT INTO booking_events(booking_id, status, by_role, note, created_at) VALUES ($1,$2,$3,$4, now() - interval '4 days')`,
      [bid, st, by, note],
    );
  }
  await query(`INSERT INTO payments(booking_id, provider, amount_paisa, status) VALUES ($1,$2,$3,$4)`, [
    bid,
    method,
    (fin ?? est) as number,
    payStatus === "paid" ? "verified" : "pending",
  ]);
  if (status === "completed" && fin !== null) {
    const f = fin as number;
    const comm = Math.floor((f * catBps) / 10000);
    await query(
      `INSERT INTO commission_ledger(booking_id, total_paisa, commission_paisa, worker_paisa, rate_bps, is_settled)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (booking_id) DO NOTHING`,
      [bid, f, comm, f - comm, catBps, method !== "cash"],
    );
    const pts = Math.floor(f / 10000);
    if (pts > 0) {
      await query(
        `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
         VALUES ($1, $2, 'earn', $3 || ' completed', $4) ON CONFLICT DO NOTHING`,
        [cid, pts, no, bid],
      );
    }
  }
}

// Gita now has 5 completions (2001, 2002, 2007, 2013, 2014) — milestone bonus.
{
  const n = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM bookings WHERE customer_id = $1 AND status = 'completed'`, [gita],
  );
  const has = await query(`SELECT id FROM reward_ledger WHERE user_id = $1 AND kind = 'bonus' LIMIT 1`, [gita]);
  if (n.rows[0].n >= 5 && has.rowCount === 0) {
    const ref = await query<{ id: string }>(`SELECT id FROM bookings WHERE booking_no = 'BK-2014'`);
    await query(
      `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
       VALUES ($1, 100, 'bonus', '5-booking milestone', $2) ON CONFLICT DO NOTHING`,
      [gita, ref.rows[0].id],
    );
  }
}

// Full refund case: BK-2012 paid online, then refunded (rewards reversed).
{
  const bk = await query<{ id: string }>(`SELECT id FROM bookings WHERE booking_no = 'BK-2012'`);
  const bid = bk.rows[0].id;
  const pay = await query<{ id: string; amount_paisa: string }>(
    `SELECT id, amount_paisa FROM payments WHERE booking_id = $1`, [bid],
  );
  const pid = pay.rows[0].id;
  const ex = await query(`SELECT id FROM refunds WHERE payment_id = $1 LIMIT 1`, [pid]);
  if (ex.rowCount === 0) {
    const admin = await query<{ id: string }>(`SELECT id FROM users WHERE email = 'admin@workers.local'`);
    await query(`INSERT INTO refunds(payment_id, amount_paisa, reason, by_user_id) VALUES ($1, $2, 'Customer cancelled within policy window', $3)`, [
      pid,
      Number(pay.rows[0].amount_paisa),
      admin.rows[0].id,
    ]);
    await query(`UPDATE payments SET status = 'refunded' WHERE id = $1`, [pid]);
    await query(`UPDATE bookings SET payment_status = 'refunded' WHERE id = $1`, [bid]);
    await query(
      `INSERT INTO reward_ledger(user_id, points, kind, reason, ref_booking_id)
       SELECT b.customer_id,
              -(SELECT COALESCE(SUM(points), 0) FROM reward_ledger WHERE ref_booking_id = b.id AND kind = 'earn'),
              'reverse', 'Refund reversal', b.id
       FROM bookings b WHERE b.id = $1 ON CONFLICT DO NOTHING`,
      [bid],
    );
  }
}

// Reviews for wave-3 completions.
for (const [no, wName, cemail, rating, text] of [
  ["BK-2012", "Sagar Rai", "ramesh@demo.local", 5, "Table solid again, polish matched perfectly."],
  ["BK-2013", "Bikash Thapa", "gita@demo.local", 5, "Found the faulty wire in minutes. Courteous."],
  ["BK-2014", "Hari Prasad", "gita@demo.local", 4, "Pump works. Left some oil stains, cleaned after asking."],
] as const) {
  const bk = await query<{ id: string }>(`SELECT id FROM bookings WHERE booking_no = $1`, [no]);
  if (bk.rowCount === 0) continue;
  const wu = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [
    wName === "Sagar Rai" ? "sagar@workers.local" : wName === "Bikash Thapa" ? "bikash@workers.local" : "hari@workers.local",
  ]);
  const cu = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [cemail]);
  await query(
    `INSERT INTO reviews(booking_id, worker_user_id, customer_id, rating, text)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (booking_id) DO NOTHING`,
    [bk.rows[0].id, wu.rows[0].id, cu.rows[0].id, rating, text],
  );
}

// Worker-side notifications.
for (const [email, title, body] of [
  ["ram@workers.local", "New assignment", "BK-1061 needs a plumber."],
  ["deepak@workers.local", "Dispute opened", "BK-2009 is disputed — settlement paused."],
] as const) {
  const u = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  const ex = await query(`SELECT id FROM notifications WHERE user_id = $1 AND title = $2 LIMIT 1`, [u.rows[0].id, title]);
  if (ex.rowCount === 0) {
    await query(`INSERT INTO notifications(user_id, title, body) VALUES ($1, $2, $3)`, [u.rows[0].id, title, body]);
  }
}

console.log("[db] seed-demo ok");
await pool.end();