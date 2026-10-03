import { Link } from "react-router-dom";
import { ArrowRight, Bell } from "lucide-react";
import { Badge, Button, Card, PageHero, Price, StatusBadge } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useStore } from "../lib/store";
import { formatNPR, formatSlot } from "../lib/format";

export default function Dashboard() {
  const { user } = useAuth();
  const { ready, error, reload, bookings, rewardBalance, notifications } = useStore();

  const active = bookings.filter((b) => !["completed", "cancelled"].includes(b.status));
  const done = bookings.filter((b) => b.status === "completed");
  const spend = done.reduce((n, b) => n + (b.finalPaisa ?? b.estimatePaisa), 0);
  const unread = notifications.filter((n) => !n.read).length;
  const firstName = user?.name.split(" ")[0] ?? "";

  if (!ready) {
    return (
      <div className="wrap py-12" role="status">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-1/2 rounded bg-surface-container-high" />
          <div className="grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-surface-container" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && bookings.length === 0) {
    return (
      <div className="wrap py-12 text-center">
        <p className="font-bold">Couldn&apos;t load your dashboard</p>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [`${active.length}`, "active bookings"],
          [`${done.length}`, "completed jobs"],
          [formatNPR(spend), "total spend"],
          [`${rewardBalance} pts`, "reward balance"],
        ].map(([v, l]) => (
          <Card key={l} className="border-t-4 border-t-pine-800 p-5">
            <p className="font-display text-[26px] font-semibold text-pine-950">{v}</p>
            <p className="text-xs font-bold tracking-wide text-on-surface-variant uppercase">{l}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
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
