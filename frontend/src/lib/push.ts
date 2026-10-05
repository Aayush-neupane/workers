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

/** Current device state (browser subscription AND server record must agree). */
export async function pushStatus(audience?: string): Promise<PushState> {
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
    if (!sub) return "off";
    // Self-heal: a browser subscription the server forgot (DB reset, reseed)
    // looks "on" but receives nothing. Detect and clean it.
    const { devices } = await api<{ devices: { audience: string }[] }>("/api/push/devices");
    const mine = audience ? devices.filter((d) => d.audience === audience) : devices;
    if (mine.length === 0) {
      try {
        await sub.unsubscribe();
      } catch {
        /* ignore */
      }
      return "off";
    }
    return "on";
  } catch {
    return "off";
  }
}

export async function enablePush(role: Role): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") {
    const perm = await Notification.requestPermission();
    if (perm === "default") throw new Error("dismissed");
    if (perm !== "granted") return "denied";
  }
  const { key } = await api<{ key: string }>("/api/push/vapid-key");
  const reg = await registration();
  let sub: PushSubscription;
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(key),
    });
  } catch {
    throw new Error("service-unreachable");
  }
  const json = sub.toJSON();
  try {
    await post("/api/push/subscribe", {
      endpoint: sub.endpoint,
      p256dh: b64url(json.keys?.p256dh),
      auth: b64url(json.keys?.auth),
      audience: audienceFor(role),
    });
  } catch (e) {
    // Don't strand a browser subscription the server never recorded.
    try {
      await sub.unsubscribe();
    } catch {
      /* ignore */
    }
    const name = e instanceof Error ? e.name : "Error";
    const serverMsg = e instanceof Error ? e.message : String(e);
    throw new Error(`Push failed (${name}): ${serverMsg}`);
  }
  try {
    localStorage.setItem("sajilo-push-endpoint", sub.endpoint);
  } catch {
    /* ignore */
  }
  return "on";
}

export async function disablePush(): Promise<PushState> {
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
  if (sub) await sub.unsubscribe();
  // Throw unless the server record is actually gone, so the UI can offer retry.
  if (endpoint) await post("/api/push/unsubscribe", { endpoint });
  try {
    localStorage.removeItem("sajilo-push-endpoint");
  } catch {
    /* ignore */
  }
  return Notification.permission === "denied" ? "denied" : "off";
}

export async function sendTestPing(): Promise<number> {
  const out = await post<{ sent: number }>("/api/push/test", {});
  return out.sent;
}
