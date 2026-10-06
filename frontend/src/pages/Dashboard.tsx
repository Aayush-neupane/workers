import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHero, Price } from "../components/ui";
import { api, post } from "../lib/api";
import { formatSlot } from "../lib/format";
import type { Booking, QuoteRequest } from "../lib/types";

interface Invite {
  id: string;
  name: string;
  email: string;
  expires_at: string;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [balance, setBalance] = useState(0);
  const [rules, setRules] = useState({ redeemPoints: 100, redeemDiscountPaisa: 5000 });
  const [notes, setNotes] = useState<{ id: string; title: string; body: string; is_read: boolean }[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  function reload() {
    setLoadError("");
    api<{ bookings: Booking[] }>("/api/bookings/mine").then((d) => setBookings(d.bookings)).catch(() => setLoadError("Couldn't load your bookings."));
    api<{ requests: QuoteRequest[] }>("/api/quotes/requests/mine").then((d) => setQuotes(d.requests)).catch(() => setLoadError("Couldn't load your quote requests."));
    api<{ balance: number }>("/api/rewards/mine").then((d) => setBalance(d.balance)).catch(() => {});
    api<{ redeemPoints: number; redeemDiscountPaisa: number }>("/api/settings")
      .then((d) => setRules({ redeemPoints: d.redeemPoints, redeemDiscountPaisa: d.redeemDiscountPaisa }))
      .catch(() => {});
    api<{ notifications: typeof notes }>("/api/notifications").then((d) => setNotes(d.notifications)).catch(() => {});
    api<{ invites: Invite[] }>("/api/worker/invites/mine").then((d) => setInvites(d.invites)).catch(() => {});
  }

  useEffect(reload, []);

  async function acceptInvite(id: string) {
    setActionError("");
    setRetryAction(null);
    try {
      await post(`/api/worker/invites/${id}/accept`, {});
      navigate("/worker", { replace: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not accept");
      setRetryAction(() => () => acceptInvite(id));
    }
  }

  async function acceptProposal(proposalId: string) {
    setActionError("");
    setRetryAction(null);
    try {
      const out = await post<{ bookingNo: string }>("/api/quotes/proposals/" + proposalId + "/accept", {});
      navigate(`/track/${out.bookingNo}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not accept");
      setRetryAction(() => () => acceptProposal(proposalId));
    }
  }

  const upcoming = bookings.filter((b) => !["completed", "cancelled"].includes(b.status));
  const done = bookings.filter((b) => ["completed", "cancelled"].includes(b.status));
  const activeQuotes = quotes.filter((q) => q.status !== "accepted" && q.status !== "cancelled");
  const pastQuotes = quotes.filter((q) => q.status === "accepted" || q.status === "cancelled");

  return (
    <div className="fade-up">
      <PageHero eyebrow="Customer portal" title="Your bookings" body="Track jobs live, compare quote proposals, and spend loyalty points." />
      <div className="wrap grid items-start gap-5 py-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          {loadError && (
            <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-error-container p-3.5 text-sm font-medium text-error">
              {loadError}
              <Button variant="outline" onClick={reload}>Retry</Button>
            </p>
          )}
          {actionError && (
            <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-error-container p-3.5 text-sm font-medium text-error">
              {actionError}
              {retryAction && <Button variant="outline" onClick={() => retryAction()}>Retry</Button>}
            </p>
          )}
          {invites.length > 0 && (
            <section aria-label="Professional invitations">
              {invites.map((inv) => (
                <Card key={inv.id} className="border-l-4 border-l-success p-5">
                  <p className="flex items-center gap-1.5 font-bold">
                    <BadgeCheck size={18} aria-hidden="true" className="text-success" />
                    Invited as a professional
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                    Our office verified your application. Accept to open the pro portal —
                    verification decides when you start receiving jobs. Expires {new Date(inv.expires_at).toLocaleDateString()}.
                  </p>
                  <Button className="mt-3" onClick={() => acceptInvite(inv.id)}>Accept & open pro portal</Button>
                </Card>
              ))}
            </section>
          )}
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
          {activeQuotes.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold">Quotes waiting on you ({activeQuotes.length})</h2>
              <div className="mt-3 space-y-3">
                {activeQuotes.map((q) => (
                  <Card key={q.id} className="p-4">
                    <p className="font-bold">Quote: {q.title}</p>
                    {(q.proposals ?? []).length === 0 && (
                      <p className="mt-1 text-sm text-on-surface-variant">Verified pros in Damak are reviewing your request.</p>
                    )}
                    {(q.proposals ?? []).map((p) => (
                      <div key={p.id} className="mt-3 rounded-md bg-surface-container/60 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Price paisa={p.price_paisa} />
                          {p.approved ? <Badge tone="success">Approved</Badge> : <Badge tone="warning">Admin review</Badge>}
                        </div>
                        <p className="mt-2 text-sm">{p.scope}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">Available: {p.availability}</p>
                        <Button className="mt-3" disabled={!p.approved} onClick={() => acceptProposal(p.id)}>
                          {p.approved ? "Accept & book" : "Awaiting approval"}
                        </Button>
                      </div>
                    ))}
                  </Card>
                ))}
              </div>
            </section>
          )}
          {pastQuotes.length > 0 && (
            <details>
              <summary className="cursor-pointer font-display text-xl font-semibold">Past quotes ({pastQuotes.length})</summary>
              <div className="mt-3 space-y-3">
                {pastQuotes.map((q) => (
                  <Card key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-bold">{q.title}</p>
                      <p className="text-xs text-on-surface-variant">{(q.proposals ?? []).length} proposal(s)</p>
                    </div>
                    <Badge tone={q.status === "accepted" ? "success" : "warning"}>{q.status}</Badge>
                  </Card>
                ))}
              </div>
            </details>
          )}
          {done.length > 0 && (
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
          )}
        </div>
        <aside className="space-y-4">
          <div className="rounded-lg bg-pine-950 p-5 text-white">
            <p className="text-xs font-extrabold tracking-widest text-marigold-300 uppercase">Loyalty</p>
            <p className="font-display mt-1 text-4xl font-semibold">{balance} <span className="text-lg">pts</span></p>
            <p className="mt-1 text-xs text-white/70">{rules.redeemPoints} pts = Rs {rules.redeemDiscountPaisa / 100} off at checkout. Earned only on completed jobs.</p>
            <Link to="/rewards" className="mt-3 inline-block rounded-md bg-marigold-300 px-3 py-1.5 text-xs font-extrabold text-pine-950">View rewards</Link>
          </div>
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

