/** Cookie consent state. Optional categories stay OFF until the user opts in,
 *  and no optional technology may initialize without checking these gates. */

export interface Consent {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  policyVersion: string;
  consentVersion: number;
  ts: string;
}

export const POLICY_VERSION = "v1";
export const CONSENT_VERSION = 1;
const KEY = "sajilo-consent-v1";

export function loadConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Consent;
    if (c.policyVersion !== POLICY_VERSION || c.consentVersion !== CONSENT_VERSION) return null;
    return { ...c, necessary: true };
  } catch {
    return null;
  }
}

export function saveConsent(c: Omit<Consent, "necessary" | "ts"> & { ts?: string }): Consent {
  const full: Consent = { necessary: true, ...c, ts: c.ts ?? new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(full));
  } catch {
    /* storage unavailable — consent still applies to this session */
  }
  window.dispatchEvent(new CustomEvent("sajilo-consent", { detail: full }));
  return full;
}

export function isAllowed(category: "preferences" | "analytics" | "marketing"): boolean {
  return loadConsent()?.[category] === true;
}

/** Optional technologies must call this before initializing. */
export function requireConsent(category: "preferences" | "analytics" | "marketing"): boolean {
  return isAllowed(category);
}
