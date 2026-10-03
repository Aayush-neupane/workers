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

console.log("[db] seed-demo ok");
await pool.end();
