import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Inbox, Sparkles } from "lucide-react";
import { Avatar, Badge, Button, Card, Price, Rating, StatusBadge } from "../components/ui";
import { Kpi, OpsShell, SkeletonRows } from "../components/ops";
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
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (no: string, to: BookingStatus, opts?: { finalPaisa?: number; note?: string }) => {
    setActionError("");
    try {
      await post(`/api/bookings/${encodeURIComponent(no)}/transition`, {
        to,
        note: opts?.note ?? "",
        finalPaisa: opts?.finalPaisa,
      });
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const toggleDay = async (i: number) => {
    const next = avail.map((v, j) => (j === i ? !v : v));
    setAvail(next);
    try {
      await put("/api/worker/availability", { days: next });
    } catch {
      setAvail(avail);
    }
  };

  const active = jobs.filter((b) => ["confirmed", "en-route", "in-progress"].includes(b.status));
  const upcoming = jobs.filter((b) => b.status === "confirmed");
  const svcName = (b: Booking) => b.serviceName ?? b.serviceId;
  const nextJob = [...active].sort((a, b) => +new Date(a.slot) - +new Date(b.slot))[0];

  return (
    <OpsShell<Tab>
      eyebrow="For workers"
      title="Worker board"
      body="Requests, today's jobs, earnings and schedule."
      badge={me ? <Badge tone="marigold">{me.name}</Badge> : undefined}
      tabs={[
        { id: "today", label: "Today", count: active.length },
        { id: "requests", label: "Requests", count: requests.length },
        { id: "upcoming", label: "Upcoming", count: upcoming.length },
        { id: "earnings", label: "Earnings" },
        { id: "availability", label: "Availability" },
        { id: "reviews", label: "Reviews", count: reviews.length },
      ]}
      value={tab}
      onChange={setTab}
    >
      {loading ? (
        <SkeletonRows rows={4} />
      ) : failed && !me ? (
        <Card className="p-8 text-center">
          <p className="font-display text-xl font-semibold">Couldn&apos;t load the worker board</p>
          <p className="mt-1 text-sm text-on-surface-variant">Sign in as a worker to see assignments.</p>
          <div className="mt-4">
            <Button onClick={() => void load()}>Retry</Button>
          </div>
        </Card>
      ) : (
        <>
          {me && tab !== "earnings" && (
            <Card className="elev-2 mb-5 flex flex-wrap items-center gap-4 p-5">
              <Avatar name={me.name} hue={me.avatarHue} size={56} ring />
              <div className="min-w-0 flex-1">
                <p className="font-display truncate text-xl font-semibold">{me.name}</p>
                <Rating value={me.rating} count={me.jobsDone} />
              </div>
              <div className="flex gap-5 text-center">
                <div><p className="font-display text-xl font-semibold tabular-nums">{active.length}</p><p className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">active</p></div>
                <div><p className="font-display text-xl font-semibold tabular-nums">{requests.length}</p><p className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">requests</p></div>
                <div><p className="font-display text-xl font-semibold tabular-nums">{formatNPR(earnings?.net ?? 0)}</p><p className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">net</p></div>
              </div>
            </Card>
          )}

          {actionError && (
            <p role="alert" className="mb-4 rounded-md bg-error-container p-3 text-sm font-medium text-error">
              {actionError}
            </p>
          )}

          {tab === "today" && (
            <div className="space-y-3">
              {nextJob && (
                <Card className="ring-band dotgrid-light border-0 p-5 text-white">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-[0.14em] text-marigold-300 uppercase">
                    <CalendarClock size={13} aria-hidden="true" /> Up next
                  </p>
                  <p className="font-display mt-1 text-2xl font-semibold">
                    {nextJob.id} · {svcName(nextJob)}
                  </p>
                  <p className="mt-1 text-sm text-white/75">{formatSlot(nextJob.slot)} · {nextJob.instructions}</p>
                  <div className="mt-3">
                    <Link to={`/track/${nextJob.id}`}>
                      <Button variant="marigold">Open job</Button>
                    </Link>
                  </div>
                </Card>
              )}
              {active.length === 0 && (
                <Card className="p-8 text-center">
                  <Inbox size={28} aria-hidden="true" className="mx-auto text-on-surface-variant" />
                  <p className="font-display mt-2 text-lg font-semibold">Day is clear</p>
                  <p className="mt-1 text-sm text-on-surface-variant">New requests appear under Requests.</p>
                </Card>
              )}
              {active.filter((b) => b.id !== nextJob?.id).map((b) => (
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
                            className="w-28 rounded-md border border-outline bg-white px-2 py-1.5 text-sm"
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
            <div className="space-y-3">
              {requests.length === 0 && (
                <Card className="p-8 text-center">
                  <Sparkles size={28} aria-hidden="true" className="mx-auto text-on-surface-variant" />
                  <p className="font-display mt-2 text-lg font-semibold">No pending requests</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Open jobs in your categories will land here.</p>
                </Card>
              )}
              {requests.map((b) => (
                <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-marigold-500 p-5">
                  <div>
                    <Link to={`/track/${b.id}`} className="font-bold hover:text-primary">{b.id} · {svcName(b)}</Link>
                    <p className="text-sm text-on-surface-variant">{formatSlot(b.slot)} · {b.instructions}</p>
                    <p className="mt-1 text-sm"><Price paisa={b.estimatePaisa} prefix="est. " /> · {b.paymentMethod}</p>
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
            <div className="space-y-3">
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
            <div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi value={formatNPR(earnings.collected)} label="Collected" />
                <Kpi value={`−${formatNPR(earnings.commission)}`} label="Platform commission" tone="error" />
                <Kpi value={formatNPR(earnings.net)} label="Net earnings" tone="success" sub="Cash owed settles periodically" />
              </div>
              <Card className="mt-4 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-container text-left text-[11px] font-extrabold tracking-wider uppercase">
                      <th className="px-4 py-2.5">Booking</th>
                      <th className="px-4 py-2.5 text-right">Collected</th>
                      <th className="px-4 py-2.5 text-right">Commission</th>
                      <th className="px-4 py-2.5 text-right">Net</th>
                      <th className="px-4 py-2.5">Settlement</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
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
            </div>
          )}

          {tab === "availability" && (
            <Card className="p-6">
              <h2 className="font-display text-xl font-semibold">Weekly availability</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Days you work. Slots are offered on open days only, 9 AM – 6 PM Damak time.</p>
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Working days">
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => void toggleDay(i)}
                    aria-pressed={avail[i]}
                    className={`cursor-pointer rounded-md border px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${avail[i] ? "border-pine-950 bg-pine-950 text-white" : "border-outline text-on-surface-variant hover:border-pine-800"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {tab === "reviews" && (
            <ul className="space-y-3">
              {reviews.length === 0 && <Card className="p-6 text-center text-sm text-on-surface-variant">No reviews yet — finished jobs earn ratings here.</Card>}
              {reviews.map((r) => (
                <Card key={r.id} className="p-5">
                  <Rating value={r.rating} />
                  <p className="font-display mt-1.5 text-[17px] leading-snug">“{r.text}”</p>
                  <p className="mt-1.5 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">Booking {r.bookingId}</p>
                </Card>
              ))}
            </ul>
          )}
        </>
      )}
    </OpsShell>
  );
}
