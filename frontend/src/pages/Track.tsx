import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Price } from "../components/ui";
import { MiniMap } from "../components/MiniMap";
import { api, post } from "../lib/api";
import { formatSlot } from "../lib/format";
import type { Booking } from "../lib/types";

interface History {
  status: string;
  by_role: string;
  note: string;
  at: string;
}

const LABELS: Record<string, string> = {
  pending: "Requested",
  "awaiting-worker": "Finding your pro",
  confirmed: "Confirmed",
  "en-route": "Pro en route",
  "in-progress": "In progress",
  "awaiting-confirmation": "Completion review",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

export default function Track() {
  const { id } = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewMsg, setReviewMsg] = useState("");
  const [newSlot, setNewSlot] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  function reload() {
    api<{ booking: Booking; history: History[] }>(`/api/bookings/${id}`)
      .then((d) => { setBooking(d.booking); setHistory(d.history); })
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"));
  }

  useEffect(reload, [id]);

  async function transition(to: string, extra: Record<string, unknown> = {}) {
    setError("");
    try {
      await post(`/api/bookings/${id}/transition`, { to, ...extra });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function submitReview() {
    setReviewMsg("");
    try {
      await post("/api/reviews", { bookingId: id, rating, text: reviewText });
      setReviewMsg("Thanks — your review is live.");
    } catch (e) {
      setReviewMsg(e instanceof Error ? e.message : "Could not submit review");
    }
  }

  async function reschedule() {
    if (!newSlot) return;
    setError("");
    try {
      await api(`/api/bookings/${id}/slot`, {
        method: "PUT",
        body: JSON.stringify({ slot: new Date(newSlot).toISOString() }),
      });
      setRescheduling(false);
      setNewSlot("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reschedule failed");
    }
  }

  if (error && !booking) {
    return <div className="wrap py-12"><EmptyState title="Booking not found" body={error} /></div>;
  }
  if (!booking) return <p role="status" className="wrap py-12 text-center text-on-surface-variant">Loading…</p>;

  return (
    <div className="fade-up">
      <div className="wrap py-8">
        <Link to="/dashboard" className="text-sm font-bold text-primary hover:underline">← All bookings</Link>
        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold md:text-3xl">{booking.service_name}</h1>
              <Badge tone={booking.status === "completed" ? "success" : booking.status === "disputed" || booking.status === "cancelled" ? "error" : "info"}>
                {LABELS[booking.status] ?? booking.status}
              </Badge>
            </div>
            <p className="mt-1 font-mono text-sm text-on-surface-variant">{booking.booking_no}</p>
            <ol className="mt-6 space-y-0">
              {history.map((h, i) => (
                <li key={i} className="relative border-l-2 border-outline pb-5 pl-5 last:pb-0">
                  <span aria-hidden="true" className="absolute top-0.5 -left-[7px] size-3 rounded-full bg-primary" />
                  <p className="text-sm font-bold">{LABELS[h.status] ?? h.status}</p>
                  <p className="text-xs text-on-surface-variant">
                    {new Date(h.at).toLocaleString()} · by {h.by_role}{h.note ? ` — ${h.note}` : ""}
                  </p>
                </li>
              ))}
            </ol>
            {error && <p role="alert" className="mt-4 rounded-md bg-error-container p-3 text-sm font-medium text-error">{error}</p>}
            <div className="mt-6 flex flex-wrap gap-2">
              {["pending", "awaiting-worker", "confirmed"].includes(booking.status) && (
                <>
                  <Button variant="outline" onClick={() => setRescheduling((r) => !r)}>Reschedule</Button>
                  <Button variant="outline" onClick={() => transition("cancelled", { note: "cancelled by customer" })}>Cancel booking</Button>
                </>
              )}
              {["in-progress", "awaiting-confirmation"].includes(booking.status) && (
                <Button variant="outline" onClick={() => transition("disputed", { note: "raised by customer" })}>Report a problem</Button>
              )}
              {["completed", "cancelled"].includes(booking.status) && (
                <Link to={`/book/${booking.service_id}`}><Button>Book again</Button></Link>
              )}
            </div>
            {rescheduling && (
              <Card className="mt-3 flex flex-col gap-2 p-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="new-slot" className="mb-1.5 block text-sm font-semibold">New slot (at least an hour ahead)</label>
                  <input id="new-slot" type="datetime-local" value={newSlot} onChange={(e) => setNewSlot(e.target.value)}
                    className="w-full rounded-md border border-outline bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary" />
                </div>
                <Button onClick={reschedule} disabled={!newSlot}>Confirm move</Button>
              </Card>
            )}
            {booking.status === "completed" && (
              <Card className="mt-6 p-5">
                <p className="font-bold">Rate this job</p>
                <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setRating(s)} aria-label={`${s} stars`}
                      className={`rounded-md px-2.5 py-1.5 text-sm font-bold ${rating === s ? "bg-pine-950 text-white" : "bg-surface-container"}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)}
                  placeholder="How was the work?" rows={3}
                  className="mt-2 w-full rounded-md border border-outline px-3.5 py-2.5 text-sm outline-none focus:border-primary" />
                <Button className="mt-2" onClick={submitReview}>Submit review</Button>
                {reviewMsg && <p className="mt-2 text-sm font-medium">{reviewMsg}</p>}
              </Card>
            )}
          </div>
          <aside>
            <Card className="p-5 text-sm">
              <dl className="space-y-2.5">
                <div className="flex justify-between"><dt className="text-on-surface-variant">Pro</dt><dd className="font-semibold">{booking.worker_name ?? "Assigning…"}</dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Address</dt><dd className="text-right font-semibold">{booking.address_text}</dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Slot</dt><dd className="font-semibold">{formatSlot(booking.slot)}</dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Estimate</dt><dd><Price paisa={booking.estimate_paisa} /></dd></div>
                {booking.final_paisa != null && <div className="flex justify-between border-t border-outline pt-2"><dt className="text-on-surface-variant">Final</dt><dd><Price paisa={booking.final_paisa} /></dd></div>}
                <div className="flex justify-between"><dt className="text-on-surface-variant">Payment</dt><dd className="font-semibold capitalize">{booking.payment_method} · {booking.payment_status}</dd></div>
              </dl>
              <p className="mt-3 rounded-md bg-info-container p-3 text-xs leading-relaxed text-info">
                Completion needs your one-time code — sent to your notifications when the work ends.
                Share it only when the work is actually done. Problems after completion go through
                a support ticket linked to this booking.
              </p>
              {booking.lat != null && booking.lng != null && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-bold text-on-surface-variant uppercase">Job location</p>
                  <MiniMap pin={{ lat: booking.lat, lng: booking.lng }} />
                </div>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
