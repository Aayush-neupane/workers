import { query } from "../db/pool.js";

/** Single send point for in-app notifications (SMS/push attach here later). */
export async function notify(
  client: { query: (t: string, p?: unknown[]) => Promise<unknown> },
  userId: string,
  title: string,
  body: string,
) {
  await client.query(`INSERT INTO notifications(user_id, title, body) VALUES ($1, $2, $3)`, [
    userId,
    title,
    body,
  ]);
}

export async function audit(actorId: string | null, actorRole: string, action: string, detail: string) {
  await query(
    `INSERT INTO audit_log(actor_id, actor_role, action, detail) VALUES ($1, $2, $3, $4)`,
    [actorId, actorRole, action, detail],
  );
}
