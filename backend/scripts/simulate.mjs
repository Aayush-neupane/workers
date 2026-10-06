/**
 * Production-readiness simulation: exercises every major scenario against a
 * running API (default http://localhost:4001) and fails loudly on anything
 * incorrect. Uses scratch accounts (sim-*-cus / sim-*-pro) and cleans them
 * up at the end via cleanup-users semantics (inline).
 *
 * Run:  node scripts/simulate.mjs [baseUrl]
 * Needs: migrated + seeded DB, backend running, pg reachable.
 */
import { Pool } from "pg";

const BASE = process.argv[2] ?? "http://localhost:4001";
const DB = process.env.DATABASE_URL ?? "postgresql://sajilo:sajilo_dev@127.0.0.1:5432/sajilo";
const pool = new Pool({ connectionString: DB });

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra = "") {
  if (cond) { passed++; }
  else { failed++; failures.push(`${name} ${extra}`.trim()); console.log(`  FAIL ${name} ${extra}`); }
}
function jar() {
  const cookies = [];
  return async (path, opts = {}) => {
    const headers = { "Content-Type": "application/json", ...(opts.headers ?? {}) };
    if (cookies.length) headers.Cookie = cookies.join("; ");
    const res = await fetch(`${BASE}${path}`, { ...opts, headers });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) cookies.push(c.split(";")[0]);
    let body = null;
    try { body = await res.json(); } catch { /* empty */ }
    return { status: res.status, body };
  };
}
const TS = Date.now().toString(36);
const admin = jar(), cus = jar(), pro = jar(), anon = jar();
const q = (text, params) => pool.query(text, params);

console.log("== 1. public ==");
{
  const r = await anon("/api/services");
  check("services 200 + zone", r.status === 200 && r.body.zone === "Damak" && r.body.services.length >= 9, `${r.status}/${r.body?.services?.length}`);
  const w = await anon("/api/services?q=" + encodeURIComponent("%_%"));
  check("wildcard escaped", w.status === 200 && (w.body.services?.length ?? 99) === 0, `${w.body?.services?.length}`);
  const b = await anon("/api/services/00000000-0000-0000-0000-000000000000");
  check("service 404", b.status === 404, `${b.status}`);
  const l = await anon("/api/reviews?limit=abc");
  check("bad limit defaults", l.status === 200, `${l.status}`);
  const h = await anon("/health");
  check("health", h.status === 200 && h.body.zone === "Damak", `${h.status}`);
}

console.log("== 2. auth validation ==");
{
  const badPhone = await anon("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "A B", phone: "abc", email: `x${TS}@e.com`, password: "Password123!" }) });
  check("bad phone 400", badPhone.status === 400, `${badPhone.status}`);
  const shortPw = await anon("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "A B", phone: "9852600000", email: `y${TS}@e.com`, password: "short" }) });
  check("short pw 400", shortPw.status === 400, `${shortPw.status}`);
  const dup1 = await anon("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Sim Cus", phone: "9852600101", email: `sim-${TS}-cus@example.com`, password: "Simtest123!" }) });
  check("register 201", dup1.status === 201, `${dup1.status} ${JSON.stringify(dup1.body)}`);
  const dup2 = await anon("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Sim Cus", phone: "9852600101", email: `sim-${TS}-cus@example.com`, password: "Simtest123!" }) });
  check("dup email 409", dup2.status === 409, `${dup2.status}`);
  const badLogin = await anon("/api/auth/login", { method: "POST", body: JSON.stringify({ email: `sim-${TS}-cus@example.com`, password: "WrongPass1!" }) });
  check("wrong pw 401", badLogin.status === 401, `${badLogin.status}`);
  const noUser = await anon("/api/auth/login", { method: "POST", body: JSON.stringify({ email: `nobody-${TS}@e.com`, password: "Whatever1!" }) });
  check("unknown 401", noUser.status === 401, `${noUser.status}`);
  const meAnon = await jar()("/api/auth/me");
  check("me anon 401", meAnon.status === 401, `${meAnon.status}`);
  const csrfRes = await fetch(`${BASE}/api/auth/login`, { method: "POST", body: "email=a&password=b" });
  check("form-encoded 415", csrfRes.status === 415, `${csrfRes.status}`);
  const badJson = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
  check("malformed JSON 400", badJson.status === 400, `${badJson.status}`);
}

