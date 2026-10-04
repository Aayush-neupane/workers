const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4001";

let unauthorizedHook: (() => void) | null = null;
export function onUnauthorized(fn: (() => void) | null) {
  unauthorizedHook = fn;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 401) {
    unauthorizedHook?.();
    throw new Error("Sign in required");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

export async function post<T>(path: string, data: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: JSON.stringify(data) });
}
