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
  const tr0 = await admin(`/api/bookings/${BK}/transition`, { method: "POST", body: JSON.stringify({ to: "awaiting-worker", note: "sim" }) });
  check("pending->awaiting-worker (admin)", tr0.status === 200, `${tr0.status} ${JSON.stringify(tr0.body)}`);
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

console.log("== 10. cleanup scratch ==");
{
  const ids = await q(`SELECT id FROM users WHERE email IN ($1,$2,$3)`, [`sim-${TS}-cus@example.com`, proEmail, `sim-${TS}-other@example.com`]);
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
}

await pool.end();
console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failures.length) { console.log("FAILURES:\n- " + failures.join("\n- ")); process.exit(1); }
