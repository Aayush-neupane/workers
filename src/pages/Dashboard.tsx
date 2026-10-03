import { Link } from "react-router-dom";
import { ArrowRight, Bell, CalendarPlus, LifeBuoy, Search, Trophy } from "lucide-react";
import { Badge, Button, Card, PageHero, Price, StatusBadge } from "../components/ui";
import { Kpi, SkeletonRows } from "../components/ops";
import { useAuth } from "../lib/auth";
import { useStore } from "../lib/store";
import { formatNPR, formatSlot } from "../lib/format";

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { ready, error, reload, bookings, rewardBalance, notifications } = useStore();

  const active = bookings.filter((b) => !["completed", "cancelled"].includes(b.status));
  const done = bookings.filter((b) => b.status === "completed");
  const spend = done.reduce((n, b) => n + (b.finalPaisa ?? b.estimatePaisa), 0);
  const unread = notifications.filter((n) => !n.read).length;
  const firstName = user?.name.split(" ")[0] ?? "";
  const nextJob = [...active].sort((a, b) => +new Date(a.slot) - +new Date(b.slot))[0];

  const months: { key: string; label: string; total: number }[] = [];
  {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d.toISOString());
      months.push({
        key,
        label: d.toLocaleString("en", { month: "short" }),
        total: done.filter((b) => monthKey(b.createdAt) === key).reduce((n, b) => n + (b.finalPaisa ?? b.estimatePaisa), 0),
      });
    }
  }
  const maxSpend = Math.max(1, ...months.map((m) => m.total));

  if (!ready) {
    return (
      <div className="wrap py-10">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  if (error && bookings.length === 0) {
    return (
      <div className="wrap py-12 text-center">
        <p className="font-display text-2xl font-semibold">Couldn&apos;t load your dashboard</p>
        <p className="mt-1 text-sm text-on-surface-variant">{error}</p>
        <div className="mt-4">
          <Button onClick={() => void reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Customer dashboard"
        title={`Namaste${firstName ? `, ${firstName}` : ""}`}
        body="Upcoming jobs, history, receipts and rewards — everything in one place."
      />
      <div className="wrap py-8">
        {nextJob ? (
          <Card className="ring-band dotgrid-light mb-5 flex flex-wrap items-center gap-4 border-0 p-6 text-white">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold tracking-[0.14em] text-marigold-300 uppercase">Next job · {nextJob.id}</p>
              <p className="font-display mt-1 truncate text-2xl font-semibold">{nextJob.serviceName ?? "Booking"}</p>
              <p className="mt-1 text-sm text-white/75">
                {formatSlot(nextJob.slot)} · {nextJob.workerName ?? "Assigning your pro…"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={nextJob.status} />
              <Link to={`/track/${nextJob.id}`}>
                <Button variant="marigold">Track <ArrowRight size={15} aria-hidden="true" /></Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 border-dashed p-6">
            <div>
              <p className="font-display text-xl font-semibold">Nothing scheduled</p>
              <p className="text-sm text-on-surface-variant">Book your first verified pro in under two minutes.</p>
            </div>
            <Link to="/services">
              <Button>Browse services</Button>
            </Link>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Search, label: "Book service", to: "/services" },
            { icon: CalendarPlus, label: "My bookings", to: "/dashboard" },
            { icon: Trophy, label: `${rewardBalance} points`, to: "/rewards" },
            { icon: LifeBuoy, label: "Get support", to: "/support" },
          ].map((a) => (
            <Link key={a.label} to={a.to}>
              <Card className="elev-lift flex items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-container text-on-primary-container">
                  <a.icon size={18} aria-hidden="true" />
                </span>
                <span className="text-sm font-bold">{a.label}</span>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi value={`${active.length}`} label="Active bookings" />
          <Kpi value={`${done.length}`} label="Completed jobs" />
          <Kpi value={formatNPR(spend)} label="Total spend" tone="success" />
          <Kpi value={`${rewardBalance} pts`} label="Reward balance" tone="marigold" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-display text-2xl font-semibold">Upcoming & active</h2>
            {active.length === 0 ? (
              <Card className="mt-3 p-6 text-center text-sm text-on-surface-variant">
                Nothing scheduled.{" "}
                <Link to="/services" className="font-semibold text-primary">Book your first service →</Link>
              </Card>
            ) : (
              <ul className="mt-3 space-y-3">
                {active.map((b) => (
                  <li key={b.id}>
                    <Link to={`/track/${b.id}`}>
                      <Card className="elev-lift flex flex-wrap items-center justify-between gap-3 p-4">
                        <span>
                          <span className="block font-bold">{b.serviceName ?? b.serviceId}</span>
                          <span className="text-sm text-on-surface-variant">
                            {b.id} · {formatSlot(b.slot)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Price paisa={b.estimatePaisa} />
                          <StatusBadge status={b.status} />
                        </span>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="font-display mt-8 text-2xl font-semibold">Spending rhythm</h2>
            <Card className="mt-3 p-5">
              <div className="flex h-28 items-end gap-2" role="img" aria-label="Spend per month for the last six months">
                {months.map((m) => (
                  <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-pine-800 to-primary"
                      style={{ height: `${Math.max(4, (m.total / maxSpend) * 100)}%` }}
                      title={`${m.label}: ${formatNPR(m.total)}`}
                    />
                    <span className="text-[11px] font-bold text-on-surface-variant">{m.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <h2 className="font-display mt-8 text-2xl font-semibold">History & receipts</h2>
            {done.length === 0 ? (
              <p className="mt-3 text-sm text-on-surface-variant">No completed jobs yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {done.map((b) => (
                  <li key={b.id}>
                    <Link to={`/track/${b.id}`}>
                      <Card className="elev-lift flex flex-wrap items-center justify-between gap-3 p-4">
                        <span>
                          <span className="block font-bold">{b.serviceName ?? b.serviceId}</span>
                          <span className="text-sm text-on-surface-variant">
                            {b.id} · paid via {b.paymentMethod} · {b.paymentStatus}
                          </span>
                        </span>
                        <Price paisa={b.finalPaisa ?? b.estimatePaisa} />
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <Bell size={16} aria-hidden="true" /> Notifications
                {unread > 0 && <Badge tone="info">{unread} new</Badge>}
              </h2>
              {notifications.length === 0 ? (
                <p className="mt-3 text-sm text-on-surface-variant">All caught up.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {notifications.map((n) => (
                    <li key={n.id} className="border-t border-outline pt-3 text-sm first:border-0 first:pt-0">
                      <p className="font-semibold">{n.title}</p>
                      <p className="text-on-surface-variant">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="ring-band dotgrid-light mt-4 border-0 p-5 text-white">
              <p className="font-display text-lg font-semibold">Need changes?</p>
              <p className="mt-1 text-sm text-white/75">Reschedule or cancel per policy, or talk to support.</p>
              <Link to="/support" className="mt-3 inline-block">
                <Button variant="marigold">Get support <ArrowRight size={15} aria-hidden="true" /></Button>
              </Link>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
