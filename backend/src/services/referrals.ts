import type { PoolClient, QueryResultRow } from "pg";
import { referralCodeFor, normalizeReferral } from "../utils/referral.js";

type Run = Pick<PoolClient, "query">;

/** Every user owns exactly one code — create on demand. */
export async function ensureReferralCode(run: Run, userId: string, name: string): Promise<string> {
  const existing = await run.query(`SELECT code FROM referral_codes WHERE owner_user_id = $1`, [userId]);
  if ((existing.rowCount ?? 0) > 0) return (existing.rows[0] as QueryResultRow).code as string;
  for (let i = 0; i < 5; i++) {
    const code = referralCodeFor(name);
    try {
      await run.query(`INSERT INTO referral_codes(code, owner_user_id) VALUES ($1, $2)`, [code, userId]);
      return code;
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e;
    }
  }
  throw new Error("Could not mint referral code");
}

/** Validate a code at signup. Returns owner id or throws a 400-style error. */
export async function redeemReferralCode(
  run: Run, rawCode: string, refereeEmail: string, refereeId: string, refereePhone: string,
): Promise<void> {
  const code = normalizeReferral(rawCode);
  const owner = await run.query<{ owner_user_id: string; email: string; phone: string; max_uses: number }>(
    `SELECT rc.owner_user_id, u.email, u.phone, rc.max_uses
     FROM referral_codes rc JOIN users u ON u.id = rc.owner_user_id WHERE rc.code = $1`,
    [code],
  );
  if ((owner.rowCount ?? 0) === 0) throw Object.assign(new Error("Unknown referral code"), { status: 400 });
  if (owner.rows[0].email.toLowerCase() === refereeEmail.toLowerCase()) {
    throw Object.assign(new Error("You cannot refer yourself"), { status: 400 });
  }
  // Same human, second SIM/email: matching phone numbers don't earn twice.
  const norm = (p: string) => p.replace(/[\s\-.()]/g, "");
  if (norm(owner.rows[0].phone) && norm(owner.rows[0].phone) === norm(refereePhone)) {
    throw Object.assign(new Error("This referral code belongs to your own number"), { status: 400 });
  }
  const uses = await run.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM referral_uses WHERE code = $1`, [code]);
  if (uses.rows[0].n >= owner.rows[0].max_uses) {
    throw Object.assign(new Error("This referral code is maxed out"), { status: 400 });
  }
  const settings = await run.query<{ value: Record<string, number> }>(`SELECT value FROM settings WHERE id = 'platform'`);
  const bonus = settings.rows[0]?.value.referralBonus ?? 50;
  await run.query(`INSERT INTO referral_uses(code, referee_user_id, bonus_points) VALUES ($1, $2, $3)`, [code, refereeId, bonus]);
}

/**
 * After a customer's FIRST completed booking, pay the referral bonus to both
 * sides (amounts from platform settings, default 50 pts). Idempotent.
 * NOTE: all reads use the caller's transaction client — the completion itself
 * is uncommitted at this point, so pool reads would miss it.
 */
export async function maybeRewardReferral(client: Run, customerId: string): Promise<void> {
  // Lock the use-row first: two concurrent first-completions must not both
  // pay. The conditional UPDATE below pays exactly once (RETURNING check).
  const use = await client.query(
    `SELECT code, bonus_points FROM referral_uses WHERE referee_user_id = $1 AND rewarded = false FOR UPDATE`, [customerId]);
  if ((use.rowCount ?? 0) === 0) return;
  const done = await client.query(
    `SELECT COUNT(*)::int AS n FROM bookings WHERE customer_id = $1 AND status = 'completed'`, [customerId]);
  if ((done.rows[0] as { n: number }).n !== 1) return; // qualifying event = first completion only
  const claimed = await client.query(
    `UPDATE referral_uses SET rewarded = true WHERE referee_user_id = $1 AND rewarded = false RETURNING code, bonus_points`,
    [customerId]);
  if ((claimed.rowCount ?? 0) === 0) return; // lost the race — the other commit paid
  const { code, bonus_points: bonus } = claimed.rows[0] as { code: string; bonus_points: number };
  const owner = await client.query(
    `SELECT owner_user_id FROM referral_codes WHERE code = $1`, [code]);
  if ((owner.rowCount ?? 0) === 0) return;
  const ownerId = (owner.rows[0] as { owner_user_id: string }).owner_user_id;
  await client.query(
    `INSERT INTO reward_ledger(user_id, points, kind, reason) VALUES ($1, $2, 'bonus', 'Referral reward — friend''s first job')`,
    [customerId, bonus]);
  await client.query(
    `INSERT INTO reward_ledger(user_id, points, kind, reason) VALUES ($1, $2, 'bonus', 'Referral reward — invited friend''s first job')`,
    [ownerId, bonus]);
}
