export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  detail: string;
}

const KEY = "wk-audit";

export function loadAudit(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function logAudit(action: string, detail: string, actor = "admin"): AuditEntry[] {
  const next = [
    { at: new Date().toISOString(), actor, action, detail },
    ...loadAudit(),
  ].slice(0, 200);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
}
