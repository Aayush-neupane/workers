const BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4001" : (()=>{throw new Error("VITE_API_URL missing")})());

let unauthorizedHook: (() => void) | null = null;
export function onUnauthorized(fn: (() => void) | null) {
  unauthorizedHook = fn;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // Content-Type is ALWAYS sent, even on bodyless DELETEs: the API rejects
  // non-JSON mutations as a CSRF layer, and a missing header would 415.
  // (The extra CORS preflight this triggers is harmless.)
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (res.status === 401) {
    unauthorizedHook?.();
    throw new Error("Sign in required");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(body.error ? body.error + " (#"+res.status+")" : "Request failed (#"+res.status+")");
  return body as T;
}

export async function post<T>(path: string, data: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: JSON.stringify(data) });
}
