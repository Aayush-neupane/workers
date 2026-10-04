import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, PageHero, Price } from "../components/ui";
import { api, post } from "../lib/api";
import { formatSlot, formatNPR } from "../lib/format";
import type { Booking } from "../lib/types";

interface Earnings {
  ledger: { id: string; booking_id: string; booking_no: string; total_paisa: string; commission_paisa: string; worker_paisa: string; is_settled: boolean }[];
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Worker() {
  const [tab, setTab] = useState<"today" | "requests" | "quotes" | "earnings" | "availability">("today");
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [requests, setRequests] = useState<Booking[]>([]);
  const [quotes, setQuotes] = useState<OpenQuote[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [days, setDays] = useState<{ dow: number; is_open: boolean }[]>([]);
  const [msg, setMsg] = useState("");
  const [otpFor, setOtpFor] = useState("");
  const [otpCode, setOtpCode] = useState("");

  function reload() {
    api<{ jobs: Booking[]; requests: Booking[] }>("/api/worker/jobs")
      .then((d) => { setJobs(d.jobs); setRequests(d.requests); }).catch(() => {});
    api<Earnings>("/api/worker/earnings").then(setEarnings).catch(() => {});
    api<{ days: typeof days }>("/api/worker/availability").then((d) => setDays(d.days)).catch(() => {
      setDays(DAYS.map((_, i) => ({ dow: i, is_open: true })));
    });
    api<{ requests: OpenQuote[] }>("/api/quotes/requests/open").then((d) => setQuotes(d.requests)).catch(() => {});
  }
  useEffect(reload, []);

  async function move(id: string, to: string) {
    setMsg("");
    try {
      await post(`/api/bookings/${id}/transition`, { to });
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function issueOtp(id: string) {
    setMsg("");
    try {
      await post(`/api/bookings/${id}/otp/issue`, {});
      setMsg("Code sent to the customer. Ask them to read it out when the work is done.");
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not issue code");
    }
  }

  async function verifyOtp() {
    setMsg("");
    try {
      await post(`/api/bookings/${otpFor}/otp/verify`, { code: otpCode });
      setMsg("Code accepted — job completed, earnings updated.");
      setOtpFor("");
      setOtpCode("");
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Verification failed");
    }
  }

  async function saveDays() {
    await api("/api/worker/availability", { method: "PUT", body: JSON.stringify({ days: days.map((d) => ({ dow: d.dow, open: d.is_open })) }) })
      .then(() => setMsg("Availability saved."))
      .catch((e: unknown) => setMsg(e instanceof Error ? e.message : "Save failed"));
  }

  const today = new Date().toDateString();
  const todays = jobs.filter((j) => new Date(j.slot).toDateString() === today);

  return (
    <div className="fade-up">
      <PageHero eyebrow="Professional portal" title="Today's work" body="Assignments, availability and earnings — nothing else." />
      <div className="wrap py-8">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pro sections">
          {(["today", "requests", "quotes", "earnings", "availability"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-bold capitalize ${tab === t ? "bg-pine-950 text-white" : "bg-surface-container hover:border-pine-800"}`}>
              {t}
            </button>
          ))}
        </div>
        {msg && <p role="status" className="mt-4 rounded-md bg-info-container p-3 text-sm font-medium text-info">{msg}</p>}

        {tab === "today" && (
          <div className="mt-4 space-y-3">
            {todays.length === 0 && <EmptyState title="No jobs today" body="Check requests for open assignments, or upcoming jobs below." />}
            {todays.map((j) => (
              <JobCard key={j.id} job={j} onMove={move} onIssue={issueOtp} />
            ))}
            <h3 className="pt-4 font-display text-lg font-semibold">Upcoming</h3>
            {jobs.filter((j) => new Date(j.slot).toDateString() !== today).map((j) => (
              <JobCard key={j.id} job={j} onMove={move} onIssue={issueOtp} />
            ))}
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
                </div>
                <Button onClick={() => move(j.id, "confirmed")}>Accept</Button>
              </Card>
            ))}
          </div>
        )}

        {tab === "quotes" && (
          <div className="mt-4 space-y-3">
            {quotes.length === 0 && <EmptyState title="No quote requests" body="Complex Damak jobs needing proposals appear here." />}
            {quotes.map((q) => (
              <QuotePropose key={q.id} quote={q} onDone={() => { setMsg("Proposal sent."); reload(); }} onError={setMsg} />
            ))}
          </div>
        )}

        {tab === "earnings" && earnings && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-5"><p className="text-xs font-bold text-on-surface-variant uppercase">Net earnings</p><p className="font-display text-2xl font-semibold"><Price paisa={earnings.netPaisa} /></p></Card>
              <Card className="p-5"><p className="text-xs font-bold text-on-surface-variant uppercase">Commission owed</p><p className="font-display text-2xl font-semibold"><Price paisa={earnings.owedPaisa} /></p></Card>
              <Card className="p-5"><p className="text-xs font-bold text-on-surface-variant uppercase">Settlements</p><p className="font-display text-2xl font-semibold">{earnings.settlements.length}</p></Card>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="text-left text-xs text-on-surface-variant">
                  <th className="px-4 py-2.5">Booking</th><th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-right">Commission</th><th className="px-4 py-2.5 text-right">You keep</th>
                  <th className="px-4 py-2.5">Settled</th>
                </tr></thead>
                <tbody>
                  {earnings.ledger.map((l) => (
                    <tr key={l.id} className="border-t border-outline/60">
                      <td className="px-4 py-2.5 font-mono">{l.booking_no}</td>
                      <td className="px-4 py-2.5 text-right">{formatNPR(Number(l.total_paisa))}</td>
                      <td className="px-4 py-2.5 text-right text-error">−{formatNPR(Number(l.commission_paisa))}</td>
                      <td className="px-4 py-2.5 text-right font-bold">{formatNPR(Number(l.worker_paisa))}</td>
                      <td className="px-4 py-2.5">{l.is_settled ? <Badge tone="success">Settled</Badge> : <Badge tone="warning">Pending</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <div className="rounded-md border border-outline bg-white p-4">
              <p className="font-bold">Verify a completion code</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input value={otpFor} onChange={(e) => setOtpFor(e.target.value)} placeholder="Booking no or ID"
                  className="rounded-md border border-outline px-3 py-2 text-sm outline-none focus:border-primary" aria-label="Booking" />
                <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" maxLength={6}
                  className="rounded-md border border-outline px-3 py-2 text-sm outline-none focus:border-primary" aria-label="Completion code" />
                <Button onClick={verifyOtp} disabled={!otpFor || otpCode.length !== 6}>Verify & complete</Button>
              </div>
            </div>
          </div>
        )}

        {tab === "availability" && (
          <Card className="mt-4 p-5">
            <p className="font-bold">Days you work</p>
            <p className="text-sm text-on-surface-variant">Slots are offered on open days, 9 AM – 6 PM Damak time.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {days.map((d) => (
                <label key={d.dow} className="flex cursor-pointer items-center gap-2 rounded-md border border-outline p-3 text-sm font-bold">
                  <input type="checkbox" checked={d.is_open}
                    onChange={() => setDays((ds) => ds.map((x) => x.dow === d.dow ? { ...x, is_open: !x.is_open } : x))}
                    className="size-4 accent-[#0f6b44]" />
                  {DAYS[d.dow]}
                </label>
              ))}
            </div>
            <Button className="mt-4" onClick={saveDays}>Save availability</Button>
          </Card>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, onMove, onIssue }: { job: Booking; onMove: (id: string, to: string) => void; onIssue: (id: string) => void }) {
  const next: Record<string, string> = {
    confirmed: "en-route",
    "en-route": "in-progress",
  };
  const nextLabel: Record<string, string> = {
    confirmed: "Mark en route",
    "en-route": "Start work",
    "in-progress": "Finish — send code",
  };
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="font-bold">{job.service_name} · <span className="font-mono text-sm">{job.booking_no}</span></p>
        <p className="text-sm text-on-surface-variant">{formatSlot(job.slot)}</p>
        <p className="text-sm text-on-surface-variant">{job.address_text}</p>
        <p className="mt-1 text-sm">{job.instructions}</p>
        <Badge tone="info">{job.status}</Badge>
      </div>
      <div className="flex gap-2">
        {next[job.status] && <Button onClick={() => onMove(job.id, next[job.status])}>{nextLabel[job.status]}</Button>}
        {job.status === "in-progress" && <Button onClick={() => onIssue(job.id)}>{nextLabel["in-progress"]}</Button>}
      </div>
    </Card>
  );
}

function QuotePropose({ quote, onDone, onError }: { quote: OpenQuote; onDone: () => void; onError: (m: string) => void }) {
  const [price, setPrice] = useState("");
  const [scope, setScope] = useState("");
  const [avail, setAvail] = useState("");
  const [open, setOpen] = useState(false);

  async function send() {
    try {
      await post(`/api/quotes/requests/${quote.id}/proposals`, {
        pricePaisa: Math.round(Number(price) * 100),
        scope,
        availability: avail,
      });
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Proposal failed");
    }
  }

  return (
    <Card className="p-4">
      <p className="font-bold">{quote.title} {quote.ward ? <Badge tone="info">Ward {quote.ward}</Badge> : null}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{quote.description}</p>
      <p className="mt-1 text-xs text-on-surface-variant">
        Window: {formatSlot(quote.window_start)} → {formatSlot(quote.window_end)} · {quote.proposal_count} proposals
      </p>
      {!open ? (
        <Button variant="outline" className="mt-3" onClick={() => setOpen(true)}>Propose a price</Button>
      ) : (
        <div className="mt-3 space-y-2">
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price in Rs" inputMode="decimal"
            className="w-full rounded-md border border-outline px-3 py-2 text-sm outline-none focus:border-primary" aria-label="Price in rupees" />
          <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Scope (min 10 chars)"
            className="w-full rounded-md border border-outline px-3 py-2 text-sm outline-none focus:border-primary" aria-label="Scope" />
          <input value={avail} onChange={(e) => setAvail(e.target.value)} placeholder="Availability, e.g. Tue–Thu mornings"
            className="w-full rounded-md border border-outline px-3 py-2 text-sm outline-none focus:border-primary" aria-label="Availability" />
          <Button onClick={send}>Send proposal</Button>
        </div>
      )}
    </Card>
  );
}
