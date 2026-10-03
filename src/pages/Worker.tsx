import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Badge, Button, Card, PageHero, Price, Rating, StatusBadge, Tabs } from "../components/ui";
import { api, post, put, toBooking, toReview, toWorker } from "../lib/api";
import { useAuth } from "../lib/auth";
import { calcCommission } from "../lib/booking";
import { formatNPR, formatSlot } from "../lib/format";
import type { Booking, BookingStatus, Review, Worker } from "../lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Tab = "today" | "requests" | "upcoming" | "earnings" | "availability" | "reviews";

interface Earnings {
  jobs: {
    id: string;
    booking_no: string;
    final_paisa: string | number | null;
    commission_bps: number;
    rate_bps: number | null;
    commission_paisa: string | number | null;
    payment_method: string;
    is_settled: boolean | null;
  }[];
  collected: number;
  commission: number;
  net: number;
}

export default function Worker() {
  const { user } = useAuth();
  const [me, setMe] = useState<Worker | null>(null);
  const [requests, setRequests] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [avail, setAvail] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tab, setTab] = useState<Tab>("today");
  const [finalRs, setFinalRs] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [w, req, jb, earn, av, rev] = await Promise.all([
        api<{ worker: unknown }>(`/api/workers/${user.id}`),
        api<{ requests: unknown[] }>("/api/worker/requests"),
        api<{ jobs: unknown[] }>("/api/worker/jobs"),
        api<Earnings>("/api/worker/earnings"),
        api<{ days: boolean[] }>("/api/worker/availability"),
        api<{ reviews: unknown[] }>(`/api/reviews?workerId=${user.id}&limit=20`),
      ]);
      setMe(toWorker(w.worker as Parameters<typeof toWorker>[0]));
      setRequests((req.requests as Parameters<typeof toBooking>[0][]).map(toBooking));
      setJobs((jb.jobs as Parameters<typeof toBooking>[0][]).map(toBooking));
      setEarnings(earn);
      setAvail(av.days);
      setReviews((rev.reviews as Parameters<typeof toReview>[0][]).map(toReview));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (no: string, to: BookingStatus, opts?: { finalPaisa?: number; note?: string }) => {
    await post(`/api/bookings/${encodeURIComponent(no)}/transition`, {
      to,
      note: opts?.note ?? "",
      finalPaisa: opts?.finalPaisa,
    });
    await load();
  };

  const toggleDay = async (i: number) => {
    const next = avail.map((v, j) => (j === i ? !v : v));
    setAvail(next);
    await put("/api/worker/availability", { days: next });
  };

  const active = jobs.filter((b) => ["confirmed", "en-route", "in-progress"].includes(b.status));
  const upcoming = jobs.filter((b) => b.status === "confirmed");
  const svcName = (b: Booking) => b.serviceName ?? b.serviceId;

  if (failed && !me) {
    return (
      <div className="wrap py-12 text-center">
        <p className="font-bold">Couldn&apos;t load the worker board</p>
        <p className="mt-1 text-sm text-on-surface-variant">Sign in as a worker to see assignments.</p>
        <div className="mt-4">
          <Button onClick={() => void load()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="For workers"
        title="Worker board"
        body="Requests, today's jobs, earnings and schedule — everything a pro needs for the day."
      >
        {me && <Badge tone="marigold">{me.name}</Badge>}
      </PageHero>
      <div className="wrap py-8">
      {me && (
        <Card className="elev-2 flex flex-wrap items-center gap-4 p-6">
          <Avatar name={me.name} hue={me.avatarHue} size={64} ring />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold">{me.name}</h1>
            <p className="mt-0.5"><Rating value={me.rating} count={me.jobsDone} /></p>
          </div>
          <div className="flex gap-6 text-center">
            <div><p className="font-display text-2xl font-semibold">{active.length}</p><p className="text-xs font-bold tracking-wide text-on-surface-variant uppercase">active</p></div>
            <div><p className="font-display text-2xl font-semibold">{requests.length}</p><p className="text-xs font-bold tracking-wide text-on-surface-variant uppercase">requests</p></div>
            <div><p className="font-display text-2xl font-semibold">{formatNPR(earnings?.net ?? 0)}</p><p className="text-xs font-bold tracking-wide text-on-surface-variant uppercase">net earned</p></div>
          </div>
        </Card>
      )}

      <div className="mt-6">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "today", label: `Today (${active.length})` },
            { id: "requests", label: `Requests (${requests.length})` },
            { id: "upcoming", label: `Upcoming (${upcoming.length})` },
            { id: "earnings", label: "Earnings" },
            { id: "availability", label: "Availability" },
            { id: "reviews", label: `Reviews (${reviews.length})` },
          ]}
        />
      </div>

      {tab === "today" && (
        <div className="mt-4 space-y-3">
          {active.length === 0 && <Card className="p-6 text-center text-sm text-on-surface-variant">No active jobs. New requests appear under Requests.</Card>}
          {active.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link to={`/track/${b.id}`} className="font-bold hover:text-primary">{b.id} · {svcName(b)}</Link>
                  <p className="text-sm text-on-surface-variant">{formatSlot(b.slot)} · {b.instructions}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {b.status === "confirmed" && (
                  <Button onClick={() => void act(b.id, "en-route")}>Start travel</Button>
                )}
                {b.status === "en-route" && (
                  <Button onClick={() => void act(b.id, "in-progress")}>Start job</Button>
                )}
                {b.status === "in-progress" && (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const rs = Number(finalRs[b.id] ?? "0");
                      void act(b.id, "awaiting-confirmation", {
                        note: "Job finished, final recorded",
                        finalPaisa: rs > 0 ? Math.round(rs * 100) : undefined,
                      });
                    }}
                  >
                    <label className="text-sm font-medium">
                      Final Rs{" "}
                      <input
                        value={finalRs[b.id] ?? ""}
                        onChange={(e) => setFinalRs((p) => ({ ...p, [b.id]: e.target.value }))}
                        placeholder={String(Math.round(b.estimatePaisa / 100))}
                        inputMode="decimal"
                        className="w-28 rounded-md border border-outline px-2 py-1.5 text-sm"
                      />
                    </label>
                    <Button type="submit">Finish job</Button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "requests" && (
        <div className="mt-4 space-y-3">
          {requests.length === 0 && <Card className="p-6 text-center text-sm text-on-surface-variant">No pending requests in your categories.</Card>}
          {requests.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <Link to={`/track/${b.id}`} className="font-bold hover:text-primary">{b.id} · {svcName(b)}</Link>
                <p className="text-sm text-on-surface-variant">{formatSlot(b.slot)} · {b.instructions}</p>
                <p className="text-sm"><Price paisa={b.estimatePaisa} prefix="est. " /> · {b.paymentMethod}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void act(b.id, "confirmed", { note: "Accepted by worker" })}>
                  Accept
                </Button>
                <Button variant="outline" onClick={() => void act(b.id, "cancelled", { note: "Rejected — back to assignment pool" })}>
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "upcoming" && (
        <div className="mt-4 space-y-3">
          {upcoming.length === 0 && <Card className="p-6 text-center text-sm text-on-surface-variant">Nothing scheduled ahead.</Card>}
          {upcoming.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <Link to={`/track/${b.id}`} className="font-bold hover:text-primary">{b.id} · {svcName(b)}</Link>
                <p className="text-sm text-on-surface-variant">{formatSlot(b.slot)}</p>
              </div>
              <StatusBadge status={b.status} />
            </Card>
          ))}
        </div>
      )}

      {tab === "earnings" && earnings && (
        <div className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-t-4 border-t-pine-800 p-5"><p className="font-display text-2xl font-semibold">{formatNPR(earnings.collected)}</p><p className="text-xs font-bold tracking-wide text-on-surface-variant uppercase">collected</p></Card>
            <Card className="border-t-4 border-t-marigold-500 p-5"><p className="font-display text-2xl font-semibold text-error">−{formatNPR(earnings.commission)}</p><p className="text-xs font-bold tracking-wide text-on-surface-variant uppercase">platform commission</p></Card>
            <Card className="border-t-4 border-t-pine-800 p-5"><p className="font-display text-2xl font-semibold text-success">{formatNPR(earnings.net)}</p><p className="text-xs font-bold tracking-wide text-on-surface-variant uppercase">net earnings</p></Card>
          </div>
          <Card className="mt-4 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container text-left text-xs uppercase">
                  <th className="px-4 py-2.5">Booking</th>
                  <th className="px-4 py-2.5 text-right">Collected</th>
                  <th className="px-4 py-2.5 text-right">Commission</th>
                  <th className="px-4 py-2.5 text-right">Net</th>
                  <th className="px-4 py-2.5">Settlement</th>
                </tr>
              </thead>
              <tbody>
                {earnings.jobs.map((j) => {
                  const f = Number(j.final_paisa ?? 0);
                  const c = j.commission_paisa === null || j.commission_paisa === undefined
                    ? calcCommission(f, j.rate_bps ?? j.commission_bps)
                    : Number(j.commission_paisa);
                  return (
                    <tr key={j.id} className="border-t border-outline">
                      <td className="px-4 py-2.5 font-semibold">{j.booking_no}</td>
                      <td className="px-4 py-2.5 text-right">{formatNPR(f)}</td>
                      <td className="px-4 py-2.5 text-right text-error">−{formatNPR(c)}</td>
                      <td className="px-4 py-2.5 text-right font-bold">{formatNPR(f - c)}</td>
                      <td className="px-4 py-2.5">
                        {j.is_settled ? <Badge tone="success">Settled</Badge> : <Badge tone="warning">Open</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs text-on-surface-variant">
            Cash jobs: you keep the cash, the commission stays owed until periodic settlement or deduction from online payouts. Online jobs settle automatically minus commission.
          </p>
        </div>
      )}

      {tab === "availability" && (
        <Card className="mt-4 p-6">
          <h2 className="font-display text-xl font-semibold">Weekly availability</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Days you work. Booking slots are offered only on open days.</p>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Working days">
            {DAYS.map((d, i) => (
              <button
                key={d}
                onClick={() => void toggleDay(i)}
                aria-pressed={avail[i]}
                className={`cursor-pointer rounded-md border px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${avail[i] ? "border-pine-950 bg-pine-950 text-white" : "border-outline text-on-surface-variant"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">Working hours 9 AM – 6 PM, Damak time.</p>
        </Card>
      )}

      {tab === "reviews" && (
        <ul className="mt-4 space-y-3">
          {reviews.length === 0 && <Card className="p-6 text-center text-sm text-on-surface-variant">No reviews yet.</Card>}
          {reviews.map((r) => (
            <Card key={r.id} className="p-4">
              <Rating value={r.rating} />
              <p className="mt-1 text-sm">“{r.text}”</p>
              <p className="mt-1 text-xs text-on-surface-variant">Booking {r.bookingId}</p>
            </Card>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