console.log("== 3. admin login + scratch pro ==");
await admin("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@sajilo.local", password: "ChangeMe123!" }) });
await cus("/api/auth/login", { method: "POST", body: JSON.stringify({ email: `sim-${TS}-cus@example.com`, password: "Simtest123!" }) });
{
  const me = await cus("/api/auth/me");
  check("customer me", me.status === 200 && me.body.user.roles.includes("CUSTOMER") && typeof me.body.user.phone === "string", `${me.status}`);
}
const proEmail = `sim-${TS}-pro@example.com`;
let proId = null;
{
  const reg = await anon("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Sim Pro", phone: "9852600102", email: proEmail, password: "Simtest123!" }) });
  check("pro-as-customer registers", reg.status === 201, `${reg.status}`);
  const list = await admin(`/api/admin/customers?q=${encodeURIComponent(proEmail)}`);
  proId = list.body.customers?.[0]?.id ?? null;
  check("pro found as customer", !!proId);
  const inv = await admin("/api/admin/workers/invite-user", { method: "POST", body: JSON.stringify({ userId: proId }) });
  check("invite customer 201", inv.status === 201, `${inv.status} ${JSON.stringify(inv.body)}`);
  await pro("/api/auth/login", { method: "POST", body: JSON.stringify({ email: proEmail, password: "Simtest123!" }) });
  const mine = await pro("/api/worker/invites/mine");
  const invId = mine.body.invites?.[0]?.id;
  check("invite visible", !!invId);
  const acc = await pro(`/api/worker/invites/${invId}/accept`, { method: "POST", body: JSON.stringify({}) });
  check("in-app accept", acc.status === 200, `${acc.status}`);
  const me = await pro("/api/auth/me");
  check("now worker+cust", me.body.user.roles.includes("WORKER"), JSON.stringify(me.body.user.roles));
  // verify + activate with a skill
  const svc = await q(`SELECT id FROM services WHERE name='Switch & socket repair'`);
  const v = await admin(`/api/admin/workers/${proId}/verify`, { method: "POST", body: JSON.stringify({ state: "verified", notes: "sim" }) });
  check("verify ok", v.status === 200, `${v.status}`);
  const a = await admin(`/api/admin/workers/${proId}/activate`, { method: "POST", body: JSON.stringify({ active: true, serviceIds: [svc.rows[0].id] }) });
  check("activate w/ skill", a.status === 200, `${a.status} ${JSON.stringify(a.body)}`);
  const a0 = await admin(`/api/admin/workers/${proId}/activate`, { method: "POST", body: JSON.stringify({ active: true, serviceIds: [] }) });
  check("activate no skill 400", a0.status === 400, `${a0.status}`);
}

console.log("== 4. booking create validation ==");
const svcRow = await q(`SELECT id FROM services WHERE name='Switch & socket repair'`);
const SVC = svcRow.rows[0].id;
const mk = (over = {}) => ({
  serviceId: SVC, addressText: "Damak-5, Himal Chowk", slot: "2030-06-01T10:00:00.000Z",
  instructions: "Simulation booking for production checks.", paymentMethod: "cash", ...over,
});
{
  const badSvc = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ serviceId: "00000000-0000-0000-0000-000000000000" })) });
  check("bad service 404", badSvc.status === 404, `${badSvc.status}`);
  const past = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ slot: "2020-01-01T10:00:00.000Z" })) });
  check("past slot 400", past.status === 400, `${past.status}`);
  const outside = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ addressText: "Kathmandu, Baneshwor" })) });
  check("outside Damak 400", outside.status === 400, `${outside.status}`);
  const adminOrder = await admin("/api/bookings", { method: "POST", body: JSON.stringify(mk()) });
  check("admin cannot order 403", adminOrder.status === 403, `${adminOrder.status}`);
  const proOrder = await pro("/api/bookings", { method: "POST", body: JSON.stringify(mk()) });
  check("worker cannot order 403", proOrder.status === 403, `${proOrder.status}`);
  const xss = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ instructions: "<script>alert(1)</script> harmless?" })) });
  check("xss text stored 201", xss.status === 201, `${xss.status}`);
  if (xss.status === 201) {
    await cus(`/api/bookings/${xss.body.bookingNo}/transition`, { method: "POST", body: JSON.stringify({ to: "cancelled", note: "sim cleanup" }) });
  }
}
let BK = null;
{
  // reschedule rules: ok while pending, blocked once confirmed
  const c = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ slot: "2030-06-02T10:00:00.000Z" })) });
  check("create 201", c.status === 201, `${c.status} ${JSON.stringify(c.body)}`);
  BK = c.body.bookingNo;
  const rs1 = await cus(`/api/bookings/${BK}/slot`, { method: "PUT", body: JSON.stringify({ slot: "2030-06-03T10:00:00.000Z" }) });
  check("reschedule pending ok", rs1.status === 200, `${rs1.status} ${JSON.stringify(rs1.body)}`);
  const other = await anon("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Sim Other", phone: "9852600103", email: `sim-${TS}-other@example.com`, password: "Simtest123!" }) });
  check("second customer", other.status === 201, `${other.status}`);
  const asg = await admin(`/api/bookings/${BK}/assign`, { method: "POST", body: JSON.stringify({ workerId: proId, reason: "sim" }) });
  check("assign skilled pro", asg.status === 200, `${asg.status} ${JSON.stringify(asg.body)}`);
  const autoSt = await q(`SELECT status, worker_id FROM bookings WHERE booking_no=$1`, [BK]);
  check("assign auto-opens for confirmation", autoSt.rows[0].status === "awaiting-worker" && autoSt.rows[0].worker_id === proId, JSON.stringify(autoSt.rows[0]));
  const tr1 = await admin(`/api/bookings/${BK}/transition`, { method: "POST", body: JSON.stringify({ to: "confirmed", note: "sim" }) });
  check("awaiting-worker->confirmed (admin)", tr1.status === 200, `${tr1.status} ${JSON.stringify(tr1.body)}`);
  const rs2 = await cus(`/api/bookings/${BK}/slot`, { method: "PUT", body: JSON.stringify({ slot: "2030-06-04T10:00:00.000Z" }) });
  check("reschedule confirmed blocked", rs2.status === 409, `${rs2.status}`);
}

