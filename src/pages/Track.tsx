import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, Dialog, EmptyState, PageHero, Price, StatusBadge, TextArea } from "../components/ui";
import { useStore } from "../lib/store";
import { STATUS_LABELS, canTransition } from "../lib/booking";
import { formatSlot } from "../lib/format";
import type { Booking, BookingStatus } from "../lib/types";

const CANCELLABLE: BookingStatus[] = ["pending", "awaiting-worker", "confirmed"];

export default function Track() {
  const { id } = useParams();
  const { fetchBooking, advanceBooking } = useStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [missing, setMissing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    const b = await fetchBooking(id ?? "");
    if (b) setBooking(b);
    else setMissing(true);
  }, [id, fetchBooking]);

  useEffect(() => {
    setBooking(null);
    setMissing(false);
    void load();
  }, [load]);

  if (missing) {
    return (
      <div className="wrap py-12">
        <EmptyState
          title="Booking not found"
          body="Check the booking ID or pick one from your dashboard."
          action={<Link to="/dashboard"><Button>Go to dashboard</Button></Link>}
        />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="wrap py-12" role="status">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-1/2 rounded bg-surface-container-high" />
          <div className="h-24 rounded-lg bg-surface-container" />
        </div>
      </div>
    );
  }

  const doAdvance = async (to: BookingStatus, noteText?: string) => {
    setActionError("");
    const ok = await advanceBooking(booking.id, to, { note: noteText });
    setConfirmCancel(false);
    setDisputeOpen(false);
    setNote("");
    if (ok) await load();
    else setActionError("That action isn't allowed right now — the booking may have moved on.");
  };

  return (
    <div className="fade-up">
      <PageHero
        eyebrow={`Booking ${booking.id}`}
        title={booking.serviceName ?? "Booking"}
        body={`${formatSlot(booking.slot)} · ${booking.workerName ?? "Assigning your pro…"}`}
      >
        <StatusBadge status={booking.status} />
      </PageHero>

      <div className="wrap max-w-3xl py-8">
      {actionError && (
        <p role="alert" className="mb-4 rounded-md bg-error-container p-3 text-sm font-medium text-error">
          {actionError}
        </p>
      )}
      <Card className="p-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-on-surface-variant">Slot</dt><dd className="font-semibold">{formatSlot(booking.slot)}</dd></div>
          <div><dt className="text-on-surface-variant">Address</dt><dd className="font-semibold">{booking.addressText || "—"}</dd></div>
          <div><dt className="text-on-surface-variant">Professional</dt><dd className="font-semibold">{booking.workerName ?? "Assigning…"}</dd></div>
          <div><dt className="text-on-surface-variant">Payment</dt><dd className="font-semibold">{booking.paymentMethod} · {booking.paymentStatus}</dd></div>
          <div><dt className="text-on-surface-variant">Estimate</dt><dd><Price paisa={booking.estimatePaisa} /></dd></div>
          <div><dt className="text-on-surface-variant">Final</dt><dd>{booking.finalPaisa !== undefined ? <Price paisa={booking.finalPaisa} /> : "Confirmed after the job"}</dd></div>
        </dl>
        <p className="mt-4 rounded-md bg-surface-container p-3 text-sm">
          <strong>Your instructions:</strong> {booking.instructions}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {CANCELLABLE.includes(booking.status) && canTransition(booking.status, "cancelled") && (
            <Button variant="outline" onClick={() => setConfirmCancel(true)}>Cancel booking</Button>
          )}
          {booking.status === "awaiting-confirmation" && (
            <Button onClick={() => void doAdvance("completed")}>Confirm completion</Button>
          )}
          {(booking.status === "in-progress" || booking.status === "awaiting-confirmation") && (
            <Button variant="danger" onClick={() => setDisputeOpen(true)}>Raise dispute</Button>
          )}
        </div>
        <p className="mt-3 text-xs text-on-surface-variant">
          Cancellation is free before worker dispatch; after dispatch, policy charges may apply.
        </p>
      </Card>

      <h2 className="font-display mt-8 text-2xl font-semibold">Progress</h2>
      <ol className="mt-4 space-y-0">
        {booking.history.map((h, i) => (
          <li key={`${h.status}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
            <span className="flex flex-col items-center" aria-hidden="true">
              <span className={`grid size-9 place-items-center rounded-full text-xs font-bold ${i === booking.history.length - 1 ? "bg-pine-950 text-marigold-300" : "bg-success-container text-on-primary-container"}`}>
                {i + 1}
              </span>
              {i < booking.history.length - 1 && <span className="w-0.5 flex-1 bg-outline" />}
            </span>
            <div className="pb-1">
              <p className="font-bold">{STATUS_LABELS[h.status]}</p>
              <p className="text-xs text-on-surface-variant">{formatSlot(h.at)} · by {h.by}</p>
              {h.note && <p className="mt-1 text-sm">{h.note}</p>}
            </div>
          </li>
        ))}
      </ol>

      {confirmCancel && (
        <Dialog title="Cancel this booking?" onClose={() => setConfirmCancel(false)}>
          <p className="text-sm text-on-surface-variant">
            Free cancellation applies before worker dispatch. Later cancellations may carry a visit charge per policy.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>Keep booking</Button>
            <Button variant="danger" onClick={() => void doAdvance("cancelled", "Cancelled by customer")}>Cancel booking</Button>
          </div>
        </Dialog>
      )}
      {disputeOpen && (
        <Dialog title="Raise a dispute" onClose={() => setDisputeOpen(false)}>
          <label className="block text-sm font-medium">
            What went wrong?
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Charged above the approved estimate" />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>Back</Button>
            <Button variant="danger" onClick={() => void doAdvance("disputed", note || "Disputed by customer")} disabled={note.trim().length < 5}>
              Submit dispute
            </Button>
          </div>
        </Dialog>
      )}
      </div>
    </div>
  );
}
