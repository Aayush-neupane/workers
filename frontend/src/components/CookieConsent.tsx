import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { Button } from "./ui";
import { loadConsent, saveConsent, POLICY_VERSION, CONSENT_VERSION, type Consent } from "../lib/consent";
import { post } from "../lib/api";

/** Real consent manager: banner → customize → per-category gates.
 *  Optional tracking never initializes without a recorded opt-in. */
export function CookieConsent() {
  const [current, setCurrent] = useState<Consent | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [prefs, setPrefs] = useState({ preferences: false, analytics: false, marketing: false });

  useEffect(() => {
    setCurrent(loadConsent());
    const onChange = (e: Event) => setCurrent((e as CustomEvent<Consent>).detail);
    const onOpen = () => {
      const c = loadConsent();
      setPrefs({
        preferences: c?.preferences ?? false,
        analytics: c?.analytics ?? false,
        marketing: c?.marketing ?? false,
      });
      setCustomizing(true);
    };
    window.addEventListener("sajilo-consent", onChange);
    window.addEventListener("sajilo-open-cookie-preferences", onOpen);
    return () => {
      window.removeEventListener("sajilo-consent", onChange);
      window.removeEventListener("sajilo-open-cookie-preferences", onOpen);
    };
  }, []);

  async function persist(c: Consent) {
    setCurrent(c);
    setCustomizing(false);
    // Best-effort server record for signed-in users; banner never depends on it.
    try {
      await post("/api/consent", {
        preferences: c.preferences,
        analytics: c.analytics,
        marketing: c.marketing,
        policyVersion: c.policyVersion,
      });
    } catch {
      /* signed out — local record is enough */
    }
  }

  function acceptAll() {
    void persist(saveConsent({
      preferences: true, analytics: true, marketing: true,
      policyVersion: POLICY_VERSION, consentVersion: CONSENT_VERSION,
    }));
  }

  function rejectOptional() {
    void persist(saveConsent({
      preferences: false, analytics: false, marketing: false,
      policyVersion: POLICY_VERSION, consentVersion: CONSENT_VERSION,
    }));
  }

  function saveCustom() {
    void persist(saveConsent({
      ...prefs, policyVersion: POLICY_VERSION, consentVersion: CONSENT_VERSION,
    }));
  }

  return (
    <>
      {/* Reopen entry: footer links here via hash */}
      <button
        id="cookie-preferences"
        onClick={() => { setPrefs({
          preferences: current?.preferences ?? false,
          analytics: current?.analytics ?? false,
          marketing: current?.marketing ?? false,
        }); setCustomizing(true); }}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
      {!current && !customizing && (
        <div role="dialog" aria-label="Cookie consent" aria-live="polite"
          className="elev-2 fixed inset-x-3 bottom-3 z-50 rounded-lg border border-outline bg-white p-5 md:inset-x-auto md:right-6 md:bottom-6 md:max-w-md">
          <p className="flex items-center gap-2 font-bold"><Cookie size={18} aria-hidden="true" /> Cookies, your call</p>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Sign-in and security cookies are strictly necessary. Everything else — preferences,
            analytics, marketing — runs only with your permission.{" "}
            <Link to="/cookies" className="font-bold text-primary hover:underline">Cookie Policy</Link>
            {" · "}
            <Link to="/privacy" className="font-bold text-primary hover:underline">Privacy Policy</Link>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={acceptAll}>Accept all</Button>
            <Button variant="outline" onClick={rejectOptional}>Reject optional</Button>
            <Button variant="ghost" onClick={() => setCustomizing(true)}>Customize</Button>
          </div>
        </div>
      )}
      {customizing && (
        <div role="dialog" aria-label="Cookie preferences" aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-pine-950/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <div className="flex items-center justify-between">
              <p className="font-bold">Cookie preferences</p>
              <button onClick={() => setCustomizing(false)} aria-label="Close preferences"><X size={20} /></button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-md bg-surface-container p-3">
                <p className="font-bold">Strictly necessary — always on</p>
                <p className="text-on-surface-variant">Sign-in session, CSRF protection, consent record. The service cannot work without these.</p>
              </div>
              {([
                ["preferences", "Preferences", "Language and display choices."],
                ["analytics", "Analytics", "Anonymous usage measurement to improve booking flows."],
                ["marketing", "Marketing", "Campaign attribution. Off means no marketing cookies at all."],
              ] as const).map(([key, label, desc]) => (
                <label key={key} className="flex cursor-pointer items-start gap-3 rounded-md border border-outline p-3">
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                    className="mt-0.5 size-4 accent-[#0f6b44]"
                  />
                  <span>
                    <span className="font-bold">{label}</span>
                    <span className="block text-xs text-on-surface-variant">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={acceptAll}>Accept all</Button>
              <Button variant="outline" onClick={rejectOptional}>Reject all</Button>
              <Button variant="ghost" onClick={saveCustom}>Save choices</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
