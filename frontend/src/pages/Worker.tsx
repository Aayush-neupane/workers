import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ChevronDown, FileUp, Phone, Star } from "lucide-react";
import { Badge, Button, Card, DateTimeField, EmptyState, PageHero, Price, TextField } from "../components/ui";
import { LiveMap } from "../components/LiveMap";
import { fetchRoute, formatKm, type Pin } from "../lib/geo";
import { api, post } from "../lib/api";
import { formatDate, formatNPR, formatSlot, parseSlotInput } from "../lib/format";
import type { Booking } from "../lib/types";

interface Me {
  profile: { verification_state: string; is_active: boolean; bio: string; years_exp: number } | null;
  jobsDone: number;
  activeJobs: number;
  reviewCount: number;
  avgRating: number;
}

interface Earnings {
  ledger: { id: string; booking_no: string; total_paisa: string; commission_paisa: string; worker_paisa: string; is_settled: boolean }[];
  netPaisa: number;
  owedPaisa: number;
  settlements: { id: string; amount_paisa: number; kind: string; note: string; created_at: string }[];
}

interface OpenQuote {
  id: string;
  title: string;
  description: string;
  window_start: string;
  window_end: string;
  ward: number | null;
  proposal_count: number;
  category_name?: string;
}

interface Review {
  id: string;
  rating: number;
  text: string;
  booking_no: string;
  created_at: string;
}

