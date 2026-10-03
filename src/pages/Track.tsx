import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, Dialog, EmptyState, Price, StatusBadge, TextArea } from "../components/ui";
import { SERVICES, WORKERS } from "../data/mock";
import { useStore } from "../lib/store";
import { STATUS_LABELS, canTransition } from "../lib/booking";
import { formatSlot } from "../lib/format";
import type { BookingStatus } from "../lib/types";

const CANCELLABLE: BookingStatus[] = ["pending", "awaiting-worker", "confirmed"];

export default function Track() {
  const { id } = useParams();
  const { bookings, addresses, advanceBooking } = useStore();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [note, setNote] = useState("");

  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
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

  const service = SERVICES.find((s) => s.id === booking.serviceId);
  const worker = WORKERS.find((w) => w.id === booking.workerId);
  const address = addresses.find((a) => a.id === booking.addressId);
  const actionable = true;

  const doAdvance = (to: BookingStatus, noteText?: string) => {
    advanceBooking(booking.id, to, "customer", noteText);
    setConfirmCancel(false);
    setDisputeOpen(false);
    setNote("");
  };

  return (
    <div className="wrap fade-up max-w-3xl py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-primary uppercase">Booking {booking.id}</p>
          <h1 className="text-3xl font-bold">{service?.name}</h1>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <Card className="mt-6 p-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-on-surface-variant">Slot</dt><dd className="font-semibold">{formatSlot(booking.slot)}</dd></div>
          <div><dt className="text-on-surface-variant">Address</dt><dd className="font-semibold">{address ? `${address.line}, ${address.city}` : "—"}</dd></div>
          <div><dt className="text-on-surface-variant">Professional</dt><dd className="font-semibold">{worker ? worker.name : "Assigning…"}</dd></div>
          <div><dt className="text-on-surface-variant">Payment</dt><dd className="font-semibold">{booking.paymentMethod} · {booking.paymentStatus}</dd></div>
          <div><dt className="text-on-surface-variant">Estimate</dt><dd><Price paisa={booking.estimatePaisa} /></dd></div>
          <div><dt className="text-on-surface-variant">Final</dt><dd>{booking.finalPaisa !== undefined ? <Price paisa={booking.finalPaisa} /> : "Confirmed after the job"}</dd></div>
        </dl>
        <p className="mt-4 rounded-md bg-surface-container p-3 text-sm">
          <strong>Your instructions:</strong> {booking.instructions}
        </p>

        {actionable ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {CANCELLABLE.includes(booking.status) && canTransition(booking.status, "cancelled") && (
              <Button variant="outline" onClick={() => setConfirmCancel(true)}>Cancel booking</Button>
            )}
            {booking.status === "awaiting-confirmation" && (
              <Button onClick={() => doAdvance("completed")}>Confirm completion</Button>
            )}
            {(booking.status === "in-progress" || booking.status === "awaiting-confirmation") && (
              <Button variant="danger" onClick={() => setDisputeOpen(true)}>Raise dispute</Button>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xs text-on-surface-variant">
            Cancellation is free before worker dispatch; after dispatch, policy charges may apply.
          </p>
        )}
      </Card>

      <h2 className="mt-8 text-xl font-bold">Progress</h2>
      <ol className="mt-4 space-y-0">
        {booking.history.map((h, i) => (
          <li key={`${h.status}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
            <span className="flex flex-col items-center" aria-hidden="true">
              <span className={`grid size-8 place-items-center rounded-full text-xs font-bold ${i === booking.history.length - 1 ? "bg-primary text-white" : "bg-success-container text-on-primary-container"}`}>
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
            <Button variant="danger" onClick={() => doAdvance("cancelled", "Cancelled by customer")}>Cancel booking</Button>
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
            <Button variant="danger" onClick={() => doAdvance("disputed", note || "Disputed by customer")} disabled={note.trim().length < 5}>
              Submit dispute
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
