import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, EmptyState, PageHero, Price } from "../components/ui";
import { api, post } from "../lib/api";
import { formatSlot } from "../lib/format";
import type { Booking, QuoteRequest } from "../lib/types";

export default function Dashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [balance, setBalance] = useState(0);
  const [notes, setNotes] = useState<{ id: string; title: string; body: string; is_read: boolean }[]>([]);

  function reload() {
    api<{ bookings: Booking[] }>("/api/bookings/mine").then((d) => setBookings(d.bookings)).catch(() => {});
    api<{ requests: QuoteRequest[] }>("/api/quotes/requests/mine").then((d) => setQuotes(d.requests)).catch(() => {});
    api<{ balance: number }>("/api/rewards/mine").then((d) => setBalance(d.balance)).catch(() => {});
    api<{ notifications: typeof notes }>("/api/notifications").then((d) => setNotes(d.notifications)).catch(() => {});
  }

  useEffect(reload, []);

  async function acceptProposal(proposalId: string) {
    try {
      const out = await post<{ bookingNo: string }>("/api/quotes/proposals/" + proposalId + "/accept", {});
      window.location.href = `/track/${out.bookingNo}`;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not accept");
    }
  }

  const upcoming = bookings.filter((b) => !["completed", "cancelled"].includes(b.status));
  const done = bookings.filter((b) => ["completed", "cancelled"].includes(b.status));

  return (
    <div className="fade-up">
      <PageHero eyebrow="Customer portal" title="Your bookings" body="Track jobs live, compare quote proposals, and spend loyalty points." />
      <div className="wrap grid items-start gap-5 py-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <section>
            <h2 className="font-display text-xl font-semibold">Upcoming ({upcoming.length})</h2>
            {upcoming.length === 0 ? (
              <div className="mt-3"><EmptyState title="Nothing scheduled" body="Book a fixed service or request a quote for complex work." /></div>
            ) : (
              <div className="mt-3 space-y-3">
                {upcoming.map((b) => (
                  <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-bold">{b.service_name} · <span className="font-mono text-sm">{b.booking_no}</span></p>
                      <p className="text-sm text-on-surface-variant">{formatSlot(b.slot)} · {b.worker_name ?? "Assigning a pro…"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={b.status === "disputed" ? "error" : "info"}>{b.status}</Badge>
                      <Link to={`/track/${b.booking_no}`}><Button variant="outline">Track</Button></Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
          {quotes.filter((q) => q.status !== "accepted" && q.status !== "cancelled").map((q) => (
            <section key={q.id}>
              <h2 className="font-display text-xl font-semibold">Quote: {q.title}</h2>
              <div className="mt-3 space-y-3">
                {(q.proposals ?? []).length === 0 && (
                  <EmptyState title="Waiting for proposals" body="Verified pros in Damak are reviewing your request." />
                )}
                {(q.proposals ?? []).map((p) => (
                  <Card key={p.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Price paisa={p.price_paisa} />
                      {p.approved ? <Badge tone="success">Approved</Badge> : <Badge tone="warning">Admin review</Badge>}
                    </div>
                    <p className="mt-2 text-sm">{p.scope}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">Available: {p.availability}</p>
                    <Button className="mt-3" disabled={!p.approved} onClick={() => acceptProposal(p.id)}>
                      {p.approved ? "Accept & book" : "Awaiting approval"}
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          ))}
          <section>
            <h2 className="font-display text-xl font-semibold">History ({done.length})</h2>
            <div className="mt-3 space-y-3">
              {done.map((b) => (
                <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="font-bold">{b.service_name} · <span className="font-mono text-sm">{b.booking_no}</span></p>
                  <div className="flex items-center gap-2">
                    <Badge tone={b.status === "completed" ? "success" : "warning"}>{b.status}</Badge>
                    <Link to={`/track/${b.booking_no}`}><Button variant="outline">Receipt</Button></Link>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-4">
          <Card className="bg-pine-950 p-5 text-white">
            <p className="text-xs font-extrabold tracking-widest text-marigold-300 uppercase">Loyalty</p>
            <p className="font-display mt-1 text-4xl font-semibold">{balance} <span className="text-lg">pts</span></p>
            <p className="mt-1 text-xs text-white/70">100 pts = Rs 50 off at checkout. Earned only on completed jobs.</p>
            <Link to="/rewards" className="mt-3 inline-block rounded-md bg-marigold-300 px-3 py-1.5 text-xs font-extrabold text-pine-950">View rewards</Link>
          </Card>
          <Card className="p-5">
            <p className="font-bold">Notifications</p>
            <ul className="mt-2 space-y-2 text-sm">
              {notes.length === 0 && <li className="text-on-surface-variant">All caught up.</li>}
              {notes.slice(0, 8).map((n) => (
                <li key={n.id} className="rounded-md bg-surface-container p-2.5">
                  <p className="font-bold">{n.title}</p>
                  <p className="text-xs text-on-surface-variant">{n.body}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Link to="/profile"><Button variant="outline" className="w-full">Addresses & profile</Button></Link>
        </aside>
      </div>
    </div>
  );
}