interface Doc {
  id: string;
  kind: string;
  uploaded_at: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NEXT: Record<string, { to: string; label: string }> = {
  "awaiting-worker": { to: "confirmed", label: "Confirm job" },
  confirmed: { to: "en-route", label: "Mark en route" },
  "en-route": { to: "in-progress", label: "Start work" },
};

export default function Worker() {
  const [tab, setTab] = useState<"today" | "requests" | "quotes" | "earnings" | "reviews" | "availability" | "documents">("today");
  const [me, setMe] = useState<Me | null>(null);
  const [jobs, setJobs] = useState<(Booking & { customer_phone?: string; customer_name?: string })[]>([]);
  const [requests, setRequests] = useState<Booking[]>([]);
  const [quotes, setQuotes] = useState<OpenQuote[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [revMeta, setRevMeta] = useState({ count: 0, avg: 0 });
  const [days, setDays] = useState<{ dow: number; is_open: boolean }[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [msg, setMsg] = useState("");

  function reload() {
    api<Me>("/api/worker/me").then(setMe).catch(() => {});
    api<{ jobs: typeof jobs; requests: Booking[] }>("/api/worker/jobs")
      .then((d) => { setJobs(d.jobs); setRequests(d.requests); }).catch(() => {});
    api<Earnings>("/api/worker/earnings").then(setEarnings).catch(() => {});
    api<{ reviews: Review[]; count: number; avg: number }>("/api/worker/reviews")
      .then((d) => { setReviews(d.reviews); setRevMeta({ count: d.count, avg: d.avg }); }).catch(() => {});
    api<{ days: typeof days }>("/api/worker/availability").then((d) => {
      setDays(d.days.length === 7 ? d.days : DAYS.map((_, i) => ({ dow: i, is_open: true })));
    }).catch(() => setDays(DAYS.map((_, i) => ({ dow: i, is_open: true }))));
    api<{ requests: OpenQuote[] }>("/api/quotes/requests/open").then((d) => setQuotes(d.requests)).catch(() => {});
    api<{ documents: Doc[] }>("/api/worker/documents/mine").then((d) => setDocs(d.documents)).catch(() => {});
  }
  useEffect(reload, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  const today = new Date().toDateString();
  const todays = jobs.filter((j) => (j.slot ? new Date(j.slot).toDateString() === today : false));
  const upcoming = jobs.filter((j) => (j.slot ? new Date(j.slot).toDateString() !== today : true));

  return (
    <div className="fade-up">
      <PageHero eyebrow="Professional portal" title="Today's work" body="Assignments, availability and earnings — nothing else." />
      <div className="wrap py-8">
        {/* Header: verification + lifetime stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="p-4">
            <p className="text-[11px] font-extrabold tracking-widest text-on-surface-variant uppercase">Status</p>
            {me?.profile ? (
              <p className="mt-1">
                {me.profile.verification_state === "verified" && me.profile.is_active
                  ? <Badge tone="success"><BadgeCheck size={12} /> Verified · Active</Badge>
                  : <Badge tone="warning">{me.profile.verification_state}</Badge>}
              </p>
            ) : <p className="mt-1 text-sm text-on-surface-variant">Loading…</p>}
          </Card>
          <Card className="p-4"><p className="text-[11px] font-extrabold tracking-widest text-on-surface-variant uppercase">Today</p><p className="font-display mt-1 text-2xl font-semibold">{todays.length} job(s)</p></Card>
          <Card className="p-4"><p className="text-[11px] font-extrabold tracking-widest text-on-surface-variant uppercase">Open requests</p><p className="font-display mt-1 text-2xl font-semibold">{requests.length}</p></Card>
          <Card className="p-4"><p className="text-[11px] font-extrabold tracking-widest text-on-surface-variant uppercase">Net earnings</p><p className="font-display mt-1 text-2xl font-semibold">{earnings ? formatNPR(earnings.netPaisa) : "—"}</p></Card>
          <Card className="p-4"><p className="text-[11px] font-extrabold tracking-widest text-on-surface-variant uppercase">Rating</p>
            <p className="font-display mt-1 inline-flex items-center gap-1 text-2xl font-semibold">
              <Star size={20} className="fill-marigold-500 text-marigold-500" /> {revMeta.avg > 0 ? revMeta.avg.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-on-surface-variant">{revMeta.count} review(s) · {me?.jobsDone ?? 0} jobs done</p>
          </Card>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Pro sections">
          {(["today", "requests", "quotes", "earnings", "reviews", "availability", "documents"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-bold capitalize ${tab === t ? "bg-pine-950 text-white" : "bg-white border border-outline/60"}`}>
              {t}{t === "requests" && requests.length > 0 ? ` (${requests.length})` : ""}
            </button>
          ))}
        </div>
        {msg && <p role="status" className="mt-4 rounded-md bg-info-container p-3 text-sm font-medium text-info">{msg}</p>}

        {tab === "today" && (
          <div className="mt-4 space-y-3">
            {todays.length === 0 && <EmptyState title="No jobs today" body="Check requests for open assignments." />}
            {todays.map((j) => <JobCard key={j.id} job={j} onDone={reload} onMsg={setMsg} />)}
            {upcoming.length > 0 && (
              <>
                <h2 className="pt-4 font-display text-lg font-semibold">Upcoming</h2>
                {upcoming.map((j) => <JobCard key={j.id} job={j} onDone={reload} onMsg={setMsg} />)}
              </>
            )}
          </div>
        )}

        {tab === "requests" && (
          <div className="mt-4 space-y-3">
            {requests.length === 0 && <EmptyState title="No open requests" body="New Damak bookings matching your skills appear here." />}
            {requests.map((j) => (
              <Card key={j.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold">{j.service_name} · <span className="font-mono text-sm">{j.booking_no}</span></p>
                  <p className="text-sm text-on-surface-variant">{formatSlot(j.slot)} · {j.address_text}</p>
                  <p className="mt-1 text-sm">{j.instructions}</p>
                </div>
                <AcceptButton id={j.id} onDone={reload} onMsg={setMsg} />
              </Card>
            ))}
          </div>
        )}

        {tab === "quotes" && (
          <div className="mt-4 space-y-3">
            {quotes.length === 0 && <EmptyState title="No quote requests" body="Complex Damak jobs needing proposals appear here. Customer identity stays masked until acceptance." />}
            {quotes.map((q) => <QuotePropose key={q.id} quote={q} onDone={() => { setMsg("Proposal sent."); reload(); }} onError={setMsg} />)}
          </div>
        )}

        {tab === "earnings" && earnings && <EarningsView earnings={earnings} />}

        {tab === "reviews" && (
          <div className="mt-4 space-y-3">
            {reviews.length === 0 && <EmptyState title="No reviews yet" body="Customer feedback from completed jobs appears here." />}
            {reviews.map((r) => (
              <Card key={r.id} className="p-4">
                <p className="inline-flex items-center gap-1 text-sm font-bold">
                  <Star size={14} className="fill-marigold-500 text-marigold-500" /> {r.rating}/5 · <span className="font-mono font-normal">{r.booking_no}</span>
                </p>
                <p className="mt-1 text-sm">{r.text || "—"}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{formatDate(r.created_at)}</p>
              </Card>
            ))}
          </div>
        )}

        {tab === "availability" && (
          <DaysEditor days={days} setDays={setDays} onMsg={setMsg} />
        )}

        {tab === "documents" && (
          <DocsTab docs={docs} state={me?.profile?.verification_state ?? ""} />
        )}
      </div>
    </div>
  );
}

async function move(id: string, to: string, onDone: () => void, onMsg: (m: string) => void) {
  try {
    await post(`/api/bookings/${id}/transition`, { to });
    onDone();
  } catch (e) {
    onMsg(e instanceof Error ? e.message : "Action failed");
  }
}

function AcceptButton({ id, onDone, onMsg }: { id: string; onDone: () => void; onMsg: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={busy} onClick={async () => {
      setBusy(true);
      await move(id, "confirmed", onDone, onMsg);
      setBusy(false);
    }}>
      {busy ? "Accepting…" : "Accept job"}
    </Button>
  );
}

function JobCard({ job, onDone, onMsg }: {
  job: Booking & { customer_phone?: string; customer_name?: string };
  onDone: () => void; onMsg: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<Pin | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeInfo, setRouteInfo] = useState("");
  const [routing, setRouting] = useState(false);
  const [locMsg, setLocMsg] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const [reqSlot, setReqSlot] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqs, setReqs] = useState<{ id: string; status: string; proposed_slot: string }[]>([]);
  const next = NEXT[job.status];
  const pendingReq = reqs.find((r) => r.status === "pending");

  useEffect(() => {
    if (!open) return;
    api<{ requests: typeof reqs }>(`/api/bookings/${job.id}/reschedule-requests`)
      .then((d) => setReqs(d.requests)).catch(() => {});
  }, [open, job.id]);

  async function requestReschedule() {
    const iso = parseSlotInput(reqSlot);
    if (!iso) {
      onMsg("Use yyyy/mm/dd HH:MM.");
      return;
    }
    setReqBusy(true);
    try {
      await post(`/api/bookings/${job.id}/reschedule-requests`, {
        proposedSlot: iso, reason: reqReason.trim(),
      });
      onMsg("Request sent — the admin confirms the new time with the customer.");
      setReqOpen(false);
      setReqSlot("");
      setReqReason("");
      const d = await api<{ requests: typeof reqs }>(`/api/bookings/${job.id}/reschedule-requests`);
      setReqs(d.requests);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Request failed");
    } finally {
      setReqBusy(false);
    }
  }

  async function issue() {
    setBusy(true);
    try {
      await post(`/api/bookings/${job.id}/otp/issue`, {});
      onMsg("Code sent to the customer — ask them to read it out when the work is done.");
      onDone();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Could not issue code");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (code.length !== 6) return;
    setBusy(true);
    try {
      await post(`/api/bookings/${job.id}/otp/verify`, { code });
      onMsg("Code accepted — job completed, earnings updated.");
      onDone();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  // One position source per card: the Route tap itself is the gesture.
  async function ensurePosition(): Promise<Pin | null> {
    if (me) return me;
    setLocMsg("");
    if (!("geolocation" in navigator)) {
      setLocMsg("This device cannot share location — ride to the pin shown.");
      return null;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (g) => {
          const fix = { lat: g.coords.latitude, lng: g.coords.longitude };
          setMe(fix);
          resolve(fix);
        },
        (err) => {
          setLocMsg(
            err.code === err.PERMISSION_DENIED
              ? "Location denied — allow it once and tap Route again."
              : "No GPS fix — ride to the pin shown.",
          );
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    });
  }

  async function drawRoute() {
    if (job.lat == null || job.lng == null || routing) return;
    setRouting(true);
    setRouteInfo("");
    try {
      const origin = await ensurePosition();
      if (!origin) return;
      const r = await fetchRoute(origin, { lat: job.lat, lng: job.lng });
      setRoute(r.coords);
      setRouteInfo(`${formatKm(r.distanceKm)} · ~${Math.max(1, Math.round(r.durationMin))} min ride`);
    } catch {
      setRouteInfo("Routing unavailable — ride to the pin shown.");
      setRoute(null);
    } finally {
      setRouting(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
        <div>
          <p className="font-bold">{job.service_name} · <span className="font-mono text-sm font-normal">{job.booking_no}</span></p>
          <p className="text-sm text-on-surface-variant">{formatSlot(job.slot)} · {job.address_text}</p>
        </div>
        <span className="flex items-center gap-2">
          <Badge tone={job.status === "awaiting-confirmation" ? "warning" : "info"}>{job.status}</Badge>
          <ChevronDown size={18} className={`transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-outline/60 bg-surface-container/40 p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <p><strong>Customer:</strong> {job.customer_name ?? "—"}</p>
            <p><strong>Contact:</strong> {job.customer_phone ? (
              <a href={`tel:${job.customer_phone}`} className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
                <Phone size={14} aria-hidden="true" /> {job.customer_phone}
              </a>
            ) : "—"}</p>
            <p><strong>Payment:</strong> <span className="capitalize">{job.payment_method}</span> · {job.payment_status}</p>
            <p><strong>Estimate:</strong> {formatNPR(job.estimate_paisa)}</p>
          </div>
          <p className="rounded-md bg-white p-3"><strong>Instructions:</strong> {job.instructions || "—"}</p>
          {job.lat != null && job.lng != null && (
            <div className="space-y-2">
              <LiveMap
                stops={[{ id: job.id, label: job.booking_no, sub: job.address_text ?? "", pin: { lat: job.lat, lng: job.lng } }]}
                me={me}
                route={route}
                height={200}
              />
              {locMsg && <p role="alert" className="text-xs font-medium text-error">{locMsg}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {routeInfo && (
                  <span className="rounded-full bg-pine-950 px-3 py-1.5 font-mono text-[11px] font-bold text-white">{routeInfo}</span>
                )}
                <Button variant="outline" onClick={drawRoute} disabled={routing}>
                  {routing ? "Routing…" : route ? "Refresh route" : "Route →"}
                </Button>
                <a href={`https://www.openstreetmap.org/directions?to=${job.lat}%2C${job.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-sm font-bold text-primary hover:underline">
                  Get directions <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {next && <Button onClick={() => move(job.id, next.to, onDone, onMsg)}>{next.label}</Button>}
            {job.status === "in-progress" && <Button onClick={issue} disabled={busy}>Finish — send code to customer</Button>}
            {["pending", "awaiting-worker", "confirmed", "en-route", "in-progress"].includes(job.status) && (
              <Button variant="outline" onClick={() => setReqOpen((o) => !o)}>Request new time</Button>
            )}
          </div>
          {pendingReq && (
            <p role="status" className="rounded-md bg-warning-container p-3 text-xs font-medium">
              New time awaiting admin review: {formatSlot(pendingReq.proposed_slot)}.
            </p>
          )}
          {reqOpen && !pendingReq && (
            <div className="space-y-2 rounded-md border border-outline/60 bg-white p-3">
              <div>
                <label htmlFor={`req-slot-${job.id}`} className="mb-1.5 block text-xs font-bold">Proposed new time (at least an hour ahead)</label>
                <DateTimeField id={`req-slot-${job.id}`} value={reqSlot} onChange={setReqSlot} />
              </div>
              <TextField value={reqReason} onChange={(e) => setReqReason(e.target.value)}
                placeholder="Reason (sent to admin)" aria-label="Reason" maxLength={500} />
              <Button onClick={requestReschedule} disabled={reqBusy || !parseSlotInput(reqSlot)}>{reqBusy ? "Sending…" : "Send request"}</Button>
            </div>
          )}
          {job.status === "awaiting-confirmation" && (
            <div className="rounded-md border border-marigold-500/60 bg-white p-3">
              <p className="font-bold">Customer's completion code</p>
              <div className="mt-2 flex gap-2">
                <TextField value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code" inputMode="numeric" maxLength={6} aria-label="Completion code" />
                <Button onClick={verify} disabled={busy || code.length !== 6}>Verify & complete</Button>
              </div>
            </div>
          )}
          <Link to={`/track/${job.booking_no}`} className="inline-block text-sm font-bold text-primary hover:underline">Full booking thread</Link>
        </div>
      )}
    </Card>
  );
}

function EarningsView({ earnings }: { earnings: Earnings }) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs font-bold text-on-surface-variant uppercase">Net earnings</p><p className="font-display text-2xl font-semibold"><Price paisa={earnings.netPaisa} /></p></Card>
        <Card className="p-5"><p className="text-xs font-bold text-on-surface-variant uppercase">Commission owed</p><p className="font-display text-2xl font-semibold"><Price paisa={earnings.owedPaisa} /></p>
          <p className="text-xs text-on-surface-variant">Settled periodically by admin — never silently deducted.</p></Card>
        <Card className="p-5"><p className="text-xs font-bold text-on-surface-variant uppercase">Settlements</p><p className="font-display text-2xl font-semibold">{earnings.settlements.length}</p></Card>
      </div>
      <div className="overflow-x-auto rounded-lg border border-outline/60 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="text-left text-xs text-on-surface-variant">
            <th className="px-4 py-2.5">Booking</th><th className="px-4 py-2.5 text-right">Total</th>
            <th className="px-4 py-2.5 text-right">Commission</th><th className="px-4 py-2.5 text-right">You keep</th>
            <th className="px-4 py-2.5">Settled</th>
          </tr></thead>
          <tbody>
            {earnings.ledger.map((l) => (
              <tr key={l.id} className="border-t border-outline/60">
                <td className="px-4 py-2.5 font-mono text-xs">{l.booking_no}</td>
                <td className="px-4 py-2.5 text-right">{formatNPR(Number(l.total_paisa))}</td>
                <td className="px-4 py-2.5 text-right text-error">−{formatNPR(Number(l.commission_paisa))}</td>
                <td className="px-4 py-2.5 text-right font-bold">{formatNPR(Number(l.worker_paisa))}</td>
                <td className="px-4 py-2.5">{l.is_settled ? <Badge tone="success">Settled</Badge> : <Badge tone="warning">Pending</Badge>}</td>
              </tr>
            ))}
            {earnings.ledger.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">No earnings yet — accept a job to start.</td></tr>}
          </tbody>
        </table>
      </div>
      {earnings.settlements.length > 0 && (
        <Card className="p-4">
          <p className="font-bold">Settlement history</p>
          <ul className="mt-1 space-y-1 text-sm">
            {earnings.settlements.map((s) => (
              <li key={s.id}>{s.kind} {formatNPR(s.amount_paisa)} · {s.note} · {formatDate(s.created_at)}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function QuotePropose({ quote, onDone, onError }: { quote: OpenQuote; onDone: () => void; onError: (m: string) => void }) {
  const [price, setPrice] = useState("");
  const [scope, setScope] = useState("");
  const [avail, setAvail] = useState("");
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState("");

  const priceNum = Number(price);
  const priceError = price.trim() === "" ? "Enter a price." : Number.isNaN(priceNum) || priceNum <= 0 ? "Price must be greater than 0." : "";
  const scopeError = scope.trim().length > 0 && scope.trim().length < 10 ? "Describe the scope in at least 10 characters." : "";
  const availError = avail.trim().length > 0 && avail.trim().length < 4 ? "Add availability (at least 4 characters)." : "";
  const invalid = Boolean(priceError) || scope.trim().length < 10 || avail.trim().length < 4;

  async function send() {
    if (priceError) {
      setFormError(priceError);
      return;
    }
    if (scope.trim().length < 10) {
      setFormError("Describe the scope in at least 10 characters.");
      return;
    }
    if (avail.trim().length < 4) {
      setFormError("Add availability (at least 4 characters).");
      return;
    }
    setFormError("");
    try {
      const out = await post<{ needsApproval: boolean }>(`/api/quotes/requests/${quote.id}/proposals`, {
        pricePaisa: Math.round(Number(price) * 100), scope: scope.trim(), availability: avail.trim(),
      });
      onDone();
      if (out.needsApproval) onError("Proposal sent — needs admin approval (high value).");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Proposal failed");
    }
  }

  return (
    <Card className="p-4">
      <p className="font-bold">{quote.title} {quote.ward ? <Badge tone="info">Ward {quote.ward}</Badge> : null}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{quote.description}</p>
      <p className="mt-1 text-xs text-on-surface-variant">Window: {formatSlot(quote.window_start)} → {formatSlot(quote.window_end)} · {quote.proposal_count} proposals</p>
      {!open ? (
        <Button variant="outline" className="mt-3" onClick={() => setOpen(true)}>Propose a price</Button>
      ) : (
        <div className="mt-3 space-y-2">
          <TextField value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price in Rs" inputMode="decimal" aria-label="Price in rupees" />
          {priceError && <p role="alert" className="text-xs font-medium text-error">{priceError}</p>}
          <TextField value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Scope (min 10 chars)" aria-label="Scope" />
          {scopeError && <p role="alert" className="text-xs font-medium text-error">{scopeError}</p>}
          <TextField value={avail} onChange={(e) => setAvail(e.target.value)} placeholder="Availability, e.g. Tue–Thu mornings" aria-label="Availability" />
          {availError && <p role="alert" className="text-xs font-medium text-error">{availError}</p>}
          {formError && <p role="alert" className="text-xs font-medium text-error">{formError}</p>}
          <Button onClick={send} disabled={invalid}>Send proposal</Button>
        </div>
      )}
    </Card>
  );
}

function DaysEditor({ days, setDays, onMsg }: {
  days: { dow: number; is_open: boolean }[];
  setDays: (d: { dow: number; is_open: boolean }[]) => void;
  onMsg: (m: string) => void;
}) {
  async function save() {
    try {
      await api("/api/worker/availability", {
        method: "PUT",
        body: JSON.stringify({ days: days.map((d) => ({ dow: d.dow, open: d.is_open })) }),
      });
      onMsg("Availability saved — slots are offered on open days, 9 AM – 6 PM Damak time.");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Save failed");
    }
  }
  return (
    <Card className="mt-4 p-5">
      <p className="font-bold">Days you work</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {days.map((d) => (
          <label key={d.dow} className="flex cursor-pointer items-center gap-2 rounded-md border border-outline p-3 text-sm font-bold">
            <input type="checkbox" checked={d.is_open}
              onChange={() => setDays(days.map((x) => x.dow === d.dow ? { ...x, is_open: !x.is_open } : x))}
              className="size-4 accent-[#0f6b44]" />
            {DAYS[d.dow]}
          </label>
        ))}
      </div>
      <Button className="mt-4" onClick={save}>Save availability</Button>
    </Card>
  );
}

function DocsTab({ docs, state }: {
  docs: Doc[]; state: string;
}) {
  return (
    <div className="mt-4 space-y-4">
      <Card className="p-4">
        <p className="font-bold">Verification state: <Badge tone={state === "verified" ? "success" : "warning"}>{state || "—"}</Badge></p>
        <p className="mt-1 text-sm text-on-surface-variant">Only verified + active pros receive assignments. Verification happens physically at our office — bring your citizenship and trade certificates there.</p>
      </Card>
      <Card className="p-4">
        <p className="font-bold">Submitted documents ({docs.length})</p>
        {docs.length === 0 ? <p className="text-sm text-on-surface-variant">Nothing on file yet — our office records what you submit in person.</p> : (
          <ul className="mt-1 space-y-1 text-sm">
            {docs.map((d) => <li key={d.id} className="flex items-center gap-1.5"><FileUp size={14} aria-hidden="true" /> {d.kind} · {formatDate(d.uploaded_at)}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
