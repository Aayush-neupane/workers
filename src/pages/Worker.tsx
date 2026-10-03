import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Badge, Button, Card, PageHero, Price, Rating, SectionHead, StatusBadge, Tabs } from "../components/ui";
import { REVIEWS, SERVICES, WORKERS } from "../data/mock";
import { useStore } from "../lib/store";
import { calcCommission } from "../lib/booking";
import { formatNPR, formatSlot } from "../lib/format";

const ME = "w-ram";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Tab = "today" | "requests" | "upcoming" | "earnings" | "availability" | "reviews";

function loadAvail(): boolean[] {
  try {
    const raw = localStorage.getItem("wk-avail");
    if (raw) return JSON.parse(raw) as boolean[];
  } catch {
    /* default below */
  }
  return [false, true, true, true, true, true, false];
}

export default function Worker() {
  const { bookings, advanceBooking } = useStore();
  const [tab, setTab] = useState<Tab>("today");
  const [avail, setAvail] = useState<boolean[]>(loadAvail);
  const [finalRs, setFinalRs] = useState<Record<string, string>>({});

  const me = WORKERS.find((w) => w.id === ME)!;
  const myServices = new Set(
    SERVICES.filter((s) => me.categoryIds.includes(s.categoryId)).map((s) => s.id),
  );

  const mine = bookings.filter((b) => b.workerId === ME);
  const active = mine.filter((b) => ["confirmed", "en-route", "in-progress"].includes(b.status));
  const requests = bookings.filter(
    (b) => b.status === "awaiting-worker" && myServices.has(b.serviceId) && (!b.workerId || b.workerId === ME),
  );
  const upcoming = mine.filter((b) => b.status === "confirmed");
  const completed = mine.filter((b) => b.status === "completed");
  const myReviews = REVIEWS.filter((r) => r.workerId === ME);

  const collected = completed.reduce((n, b) => n + (b.finalPaisa ?? b.estimatePaisa), 0);
  const commission = completed.reduce(
    (n, b) => n + (b.commissionPaisa ?? calcCommission(b.finalPaisa ?? b.estimatePaisa, b.commissionBps)),
    0,
  );

  const toggleDay = (i: number) => {
    setAvail((prev) => {
      const next = prev.map((v, j) => (j === i ? !v : v));
      try {
        localStorage.setItem("wk-avail", JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };

  const svcName = (id: string) => SERVICES.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="For workers"
        title="Worker board"
        body="Requests, today's jobs, earnings and schedule — everything a pro needs for the day."
      >
        <Badge tone="marigold">Demoing as {me.name}</Badge>
      </PageHero>
      <div className="wrap py-8">
      <Card className="elev-2 flex flex-wrap items-center gap-4 p-6">
        <Avatar name={me.name} hue={me.avatarHue} size={64} />
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold">{me.name}</h1>
          <p className="mt-0.5"><Rating value={me.rating} count={me.jobsDone} /></p>
        </div>
        <div className="flex gap-6 text-center">
          <div><p className="text-xl font-bold">{active.length}</p><p className="text-xs text-on-surface-variant">active</p></div>
          <div><p className="text-xl font-bold">{requests.length}</p><p className="text-xs text-on-surface-variant">requests</p></div>
          <div><p className="text-xl font-bold">{formatNPR(collected - commission)}</p><p className="text-xs text-on-surface-variant">net earned</p></div>
        </div>
      </Card>

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
            { id: "reviews", label: `Reviews (${myReviews.length})` },
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
                  <Link to={`/track/${b.id}`} className="font-bold hover:text-primary">{b.id} · {svcName(b.serviceId)}</Link>
                  <p className="text-sm text-on-surface-variant">{formatSlot(b.slot)} · {b.instructions}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {b.status === "confirmed" && (
                  <Button onClick={() => advanceBooking(b.id, "en-route", "worker")}>Start travel</Button>
                )}
                {b.status === "en-route" && (
                  <Button onClick={() => advanceBooking(b.id, "in-progress", "worker")}>Start job</Button>
                )}
                {b.status === "in-progress" && (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const rs = Number(finalRs[b.id] ?? "0");
                      advanceBooking(b.id, "awaiting-confirmation", "worker", "Job finished, final recorded", {
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
                <Link to={`/track/${b.id}`} className="font-bold hover:text-primary">{b.id} · {svcName(b.serviceId)}</Link>
                <p className="text-sm text-on-surface-variant">{formatSlot(b.slot)} · {b.instructions}</p>
                <p className="text-sm"><Price paisa={b.estimatePaisa} prefix="est. " /> · {b.paymentMethod}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => advanceBooking(b.id, "confirmed", "worker", "Accepted by worker", { workerId: ME })}
                >
                  Accept
                </Button>
                <Button variant="outline" onClick={() => advanceBooking(b.id, "cancelled", "worker", "Rejected — back to assignment pool")}>
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
                <Link to={`/track/${b.id}`} className="font-bold hover:text-primary">{b.id} · {svcName(b.serviceId)}</Link>
                <p className="text-sm text-on-surface-variant">{formatSlot(b.slot)}</p>
              </div>
              <StatusBadge status={b.status} />
            </Card>
          ))}
        </div>
      )}

      {tab === "earnings" && (
        <div className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5"><p className="text-2xl font-bold">{formatNPR(collected)}</p><p className="text-sm text-on-surface-variant">collected</p></Card>
            <Card className="p-5"><p className="text-2xl font-bold text-error">−{formatNPR(commission)}</p><p className="text-sm text-on-surface-variant">platform commission</p></Card>
            <Card className="p-5"><p className="text-2xl font-bold text-success">{formatNPR(collected - commission)}</p><p className="text-sm text-on-surface-variant">net earnings</p></Card>
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
                {completed.map((b) => {
                  const f = b.finalPaisa ?? b.estimatePaisa;
                  const c = b.commissionPaisa ?? calcCommission(f, b.commissionBps);
                  return (
                    <tr key={b.id} className="border-t border-outline">
                      <td className="px-4 py-2.5 font-semibold">{b.id}</td>
                      <td className="px-4 py-2.5 text-right">{formatNPR(f)}</td>
                      <td className="px-4 py-2.5 text-right text-error">−{formatNPR(c)}</td>
                      <td className="px-4 py-2.5 text-right font-bold">{formatNPR(f - c)}</td>
                      <td className="px-4 py-2.5">
                        {b.paymentMethod === "cash" ? (
                          <Badge tone="warning">Rs {formatNPR(c).slice(3)} commission owed</Badge>
                        ) : (
                          <Badge tone="success">Settled via payout</Badge>
                        )}
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
          <SectionHead eyebrow="Schedule" title="Weekly availability" body="Days you work. Booking slots are offered only on open days." />
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Working days">
            {DAYS.map((d, i) => (
              <button
                key={d}
                onClick={() => toggleDay(i)}
                aria-pressed={avail[i]}
                className={`cursor-pointer rounded-md border px-4 py-2.5 text-sm font-semibold transition ${avail[i] ? "border-primary bg-primary text-white" : "border-outline text-on-surface-variant"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">Working hours 9 AM – 6 PM, Damak time. Slots are offered on open days only.</p>
        </Card>
      )}

      {tab === "reviews" && (
        <ul className="mt-4 space-y-3">
          {myReviews.length === 0 && <Card className="p-6 text-center text-sm text-on-surface-variant">No reviews yet.</Card>}
          {myReviews.map((r) => (
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
