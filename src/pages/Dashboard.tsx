import { Link } from "react-router-dom";
import { ArrowRight, Bell } from "lucide-react";
import { Badge, Button, Card, Price, SectionHead, StatusBadge } from "../components/ui";
import { NOTIFICATIONS, SERVICES } from "../data/mock";
import { useAuth } from "../lib/auth";
import { useStore } from "../lib/store";
import { formatNPR, formatSlot } from "../lib/format";

export default function Dashboard() {
  const { name } = useAuth();
  const { bookings, rewardBalance } = useStore();

  const active = bookings.filter(
    (b) => !["completed", "cancelled"].includes(b.status),
  );
  const done = bookings.filter((b) => b.status === "completed");
  const spend = done.reduce((n, b) => n + (b.finalPaisa ?? b.estimatePaisa), 0);
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <div className="wrap fade-up py-10">
      <SectionHead
        eyebrow="Customer dashboard"
        title={`Namaste${name ? `, ${name.split(" ")[0]}` : ""}`}
        body="Upcoming jobs, history, receipts and rewards — everything in one place."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [`${active.length}`, "active bookings"],
          [`${done.length}`, "completed jobs"],
          [formatNPR(spend), "total spend"],
          [`${rewardBalance} pts`, "reward balance"],
        ].map(([v, l]) => (
          <Card key={l} className="p-5">
            <p className="text-2xl font-bold text-primary">{v}</p>
            <p className="text-sm text-on-surface-variant">{l}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold">Upcoming & active</h2>
          {active.length === 0 ? (
            <Card className="mt-3 p-6 text-center text-sm text-on-surface-variant">
              Nothing scheduled.{" "}
              <Link to="/services" className="font-semibold text-primary">Book your first service →</Link>
            </Card>
          ) : (
            <ul className="mt-3 space-y-3">
              {active.map((b) => {
                const s = SERVICES.find((x) => x.id === b.serviceId);
                return (
                  <li key={b.id}>
                    <Link to={`/track/${b.id}`}>
                      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-primary">
                        <span>
                          <span className="block font-bold">{s?.name ?? b.serviceId}</span>
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
                );
              })}
            </ul>
          )}

          <h2 className="mt-8 text-xl font-bold">History & receipts</h2>
          <ul className="mt-3 space-y-3">
            {done.map((b) => {
              const s = SERVICES.find((x) => x.id === b.serviceId);
              return (
                <li key={b.id}>
                  <Link to={`/track/${b.id}`}>
                    <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-primary">
                      <span>
                        <span className="block font-bold">{s?.name ?? b.serviceId}</span>
                        <span className="text-sm text-on-surface-variant">
                          {b.id} · paid via {b.paymentMethod} · {b.paymentStatus}
                        </span>
                      </span>
                      <Price paisa={b.finalPaisa ?? b.estimatePaisa} />
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <aside>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Bell size={16} aria-hidden="true" /> Notifications
              {unread > 0 && <Badge tone="info">{unread} new</Badge>}
            </h2>
            <ul className="mt-3 space-y-3">
              {NOTIFICATIONS.map((n) => (
                <li key={n.id} className="border-t border-outline pt-3 text-sm first:border-0 first:pt-0">
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-on-surface-variant">{n.body}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="mt-4 bg-primary p-5 text-white">
            <p className="font-bold">Need changes?</p>
            <p className="mt-1 text-sm opacity-90">Reschedule or cancel per policy, or talk to support.</p>
            <Link to="/support" className="mt-3 inline-block">
              <Button variant="secondary">Get support <ArrowRight size={15} aria-hidden="true" /></Button>
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
