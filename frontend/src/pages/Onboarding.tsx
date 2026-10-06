import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, MapPin, User } from "lucide-react";
import { Button, Card, Field, PageHero, Select, TextField } from "../components/ui";
import { MapPicker } from "../components/MapPicker";
import { PushToggle } from "../components/PushToggle";
import { api, post } from "../lib/api";
import { homeFor, useAuth } from "../lib/auth";
import type { Pin } from "../lib/geo";

const STEPS = ["Account", "Location", "Done"];

/** First-run setup in three quick steps: who you are, where you live,
 *  then alerts + rewards + go. Skippable, resumable, once. */
export default function Onboarding() {
  const { user, role, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Profile step
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // Location step
  const [label, setLabel] = useState("Home");
  const [line, setLine] = useState("");
  const [ward, setWard] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [pin, setPin] = useState<Pin | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  // Rewards step
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.onboarded) navigate(homeFor(role ?? "customer"), { replace: true });
  }, [user, role, navigate]);

  useEffect(() => {
    if (user) {
      setName((n) => n || user.name);
      if (user.phone) {
        const savedPhone = user.phone;
        setPhone((p) => p || savedPhone);
      }
    }
    api<{ code: string }>("/api/referrals/mine").then((d) => setCode(d.code)).catch(() => {});
  }, [user]);

  async function saveProfile(next: boolean) {
    setError("");
    if (name.trim().length < 2) {
      setError("Tell us your name so pros know who to ask for.");
      return;
    }
    if (phone.trim().length < 10) {
      setError("Add a reachable phone number — pros call this on the day.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ name: name.trim(), phone: phone.trim() }) });
      await refresh();
      if (next) setStep((s) => s + 1);
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAddress() {
    setError("");
    if (line.trim().length < 5) {
      setError("Enter ward, street and house (e.g. Damak-5, Himal Chowk).");
      return;
    }
    if (addrPhone.trim().length < 10) {
      setError("Enter a valid phone number for this address.");
      return;
    }
    setBusy(true);
    try {
      await post("/api/addresses", {
        label, line: line.trim(), city: "Damak",
        ward: ward ? Number(ward) : null,
        phone: addrPhone.trim(),
        lat: pin?.lat ?? null, lng: pin?.lng ?? null,
      });
      setStep((s) => s + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save address.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      await api("/api/auth/me/onboarding", { method: "PATCH", body: JSON.stringify({ done: true }) });
      await refresh();
      navigate(homeFor(role ?? "customer"), { replace: true });
    } catch {
      setError("Couldn't finish — try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fade-up">
      <PageHero eyebrow={`Getting started · step ${step + 1} of ${STEPS.length}`} title={step === 0 ? "Welcome to Sajilo Damak" : STEPS[step]} body="Two minutes now saves confusion on every booking later." />
      <div className="wrap py-8">
        <ol className="mb-6 flex gap-1.5" aria-label="Setup progress">
          {STEPS.map((label, i) => (
            <li key={label} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-surface-container-high"}`} aria-current={i === step ? "step" : undefined} />
          ))}
        </ol>

        <Card className="mx-auto max-w-2xl p-6 md:p-8">
          {step === 0 && (
            <div>
              <h2 className="font-display text-2xl font-semibold">Ramro Sewa, Sajilo Jeevan.</h2>
              <div className="mt-4 space-y-2.5">
                {[
                  ["Book in Damak", "Fixed-price services or quote requests — wards 1–10 only."],
                  ["A verified pro arrives", "Invite-only pros, tracked live in the app."],
                  ["Close with your code", "A one-time code reaches only you. No code, no completion."],
                ].map(([t, b], i) => (
                  <div key={t} className="flex gap-3 rounded-lg bg-surface-container/60 p-3">
                    <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-pine-950 text-sm font-extrabold text-marigold-300">{i + 1}</span>
                    <p className="text-sm"><strong>{t}.</strong> <span className="text-on-surface-variant">{b}</span></p>
                  </div>
                ))}
              </div>
              <h3 className="mt-5 flex items-center gap-2 font-display text-lg font-semibold"><User size={19} aria-hidden="true" /> Who are you?</h3>
              <p className="mt-0.5 text-sm text-on-surface-variant">Pros see this name and number on job day.</p>
              <div className="mt-3 space-y-4">
                <Field label="Full name">
                  <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gita Sharma" autoComplete="name" />
                </Field>
                <Field label="Phone">
                  <TextField value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="9852600000" autoComplete="tel" />
                </Field>
                {error && <p role="alert" className="text-sm font-medium text-error">{error}</p>}
                <Button className="w-full py-3" onClick={() => saveProfile(true)} disabled={busy}>
                  {busy ? "Saving…" : <>Save & continue <ArrowRight size={15} aria-hidden="true" /></>}
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold"><MapPin size={22} aria-hidden="true" /> Where do we come?</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Save your Damak address once — every booking reuses it. Drop a pin so pros find you faster.</p>
              <div className="mt-4 space-y-4">
                <Field label="Label">
                  <Select value={label} onChange={(e) => setLabel(e.target.value)}>
                    <option>Home</option><option>Shop</option><option>Office</option>
                  </Select>
                </Field>
                <Field label="Ward, street & house">
                  <TextField value={line} onChange={(e) => setLine(e.target.value)} placeholder="Damak-5, Himal Chowk, House 12" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Ward (optional)">
                    <TextField value={ward} onChange={(e) => setWard(e.target.value)} type="number" min={1} max={10} placeholder="5" />
                  </Field>
                  <Field label="Phone for this address">
                    <TextField value={addrPhone} onChange={(e) => setAddrPhone(e.target.value)} inputMode="tel" placeholder="9852600000" />
                  </Field>
                </div>
                <div>
                  <Button type="button" variant="outline" onClick={() => setMapOpen(true)}>
                    <MapPin size={15} aria-hidden="true" /> {pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "Pin on map (recommended)"}
                  </Button>
                </div>
                {error && <p role="alert" className="text-sm font-medium text-error">{error}</p>}
                <div className="flex justify-between gap-3">
                  <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft size={15} aria-hidden="true" /> Back</Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStep(2)}>Skip for now</Button>
                    <Button onClick={saveAddress} disabled={busy}>{busy ? "Saving…" : "Save address"}</Button>
                  </div>
                </div>
              </div>
              {mapOpen && (
                <MapPicker initial={pin} onClose={() => setMapOpen(false)}
                  onConfirm={(p) => { setPin(p); setMapOpen(false); }} />
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-2xl font-semibold">You're set.</h2>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                Job updates and completion codes arrive as notifications — turn on push to get them
                with the app closed. Every completed job also earns loyalty points (100 pts = Rs 50 off).
              </p>
              <div className="mt-4 rounded-lg bg-surface-container/60 p-4"><PushToggle /></div>
              {code && (
                <>
                  <button onClick={() => {
                    try { void navigator.clipboard.writeText(code); } catch { /* ignore */ }
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  }}
                    className="mt-3 w-full rounded-md border-2 border-dashed border-primary/50 bg-primary-container/50 px-4 py-3 font-mono text-lg font-extrabold tracking-widest transition active:scale-[0.99]"
                    aria-label="Copy your referral code">
                    {code}
                  </button>
                  <p aria-live="polite" className="mt-1.5 text-center text-sm font-bold text-success">
                    {copied ? "Copied! Share it — you both earn on their first job." : "Your referral code — share it, you both earn on their first job."}
                  </p>
                </>
              )}
              {error && <p role="alert" className="mt-3 text-sm font-medium text-error">{error}</p>}
              <div className="mt-6 flex justify-between gap-3">
                <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft size={15} aria-hidden="true" /> Back</Button>
                <Button onClick={finish} disabled={busy}>
                  {busy ? "Finishing…" : "Start booking"} <Check size={15} aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        <p className="mt-4 text-center text-sm text-on-surface-variant">
          <Link to={homeFor(role ?? "customer")} className="font-bold text-primary hover:underline">Skip setup — take me to my dashboard</Link>
        </p>
      </div>
    </div>
  );
}