console.log("== 5. OTP lifecycle ==");
{
  // move to in-progress as admin, issue + verify as pro flow
  const t1 = await admin(`/api/bookings/${BK}/transition`, { method: "POST", body: JSON.stringify({ to: "en-route", note: "sim" }) });
  check("confirmed->en-route", t1.status === 200, `${t1.status}`);
  // worker moves en-route->in-progress
  const t2 = await pro(`/api/bookings/${BK}/transition`, { method: "POST", body: JSON.stringify({ to: "in-progress", note: "sim" }) });
  check("worker en-route->in-progress", t2.status === 200, `${t2.status} ${JSON.stringify(t2.body)}`);
  const iss = await pro(`/api/bookings/${BK}/otp/issue`, { method: "POST", body: JSON.stringify({}) });
  check("otp issue", iss.status === 200, `${iss.status} ${JSON.stringify(iss.body)}`);
  const iss2 = await pro(`/api/bookings/${BK}/otp/issue`, { method: "POST", body: JSON.stringify({}) });
  // Status already moved to awaiting-confirmation, so the state gate (409)
  // fires before the re-issue throttle — either way no second code goes out.
  check("second issue blocked", iss2.status === 409 || iss2.status === 429, `${iss2.status}`);
  const wrong = await pro(`/api/bookings/${BK}/otp/verify`, { method: "POST", body: JSON.stringify({ code: "000000" }) });
  check("wrong code 400", wrong.status === 400, `${wrong.status} ${JSON.stringify(wrong.body)}`);
  const row = await q(`SELECT code_hash FROM booking_otps WHERE booking_id=(SELECT id FROM bookings WHERE booking_no=$1) AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`, [BK]);
  check("hash is HMAC-length", /^[0-9a-f]{64}$/.test(row.rows[0].code_hash));
  // read the live code from the customer notification (test-only backdoor)
  const note = await q(`SELECT body FROM notifications WHERE user_id=(SELECT id FROM users WHERE email=$1) AND title='Completion code' ORDER BY created_at DESC LIMIT 1`, [`sim-${TS}-cus@example.com`]);
  const m = note.rows[0].body.match(/(\d{6})/);
  check("code delivered to customer", !!m);
  const good = await pro(`/api/bookings/${BK}/otp/verify`, { method: "POST", body: JSON.stringify({ code: m[1] }) });
  check("correct code completes", good.status === 200, `${good.status} ${JSON.stringify(good.body)}`);
  const st = await q(`SELECT status, final_paisa, payment_status FROM bookings WHERE booking_no=$1`, [BK]);
  check("completed+paid", st.rows[0].status === "completed" && st.rows[0].payment_status === "paid", JSON.stringify(st.rows[0]));
  const led = await q(`SELECT total_paisa, commission_paisa FROM commission_ledger WHERE booking_id=(SELECT id FROM bookings WHERE booking_no=$1)`, [BK]);
  check("ledger posted", led.rowCount === 1 && Number(led.rows[0].total_paisa) > 0, JSON.stringify(led.rows[0]));
  const pts = await q(`SELECT COALESCE(SUM(points),0)::int AS b FROM reward_ledger WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [`sim-${TS}-cus@example.com`]);
  check("points earned", pts.rows[0].b > 0, `${pts.rows[0].b}`);
  const rev = await cus("/api/reviews", { method: "POST", body: JSON.stringify({ bookingId: BK, rating: 5, text: "Great simulation work." }) });
  check("review 201", rev.status === 201, `${rev.status} ${JSON.stringify(rev.body)}`);
  const rev2 = await cus("/api/reviews", { method: "POST", body: JSON.stringify({ bookingId: BK, rating: 5, text: "Again." }) });
  check("dup review 409", rev2.status === 409, `${rev2.status}`);
}

console.log("== 6. money: refunds + settlements ==");
{
  // esewa booking -> pending payment -> refund tests
  const e = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ slot: "2030-06-05T10:00:00.000Z", paymentMethod: "esewa" })) });
  check("esewa booking 201", e.status === 201, `${e.status}`);
  const pay = await q(`SELECT id, amount_paisa FROM payments WHERE booking_id=(SELECT id FROM bookings WHERE booking_no=$1)`, [e.body.bookingNo]);
  const pid = pay.rows[0].id; const amt = Number(pay.rows[0].amount_paisa);
  const half = Math.floor(amt / 2);
  const r1 = await admin("/api/admin/refunds", { method: "POST", body: JSON.stringify({ paymentId: pid, amountPaisa: half, reason: "sim partial" }) });
  check("partial refund", r1.status === 200 && r1.body.partial === true, `${r1.status} ${JSON.stringify(r1.body)}`);
  const rOver = await admin("/api/admin/refunds", { method: "POST", body: JSON.stringify({ paymentId: pid, amountPaisa: amt, reason: "sim over" }) });
  check("over-refund 400", rOver.status === 400, `${rOver.status} ${JSON.stringify(rOver.body)}`);
  const r2 = await admin("/api/admin/refunds", { method: "POST", body: JSON.stringify({ paymentId: pid, amountPaisa: amt - half, reason: "sim rest" }) });
  check("refund remainder", r2.status === 200 && r2.body.partial === false, `${r2.status} ${JSON.stringify(r2.body)}`);
  // settlements: exact owed for sim pro
  const owed = await q(`SELECT COALESCE(SUM(cl.commission_paisa),0)::bigint AS o FROM commission_ledger cl JOIN bookings b ON b.id=cl.booking_id WHERE b.worker_id=$1 AND NOT cl.is_settled`, [proId]);
  const o = Number(owed.rows[0].o);
  check("sim pro has owed commission", o > 0, `${o}`);
  const sOver = await admin("/api/admin/settlements", { method: "POST", body: JSON.stringify({ workerId: proId, amountPaisa: o + 100, kind: "payout", note: "sim" }) });
  check("over-settle 400", sOver.status === 400, `${sOver.status} ${JSON.stringify(sOver.body)}`);
  const sOk = await admin("/api/admin/settlements", { method: "POST", body: JSON.stringify({ workerId: proId, amountPaisa: o, kind: "payout", note: "sim" }) });
  check("settle exact", sOk.status === 200 && sOk.body.remainingPaisa === 0, `${sOk.status} ${JSON.stringify(sOk.body)}`);
  const sEmpty = await admin("/api/admin/settlements", { method: "POST", body: JSON.stringify({ workerId: proId, amountPaisa: 100, kind: "payout", note: "sim" }) });
  check("settle nothing-owed 400", sEmpty.status === 400, `${sEmpty.status}`);
}

console.log("== 7. quotes + race ==");
{
  const bad = await cus("/api/quotes/requests", { method: "POST", body: JSON.stringify({ title: "Short?", description: "too short", landmark: "Kathmandu", windowStart: "2030-07-01T10:00:00.000Z", windowEnd: "2030-07-02T10:00:00.000Z" }) });
  check("bad quote 400", bad.status === 400, `${bad.status}`);
  const qr = await cus("/api/quotes/requests", { method: "POST", body: JSON.stringify({ title: "Repaint whole house urgently", description: "Three bedrooms plus living room, paint supplied by us, need it done in a week.", landmark: "Damak-5, Himal Chowk", windowStart: "2030-07-01T10:00:00.000Z", windowEnd: "2030-07-05T10:00:00.000Z", photos: [] }) });
  check("quote 201", qr.status === 201, `${qr.status} ${JSON.stringify(qr.body)}`);
  const qid = qr.body.id;
  // Price above the approval threshold forces needsApproval=true.
  const prop = await pro(`/api/quotes/requests/${qid}/proposals`, { method: "POST", body: JSON.stringify({ pricePaisa: 600000, scope: "Full repaint labor only.", availability: "Next week" }) });
  check("proposal 201", prop.status === 201, `${prop.status} ${JSON.stringify(prop.body)}`);
  const pid2 = prop.body.id;
  const ap = await admin(`/api/quotes/proposals/${pid2}/approve`, { method: "POST", body: JSON.stringify({}) });
  check("approve 200", ap.status === 200, `${ap.status} ${JSON.stringify(ap.body)}`);
  const ap2 = await admin(`/api/quotes/proposals/${pid2}/approve`, { method: "POST", body: JSON.stringify({}) });
  check("re-approve 409", ap2.status === 409, `${ap2.status}`);
  // double-accept race
  const [a1, a2] = await Promise.all([
    cus(`/api/quotes/proposals/${pid2}/accept`, { method: "POST", body: JSON.stringify({}) }),
    cus(`/api/quotes/proposals/${pid2}/accept`, { method: "POST", body: JSON.stringify({}) }),
  ]);
  const codes = [a1.status, a2.status].sort().join(",");
  check("double-accept one wins", codes === "201,409", codes);
  const n = await q(`SELECT COUNT(*)::int AS n FROM bookings WHERE id IN (SELECT booking_id FROM quote_requests WHERE id=$1)`, [qid]);
  void n;
  const cnt = await q(`SELECT COUNT(*)::int AS n FROM bookings b JOIN quote_requests qr ON qr.booking_id=b.id WHERE qr.id=$1`, [qid]);
  check("exactly one booking", cnt.rows[0].n === 1, `${cnt.rows[0].n}`);
}

console.log("== 8. tickets, addresses, coverage ==");
{
  for (let i = 0; i < 5; i++) {
    await cus("/api/tickets", { method: "POST", body: JSON.stringify({ subject: `Sim ticket number ${i} here`, message: "This is a sufficiently long ticket message for testing." }) });
  }
  const t6 = await cus("/api/tickets", { method: "POST", body: JSON.stringify({ subject: "Sixth ticket attempt here", message: "This is a sufficiently long ticket message for testing." }) });
  check("6th open ticket 400", t6.status === 400, `${t6.status} ${JSON.stringify(t6.body)}`);
  for (let i = 0; i < 6; i++) {
    await cus("/api/addresses", { method: "POST", body: JSON.stringify({ label: `A${i}`, line: `Damak-${(i % 9) + 1}, Street ${i}`, phone: "9852600000" }) });
  }
  const a6 = await cus("/api/addresses", { method: "POST", body: JSON.stringify({ label: "A6", line: "Damak-1, Extra street", phone: "9852600000" }) });
  check("6th address 400", a6.status === 400, `${a6.status} ${JSON.stringify(a6.body)}`);
  const out = await cus("/api/addresses", { method: "POST", body: JSON.stringify({ label: "Far", line: "Kathmandu, Baneshwor", phone: "9852600000" }) });
  check("non-Damak address 400", out.status === 400, `${out.status}`);
  // closed ward: close 10, book, reopen
  await admin("/api/admin/wards", { method: "PUT", body: JSON.stringify({ wards: [true, true, true, true, true, true, true, true, true, false] }) });
  const cw = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ addressText: "Damak-10, Last ward", slot: "2030-06-06T10:00:00.000Z" })) });
  check("closed ward 400", cw.status === 400, `${cw.status} ${JSON.stringify(cw.body)}`);
  const allShut = await admin("/api/admin/wards", { method: "PUT", body: JSON.stringify({ wards: [false, false, false, false, false, false, false, false, false, false] }) });
  check("close-all wards 400", allShut.status === 400, `${allShut.status}`);
  await admin("/api/admin/wards", { method: "PUT", body: JSON.stringify({ wards: [true, true, true, true, true, true, true, true, true, true] }) });
}

console.log("== 9. perms + validation fuzz ==");
{
  const wAdmin = await pro("/api/admin/overview", {});
  check("worker blocked from admin", wAdmin.status === 403, `${wAdmin.status}`);
  const badUuid = await admin("/api/admin/workers/not-a-uuid/verify", { method: "POST", body: JSON.stringify({ state: "verified", notes: "" }) });
  check("bad uuid 400", badUuid.status === 400, `${badUuid.status}`);
  const sqli = await admin(`/api/admin/customers?q=${encodeURIComponent("' OR '1'='1")}`);
  check("sqli safe 200", sqli.status === 200 && Array.isArray(sqli.body.customers), `${sqli.status}`);
  const big = await cus("/api/tickets", { method: "POST", body: JSON.stringify({ subject: "x".repeat(50), message: "y".repeat(5000) }) });
  check("oversize message 400", big.status === 400, `${big.status}`);
  const badSet = await admin("/api/admin/settings", { method: "PUT", body: JSON.stringify({ value: { referralBonus: 999999 } }) });
  check("settings cap 400", badSet.status === 400, `${badSet.status}`);
  const badKey = await admin("/api/admin/settings", { method: "PUT", body: JSON.stringify({ value: { evilKey: 1 } }) });
  check("settings strict 400", badKey.status === 400, `${badKey.status}`);
}

console.log("== 10. redeem, referral, milestone, lockout, dispute, cash, push, quotes-neg, rules ==");
{
  // redeem: fund points, book with rewards, cancel returns them
  await q(`INSERT INTO reward_ledger(user_id, points, kind, reason) VALUES ((SELECT id FROM users WHERE email=$1), 100, 'bonus', 'sim fund')`, [`sim-${TS}-cus@example.com`]);
  const bal0 = await q(`SELECT COALESCE(SUM(points),0)::int AS b FROM reward_ledger WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [`sim-${TS}-cus@example.com`]);
  const rb = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ slot: "2030-06-07T10:00:00.000Z", useRewards: true })) });
  check("redeem booking 201", rb.status === 201 && rb.body.discountPaisa === 5000, `${rb.status} ${JSON.stringify(rb.body)}`);
  const cxl = await cus(`/api/bookings/${rb.body.bookingNo}/transition`, { method: "POST", body: JSON.stringify({ to: "cancelled", note: "sim" }) });
  check("cancel redeems back", cxl.status === 200, `${cxl.status}`);
  const bal1 = await q(`SELECT COALESCE(SUM(points),0)::int AS b FROM reward_ledger WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [`sim-${TS}-cus@example.com`]);
  check("points restored", bal1.rows[0].b === bal0.rows[0].b, `${bal0.rows[0].b}->${bal1.rows[0].b}`);
  // insufficient redeem (fresh account, 0 points)
  const otr = jar();
  await otr("/api/auth/login", { method: "POST", body: JSON.stringify({ email: `sim-${TS}-other@example.com`, password: "Simtest123!" }) });
  const poor = await otr("/api/bookings", { method: "POST", body: JSON.stringify(mk({ slot: "2030-06-08T10:00:00.000Z", useRewards: true })) });
  check("poor redeem 400", poor.status === 400, `${poor.status}`);
}
{
  // referral: bonus is snapshotted at signup, so set it BEFORE the referee registers
  await admin("/api/admin/settings", { method: "PUT", body: JSON.stringify({ value: { referralBonus: 77 } }) });
  const myCode = await q(`SELECT code FROM referral_codes WHERE owner_user_id=(SELECT id FROM users WHERE email=$1)`, [`sim-${TS}-cus@example.com`]);
  const ref = await anon("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Sim Ref", phone: "9852600104", email: `sim-${TS}-ref@example.com`, password: "Simtest123!", referralCode: myCode.rows[0].code }) });
  check("referral signup 201", ref.status === 201, `${ref.status} ${JSON.stringify(ref.body)}`);
  const rj = jar();
  await rj("/api/auth/login", { method: "POST", body: JSON.stringify({ email: `sim-${TS}-ref@example.com`, password: "Simtest123!" }) });
  const rAddr = await rj("/api/addresses", { method: "POST", body: JSON.stringify({ label: "Home", line: "Damak-5, Test lane", phone: "9852600104" }) });
  const rBk = await rj("/api/bookings", { method: "POST", body: JSON.stringify({ serviceId: SVC, addressId: rAddr.body.address.id, slot: "2030-06-09T10:00:00.000Z", instructions: "Referral sim booking works.", paymentMethod: "cash" }) });
  check("referee books w/ addressId", rBk.status === 201, `${rBk.status}`);
  await admin(`/api/bookings/${rBk.body.bookingNo}/assign`, { method: "POST", body: JSON.stringify({ workerId: proId, reason: "sim" }) });
  for (const to of ["confirmed", "en-route", "in-progress"]) {
    await admin(`/api/bookings/${rBk.body.bookingNo}/transition`, { method: "POST", body: JSON.stringify({ to, note: "sim" }) });
  }
  await admin(`/api/bookings/${rBk.body.bookingNo}/otp/issue`, { method: "POST", body: JSON.stringify({}) });
  const nz = await q(`SELECT body FROM notifications WHERE user_id=(SELECT id FROM users WHERE email=$1) AND title='Completion code' ORDER BY created_at DESC LIMIT 1`, [`sim-${TS}-ref@example.com`]);
  await admin(`/api/bookings/${rBk.body.bookingNo}/otp/verify`, { method: "POST", body: JSON.stringify({ code: nz.rows[0].body.match(/(\d{6})/)[1] }) });
  const both = await q(`SELECT user_id, points FROM reward_ledger WHERE reason LIKE 'Referral reward%' AND created_at > now() - interval '5 minutes'`);
  check("both sides paid 77", both.rows.length === 2 && both.rows.every((r) => r.points === 77), JSON.stringify(both.rows));
  await admin("/api/admin/settings", { method: "PUT", body: JSON.stringify({ value: { referralBonus: 50 } }) });
}
{
  // milestone: every-1st-completion pays immediately (restored after)
  await admin("/api/admin/settings", { method: "PUT", body: JSON.stringify({ value: { milestoneBookings: 1, milestoneBonus: 11 } }) });
  const mb = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ slot: "2030-06-10T10:00:00.000Z" })) });
  await admin(`/api/bookings/${mb.body.bookingNo}/assign`, { method: "POST", body: JSON.stringify({ workerId: proId, reason: "sim" }) });
  for (const to of ["confirmed", "en-route", "in-progress"]) {
    await admin(`/api/bookings/${mb.body.bookingNo}/transition`, { method: "POST", body: JSON.stringify({ to, note: "sim" }) });
  }
  await admin(`/api/bookings/${mb.body.bookingNo}/otp/issue`, { method: "POST", body: JSON.stringify({}) });
  const mn = await q(`SELECT body FROM notifications WHERE user_id=(SELECT id FROM users WHERE email=$1) AND title='Completion code' ORDER BY created_at DESC LIMIT 1`, [`sim-${TS}-cus@example.com`]);
  await admin(`/api/bookings/${mb.body.bookingNo}/otp/verify`, { method: "POST", body: JSON.stringify({ code: mn.rows[0].body.match(/(\d{6})/)[1] }) });
  const ms = await q(`SELECT points FROM reward_ledger WHERE user_id=(SELECT id FROM users WHERE email=$1) AND reason='Milestone bonus' ORDER BY created_at DESC LIMIT 1`, [`sim-${TS}-cus@example.com`]);
  check("milestone paid", ms.rows[0]?.points === 11, JSON.stringify(ms.rows[0]));
  await admin("/api/admin/settings", { method: "PUT", body: JSON.stringify({ value: { milestoneBookings: 5, milestoneBonus: 100 } }) });
  const merged = await admin("/api/admin/settings", {});
  check("settings merge keeps keys", merged.body.rewardPerNpr100 !== undefined && merged.body.milestoneBookings === 5, JSON.stringify(merged.body).slice(0, 80));
}
{
  // OTP lockout then dispute lifecycle + finalPaisa cap
  const lb = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ slot: "2030-06-11T10:00:00.000Z" })) });
  await admin(`/api/bookings/${lb.body.bookingNo}/assign`, { method: "POST", body: JSON.stringify({ workerId: proId, reason: "sim" }) });
  for (const to of ["confirmed", "en-route", "in-progress"]) {
    await admin(`/api/bookings/${lb.body.bookingNo}/transition`, { method: "POST", body: JSON.stringify({ to, note: "sim" }) });
  }
  await pro(`/api/bookings/${lb.body.bookingNo}/otp/issue`, { method: "POST", body: JSON.stringify({}) });
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const w = await pro(`/api/bookings/${lb.body.bookingNo}/otp/verify`, { method: "POST", body: JSON.stringify({ code: "111111" }) });
    last = w.status;
  }
  check("6th guess locked 429", last === 429, `${last}`);
  const dsp = await cus(`/api/bookings/${lb.body.bookingNo}/transition`, { method: "POST", body: JSON.stringify({ to: "disputed", note: "sim dispute" }) });
  check("customer disputes", dsp.status === 200, `${dsp.status}`);
  const cap = await admin(`/api/bookings/${lb.body.bookingNo}/transition`, { method: "POST", body: JSON.stringify({ to: "completed", finalPaisa: 99999999, note: "sim" }) });
  check("finalPaisa cap 400", cap.status === 400, `${cap.status}`);
  const done2 = await admin(`/api/bookings/${lb.body.bookingNo}/transition`, { method: "POST", body: JSON.stringify({ to: "completed", note: "sim" }) });
  check("dispute resolved", done2.status === 200, `${done2.status}`);
  // cash collect exact/duplicate
  const cc1 = await pro(`/api/bookings/${lb.body.bookingNo}/cash-collect`, { method: "POST", body: JSON.stringify({ amountPaisa: 1 }) });
  check("wrong cash 400", cc1.status === 400, `${cc1.status} ${JSON.stringify(cc1.body)}`);
  const need = await q(`SELECT COALESCE(final_paisa, estimate_paisa - discount_paisa) AS o FROM bookings WHERE booking_no=$1`, [lb.body.bookingNo]);
  const cc2 = await pro(`/api/bookings/${lb.body.bookingNo}/cash-collect`, { method: "POST", body: JSON.stringify({ amountPaisa: Number(need.rows[0].o) }) });
  check("exact cash 201", cc2.status === 201, `${cc2.status}`);
  const cc3 = await pro(`/api/bookings/${lb.body.bookingNo}/cash-collect`, { method: "POST", body: JSON.stringify({ amountPaisa: Number(need.rows[0].o) }) });
  check("dup cash 409", cc3.status === 409, `${cc3.status}`);
}
{
  // esewa unconfigured, push paths, quote negatives, rules, tickets, invites
  const es = await cus("/api/payments/00000000-0000-0000-0000-000000000000/esewa/initiate", { method: "POST", body: JSON.stringify({}) });
  check("esewa unconfigured 400", es.status === 400, `${es.status}`);
  const pa = await cus("/api/push/subscribe", { method: "POST", body: JSON.stringify({ endpoint: "https://fcm.googleapis.com/fake-sim-endpoint", p256dh: "abcdefghij1234567890", auth: "abcdefghij1234567890", audience: "worker" }) });
  check("audience mismatch 403", pa.status === 403, `${pa.status}`);
  const pd = await cus("/api/push/devices", {});
  check("devices list", pd.status === 200 && Array.isArray(pd.body.devices), `${pd.status}`);
  const pt = await cus("/api/push/test", { method: "POST", body: JSON.stringify({}) });
  check("push test 200", pt.status === 200, `${pt.status}`);
  const cProp = await cus("/api/quotes/requests/mine", {});
  void cProp;
  const qBadRole = await cus(`/api/quotes/requests/00000000-0000-0000-0000-000000000000/proposals`, { method: "POST", body: JSON.stringify({ pricePaisa: 1000, scope: "x".repeat(20), availability: "soon!!" }) });
  check("customer propose 403", qBadRole.status === 403, `${qBadRole.status}`);
  const qNull = await cus("/api/quotes/requests", { method: "POST", body: JSON.stringify({ title: "Admin-authored sim quote!", description: "Long enough description here.", landmark: "Damak-3, Test", windowStart: "2030-08-01T10:00:00.000Z", windowEnd: "2030-08-02T10:00:00.000Z", photos: [] }) });
  const qp = await admin(`/api/quotes/requests/${qNull.body.id}/proposals`, { method: "POST", body: JSON.stringify({ pricePaisa: 600000, scope: "Admin scoped proposal text.", availability: "Anytime soon" }) });
  const qa = await admin(`/api/quotes/proposals/${qp.body.id}/approve`, { method: "POST", body: JSON.stringify({}) });
  check("admin proposal approved", qa.status === 200, `${qa.status}`);
  const qAcc = await cus(`/api/quotes/proposals/${qp.body.id}/accept`, { method: "POST", body: JSON.stringify({}) });
  check("null-worker accept 400", qAcc.status === 400, `${qAcc.status} ${JSON.stringify(qAcc.body)}`);
  const cr1 = await admin("/api/admin/commission-rules", { method: "POST", body: JSON.stringify({ scope: "global", categoryId: null, workerId: null, rateBps: 1500 }) });
  check("global rule ok", cr1.status === 200, `${cr1.status}`);
  const cr2 = await admin("/api/admin/commission-rules", { method: "POST", body: JSON.stringify({ scope: "category", categoryId: null, workerId: null, rateBps: 1500 }) });
  check("bad scope 400", cr2.status === 400, `${cr2.status}`);
  const tr = await admin("/api/admin/tickets/00000000-0000-0000-0000-000000000000/reply", { method: "POST", body: JSON.stringify({ body: "x" }) });
  check("reply ghost 404", tr.status === 404, `${tr.status}`);
  const myT = await q(`SELECT id FROM support_tickets WHERE user_id=(SELECT id FROM users WHERE email=$1) LIMIT 1`, [`sim-${TS}-cus@example.com`]);
  await admin(`/api/admin/tickets/${myT.rows[0].id}/reply`, { method: "POST", body: JSON.stringify({ body: "Sim reply from support." }) });
  const seen = await cus("/api/tickets", {});
  check("reply visible", JSON.stringify(seen.body).includes("Sim reply"), "missing");
  const admId = await q(`SELECT id FROM users WHERE email='admin@sajilo.local'`);
  const selfInv = await admin("/api/admin/workers/invite-user", { method: "POST", body: JSON.stringify({ userId: admId.rows[0].id }) });
  check("self-invite 400", selfInv.status === 400, `${selfInv.status}`);
}

console.log("== 10b. reschedule requests via admin ==");
{
  // worker proposes -> admin approves -> slot moves, both sides notified
  const wb = await cus("/api/bookings", { method: "POST", body: JSON.stringify(mk({ slot: "2030-09-01T10:00:00.000Z" })) });
  check("resched booking 201", wb.status === 201, `${wb.status}`);
  const W = wb.body.bookingNo;
  await admin(`/api/bookings/${W}/assign`, { method: "POST", body: JSON.stringify({ workerId: proId, reason: "sim" }) });
  await admin(`/api/bookings/${W}/transition`, { method: "POST", body: JSON.stringify({ to: "confirmed", note: "sim" }) });
  const direct = await cus(`/api/bookings/${W}/slot`, { method: "PUT", body: JSON.stringify({ slot: "2030-09-02T10:00:00.000Z" }) });
  check("direct move after confirm blocked", direct.status === 409, `${direct.status}`);
  const past = await pro(`/api/bookings/${W}/reschedule-requests`, { method: "POST", body: JSON.stringify({ proposedSlot: "2020-01-01T10:00:00.000Z", reason: "too soon" }) });
  check("past proposal 400", past.status === 400, `${past.status}`);
  const rq = await pro(`/api/bookings/${W}/reschedule-requests`, { method: "POST", body: JSON.stringify({ proposedSlot: "2030-09-03T10:00:00.000Z", reason: "van broke down" }) });
  check("worker request 201", rq.status === 201, `${rq.status} ${JSON.stringify(rq.body)}`);
  const dup = await cus(`/api/bookings/${W}/reschedule-requests`, { method: "POST", body: JSON.stringify({ proposedSlot: "2030-09-04T10:00:00.000Z", reason: "second" }) });
  check("second pending 409", dup.status === 409, `${dup.status}`);
  const queue = await admin("/api/admin/reschedule-requests", {});
  check("admin queue lists it", queue.status === 200 && queue.body.requests.some((r) => r.id === rq.body.id), `${queue.status}`);
  const ap = await admin(`/api/admin/reschedule-requests/${rq.body.id}/approve`, { method: "POST", body: JSON.stringify({}) });
  check("approve moves slot", ap.status === 200 && ap.body.slot === "2030-09-03T10:00:00.000Z", `${ap.status} ${JSON.stringify(ap.body)}`);
  const moved = await q(`SELECT slot FROM bookings WHERE booking_no=$1`, [W]);
  check("slot persisted", new Date(moved.rows[0].slot).toISOString() === "2030-09-03T10:00:00.000Z", JSON.stringify(moved.rows[0]));
  // customer proposes -> admin rejects -> slot unchanged, requester told
  const rq2 = await cus(`/api/bookings/${W}/reschedule-requests`, { method: "POST", body: JSON.stringify({ proposedSlot: "2030-09-05T10:00:00.000Z", reason: "change of plans" }) });
  check("customer request 201", rq2.status === 201, `${rq2.status}`);
  const rj2 = await admin(`/api/admin/reschedule-requests/${rq2.body.id}/reject`, { method: "POST", body: JSON.stringify({ reason: "pro unavailable then" }) });
  check("reject ok", rj2.status === 200, `${rj2.status}`);
  const kept = await q(`SELECT slot FROM bookings WHERE booking_no=$1`, [W]);
  check("slot kept after reject", new Date(kept.rows[0].slot).toISOString() === "2030-09-03T10:00:00.000Z", JSON.stringify(kept.rows[0]));
  const rj3 = await admin(`/api/admin/reschedule-requests/${rq2.body.id}/reject`, { method: "POST", body: JSON.stringify({}) });
  check("double-decide 409", rj3.status === 409, `${rj3.status}`);
}

console.log("== 11. cleanup scratch ==");
{
  const ids = await q(`SELECT id FROM users WHERE email IN ($1,$2,$3,$4)`, [`sim-${TS}-cus@example.com`, proEmail, `sim-${TS}-other@example.com`, `sim-${TS}-ref@example.com`]);
  const idList = ids.rows.map((r) => r.id);
  // reuse cleanup-users ordering inline
  const bids = await q(`SELECT id FROM bookings WHERE customer_id = ANY($1) OR worker_id = ANY($1)`, [idList]);
  const bl = bids.rows.map((r) => r.id);
  if (bl.length) {
    const pays = await q(`SELECT id FROM payments WHERE booking_id = ANY($1)`, [bl]);
    const pl = pays.rows.map((r) => r.id);
    if (pl.length) await q(`DELETE FROM refunds WHERE payment_id = ANY($1)`, [pl]);
    await q(`DELETE FROM reward_ledger WHERE ref_booking_id = ANY($1) OR user_id = ANY($2)`, [bl, idList]);
    await q(`DELETE FROM reviews WHERE booking_id = ANY($1)`, [bl]);
    await q(`DELETE FROM cash_collections WHERE booking_id = ANY($1)`, [bl]);
    await q(`DELETE FROM commission_ledger WHERE booking_id = ANY($1)`, [bl]);
    await q(`DELETE FROM payments WHERE booking_id = ANY($1)`, [bl]);
    await q(`DELETE FROM booking_events WHERE booking_id = ANY($1)`, [bl]);
    await q(`DELETE FROM reschedule_requests WHERE booking_id = ANY($1)`, [bl]);
    await q(`DELETE FROM booking_otps WHERE booking_id = ANY($1)`, [bl]);
    await q(`DELETE FROM assignments WHERE booking_id = ANY($1)`, [bl]);
    await q(`DELETE FROM bookings WHERE id = ANY($1)`, [bl]);
  }
  await q(`DELETE FROM settlements WHERE worker_user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM quote_proposals WHERE request_id IN (SELECT id FROM quote_requests WHERE customer_id = ANY($1))`, [idList]);
  await q(`DELETE FROM quote_requests WHERE customer_id = ANY($1)`, [idList]);
  await q(`DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ANY($1))`, [idList]);
  await q(`DELETE FROM support_tickets WHERE user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM notifications WHERE user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM addresses WHERE user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM referral_uses WHERE referee_user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM referral_codes WHERE owner_user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM verification_records WHERE worker_user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM worker_services WHERE worker_user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM worker_profiles WHERE user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM worker_invites WHERE user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM user_roles WHERE user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM user_permissions WHERE user_id = ANY($1)`, [idList]);
  await q(`DELETE FROM users WHERE id = ANY($1)`, [idList]);
  check("scratch removed", true);
  // residue: nothing private left behind
  const left = await q(
    `SELECT (SELECT COUNT(*)::int FROM bookings WHERE customer_id = ANY($1) OR worker_id = ANY($1)) AS b,
            (SELECT COUNT(*)::int FROM notifications WHERE user_id = ANY($1)) AS n,
            (SELECT COUNT(*)::int FROM reward_ledger WHERE user_id = ANY($1)) AS r,
            (SELECT COUNT(*)::int FROM addresses WHERE user_id = ANY($1)) AS a`,
    [idList]);
  const L = left.rows[0];
  check("no residue", L.b === 0 && L.n === 0 && L.r === 0 && L.a === 0, JSON.stringify(L));
}

await pool.end();
console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failures.length) { console.log("FAILURES:\n- " + failures.join("\n- ")); process.exit(1); }
