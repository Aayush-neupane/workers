import { api, post } from "./api";
import type { Role } from "./types";

/** Web-push client: opt-in only, per-role audience, same-origin navigation. */

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export type PushState = "on" | "off" | "denied" | "unsupported" | "unconfigured";

function audienceFor(role: Role): "customer" | "worker" | "admin" {
  if (role === "worker") return "worker";
  if (role === "admin") return "admin";
  return "customer";
}

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function b64url(input: string | undefined): string {
  return input ?? "";
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

/** Current device state (checks the live subscription, not just storage). */
export async function pushStatus(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    await api<{ key: string }>("/api/push/vapid-key");
  } catch {
    return "unconfigured";
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function enablePush(role: Role): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const { key } = await api<{ key: string }>("/api/push/vapid-key");
  const reg = await registration();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyToBytes(key),
  });
  const json = sub.toJSON();
  await post("/api/push/subscribe", {
    endpoint: sub.endpoint,
    p256dh: b64url(json.keys?.p256dh),
    auth: b64url(json.keys?.auth),
    audience: audienceFor(role),
  });
  try {
    localStorage.setItem("sajilo-push-endpoint", sub.endpoint);
  } catch {
    /* ignore */
  }
  return "on";
}

export async function disablePush(): Promise<PushState> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    const endpoint =
      sub?.endpoint ?? (() => {
        try {
          return localStorage.getItem("sajilo-push-endpoint") ?? "";
        } catch {
          return "";
        }
      })();
    await sub?.unsubscribe();
    if (endpoint) await post("/api/push/unsubscribe", { endpoint });
    try {
      localStorage.removeItem("sajilo-push-endpoint");
    } catch {
      /* ignore */
    }
  } catch {
    /* already gone */
  }
  return Notification.permission === "denied" ? "denied" : "off";
}

export async function sendTestPing(): Promise<number> {
  const out = await post<{ sent: number }>("/api/push/test", {});
  return out.sent;
}
