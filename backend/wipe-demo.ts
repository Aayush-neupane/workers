import { pool, query } from "./src/db/pool.js";

/**
 * Local-only demo wipe. Scoped strictly to @demo.local accounts, runs in a
 * single transaction, deletes dependents (refunds/settlements/push/referrals)
 * before parents so RESTRICT constraints can't strand a half-wipe.
 * NEVER run against production — there is no undo.
 */
if (process.env.NODE_ENV === "production") {
  console.log("refusing to wipe demo data in production");
  await pool.end();
  process.exit(1);
}

const ids = (await query<{ id: string }>(
  `SELECT id FROM users WHERE email ILIKE '%@demo.local'`,
)).rows.map((r) => r.id);
if (ids.length === 0) {
  console.log("no demo users");
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
    await client.query(`DELETE FROM reward_ledger WHERE ref_booking_id = ANY($1) OR user_id = ANY($2)`, [bids, ids]);
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
  await client.query(`DELETE FROM referral_uses WHERE referee_user_id = ANY($1)`, [ids]);
  await client.query(
    `DELETE FROM referral_codes WHERE owner_user_id = ANY($1)
     AND NOT EXISTS (SELECT 1 FROM referral_uses WHERE referral_uses.code = referral_codes.code)`, [ids]);
  await client.query(`DELETE FROM quote_proposals WHERE request_id IN (SELECT id FROM quote_requests WHERE customer_id = ANY($1))`, [ids]);
  await client.query(`DELETE FROM quote_requests WHERE customer_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ANY($1))`, [ids]);
  await client.query(`DELETE FROM support_tickets WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM notifications WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM consent_records WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM addresses WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM verification_documents WHERE worker_user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM verification_records WHERE worker_user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM worker_availability WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM worker_services WHERE worker_user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM worker_profiles WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM worker_invites WHERE email ILIKE '%@demo.local'`);
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
console.log(`demo wiped (${ids.length} users)`);
await pool.end();
