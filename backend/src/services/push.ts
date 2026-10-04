import webpush from "web-push";
import { env } from "../config/env.js";
import { query } from "../db/pool.js";

export const pushEnabled =
  Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Best-effort push to one user. Never throws into business logic —
 * in-app notifications are the guaranteed channel; push is the fast one.
 * Gone (410/404) endpoints are pruned so the table stays healthy.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  try {
    if (!pushEnabled) return 0;
    const subs = await query<{ endpoint: string; p256dh: string; auth: string }>(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, [userId]);
    let sent = 0;
    await Promise.allSettled(subs.rows.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...payload, url: payload.url ?? "/dashboard" }),
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [s.endpoint]);
        }
      }
    }));
    return sent;
  } catch {
    return 0; // push must never break business logic
  }
}

/** Push to every active user of a role audience (admin broadcasts). */
export async function pushToAudience(
  audience: "CUSTOMER" | "WORKER" | "ADMIN" | "ALL",
  payload: PushPayload,
): Promise<number> {
  try {
    if (!pushEnabled) return 0;
  const users = await query<{ id: string }>(
    audience === "ALL"
      ? `SELECT id FROM users WHERE is_active = true`
      : `SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id WHERE r.name = $1 AND u.is_active = true`,
    audience === "ALL" ? [] : [audience]);
  let sent = 0;
  for (const u of users.rows) {
    sent += await pushToUser(u.id, payload);
  }
  return sent;
  } catch {
    return 0;
  }
}
