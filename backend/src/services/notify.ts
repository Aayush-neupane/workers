import { query } from "../db/pool.js";

/** Best-effort in-app notification: never throws into request handlers. */
export async function notify(userId: string, title: string, body: string): Promise<void> {
  try {
    await query(`INSERT INTO notifications(user_id, title, body) VALUES ($1, $2, $3)`, [
      userId,
      title,
      body,
    ]);
  } catch (e) {
    console.error("[notify] insert failed", e instanceof Error ? e.message : e);
  }
}

/** Notify every active admin. Never throws. */
export function notifyAdmins(title: string, body: string): void {
  void (async () => {
    try {
      await query(
        `INSERT INTO notifications(user_id, title, body)
         SELECT u.id, $1, $2 FROM users u
         JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'ADMIN' AND u.is_active = true`,
        [title, body],
      );
    } catch (e) {
      console.error("[notify] admins failed", e instanceof Error ? e.message : e);
    }
  })();
}

export function fireAndForget(p: Promise<unknown>): void {
  p.catch((e) => console.error("[notify] background failed", e instanceof Error ? e.message : e));
}
