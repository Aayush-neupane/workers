import { pool, query } from "./src/db/pool.js";

// Args: emails to remove with all their marketplace data.
const emails = process.argv.slice(2);
if (emails.length === 0) {
  console.log("usage: tsx cleanup-users.ts <email...>");
  await pool.end();
  process.exit(0);
}
const users = await query<{ id: string }>(
  `SELECT id FROM users WHERE email = ANY($1)`, [emails]);
const ids = users.rows.map((r) => r.id);
if (ids.length === 0) {
  console.log("no matching users");
  await pool.end();
  process.exit(0);
}
const bookings = await query<{ id: string }>(
  `SELECT id FROM bookings WHERE customer_id = ANY($1)`, [ids]);
const bids = bookings.rows.map((r) => r.id);
if (bids.length > 0) {
  await query(`DELETE FROM reward_ledger WHERE ref_booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM reviews WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM cash_collections WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM commission_ledger WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM payments WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM booking_events WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM assignments WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM booking_otps WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM bookings WHERE id = ANY($1)`, [bids]);
}
await query(`DELETE FROM reward_ledger WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM referral_uses WHERE referee_user_id = ANY($1)`, [ids]);
await query(
  `DELETE FROM quote_proposals WHERE request_id IN (SELECT id FROM quote_requests WHERE customer_id = ANY($1))`, [ids]);
await query(`DELETE FROM quote_requests WHERE customer_id = ANY($1)`, [ids]);
await query(
  `DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ANY($1))`, [ids]);
await query(`DELETE FROM support_tickets WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM notifications WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM consent_records WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM addresses WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM referral_codes WHERE owner_user_id = ANY($1)`, [ids]);
await query(`DELETE FROM user_roles WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
console.log(`removed: ${emails.join(", ")}`);
await pool.end();
