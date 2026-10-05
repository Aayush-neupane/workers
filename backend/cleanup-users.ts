import { pool, query } from "./src/db/pool.js";

// Removes accounts with all their marketplace data. Local/dev tool only:
// refuses production, refuses staff accounts unless --include-staff, needs
// --yes to actually delete (otherwise dry-run), and runs in one transaction.
// Usage: tsx cleanup-users.ts [--yes] [--include-staff] <email...>
const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const includeStaff = args.includes("--include-staff");
const emails = args.filter((a) => !a.startsWith("--"));
if (emails.length === 0) {
  console.log("usage: tsx cleanup-users.ts [--yes] [--include-staff] <email...>");
  await pool.end();
  process.exit(0);
}
if (process.env.NODE_ENV === "production") {
  console.log("refusing to delete users in production");
  await pool.end();
  process.exit(1);
}
const users = await query<{ id: string; email: string }>(
  `SELECT u.id, u.email FROM users u WHERE u.email = ANY($1)`, [emails]);
if (users.rowCount === 0) {
  console.log("no matching users");
  await pool.end();
  process.exit(0);
}
if (!includeStaff) {
  const staff = await query(
    `SELECT u.email FROM users u JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id AND r.name IN ('ADMIN', 'SUB_ADMIN')
     WHERE u.id = ANY($1)`, [users.rows.map((r) => r.id)]);
  if ((staff.rowCount ?? 0) > 0) {
    console.log(`refusing staff accounts (pass --include-staff to override): ${staff.rows.map((r) => (r as { email: string }).email).join(", ")}`);
    await pool.end();
    process.exit(1);
  }
}
const ids = users.rows.map((r) => r.id);
const preview = await query<{ bookings: number; payments: number }>(
  `SELECT (SELECT COUNT(*)::int FROM bookings WHERE customer_id = ANY($1) OR worker_id = ANY($1)) AS bookings,
          (SELECT COUNT(*)::int FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id = ANY($1) OR worker_id = ANY($1))) AS payments`,
  [ids]);
console.log(`will remove ${ids.length} user(s), ${preview.rows[0].bookings} booking(s), ${preview.rows[0].payments} payment(s): ${emails.join(", ")}`);
if (!confirmed) {
  console.log("dry run — pass --yes to delete");
  await pool.end();
  process.exit(0);
}
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const bids = (await client.query<{ id: string }>(
    `SELECT id FROM bookings WHERE customer_id = ANY($1) OR worker_id = ANY($1)`, [ids],
  )).rows.map((r) => r.id);
  if (bids.length > 0) {
    const pays = (await client.query<{ id: string }>(
      `SELECT id FROM payments WHERE booking_id = ANY($1)`, [bids],
    )).rows.map((r) => r.id);
    if (pays.length > 0) {
      await client.query(`DELETE FROM refunds WHERE payment_id = ANY($1)`, [pays]);
    }
    await client.query(`DELETE FROM reward_ledger WHERE ref_booking_id = ANY($1)`, [bids]);
    await client.query(`DELETE FROM reviews WHERE booking_id = ANY($1)`, [bids]);
    await client.query(`DELETE FROM cash_collections WHERE booking_id = ANY($1)`, [bids]);
    await client.query(`DELETE FROM commission_ledger WHERE booking_id = ANY($1)`, [bids]);
    await client.query(`DELETE FROM payments WHERE booking_id = ANY($1)`, [bids]);
    await client.query(`DELETE FROM booking_events WHERE booking_id = ANY($1)`, [bids]);
    await client.query(`DELETE FROM booking_otps WHERE booking_id = ANY($1)`, [bids]);
    await client.query(`DELETE FROM assignments WHERE booking_id = ANY($1)`, [bids]);
    await client.query(`DELETE FROM bookings WHERE id = ANY($1)`, [bids]);
  }
  await client.query(`DELETE FROM settlements WHERE worker_user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM push_subscriptions WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM reward_ledger WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM referral_uses WHERE referee_user_id = ANY($1)`, [ids]);
  await client.query(
    `DELETE FROM quote_proposals WHERE request_id IN (SELECT id FROM quote_requests WHERE customer_id = ANY($1))`, [ids]);
  await client.query(`DELETE FROM quote_requests WHERE customer_id = ANY($1)`, [ids]);
  await client.query(
    `DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ANY($1))`, [ids]);
  await client.query(`DELETE FROM support_tickets WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM notifications WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM consent_records WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM addresses WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM referral_codes WHERE owner_user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM verification_documents WHERE worker_user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM verification_records WHERE worker_user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM worker_availability WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM worker_services WHERE worker_user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM worker_profiles WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM user_permissions WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM user_roles WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
}
console.log(`removed: ${emails.join(", ")}`);
await pool.end();
