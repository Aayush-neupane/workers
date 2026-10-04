import { pool, query } from "./src/db/pool.js";

const ids = (await query<{ id: string }>(`SELECT id FROM users WHERE email LIKE '%demo.local'`)).rows.map((r) => r.id);
if (ids.length === 0) {
  console.log("no demo users");
  await pool.end();
  process.exit(0);
}
const bids = (await query<{ id: string }>(
  `SELECT id FROM bookings WHERE customer_id = ANY($1)`, [ids],
)).rows.map((r) => r.id);
if (bids.length > 0) {
  await query(`DELETE FROM reward_ledger WHERE ref_booking_id = ANY($1) OR user_id = ANY($2)`, [bids, ids]);
  await query(`DELETE FROM reviews WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM cash_collections WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM commission_ledger WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM payments WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM booking_events WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM assignments WHERE booking_id = ANY($1)`, [bids]);
  await query(`DELETE FROM bookings WHERE id = ANY($1)`, [bids]);
}
await query(`DELETE FROM quote_proposals WHERE request_id IN (SELECT id FROM quote_requests WHERE customer_id = ANY($1))`, [ids]);
await query(`DELETE FROM quote_requests WHERE customer_id = ANY($1)`, [ids]);
await query(`DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ANY($1))`, [ids]);
await query(`DELETE FROM support_tickets WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM notifications WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM consent_records WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM addresses WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM verification_documents WHERE worker_user_id = ANY($1)`, [ids]);
await query(`DELETE FROM verification_records WHERE worker_user_id = ANY($1)`, [ids]);
await query(`DELETE FROM worker_availability WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM worker_services WHERE worker_user_id = ANY($1)`, [ids]);
await query(`DELETE FROM worker_profiles WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM worker_invites WHERE email LIKE '%demo.local'`);
await query(`DELETE FROM user_roles WHERE user_id = ANY($1)`, [ids]);
await query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
console.log("demo wiped");
await pool.end();
