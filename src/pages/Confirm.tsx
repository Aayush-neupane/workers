import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button, Card, EmptyState, Price, StatusBadge } from "../components/ui";
import { SERVICES } from "../data/mock";
import { useStore } from "../lib/store";
import { earnPoints } from "../lib/booking";
import { formatSlot } from "../lib/format";

export default function Confirm() {
  const { id } = useParams();
  const { bookings, addresses } = useStore();
  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return (
      <div className="wrap py-12">
        <EmptyState
          title="Booking not found"
          body="It may have been cleared with site data."
          action={<Link to="/services"><Button>Browse services</Button></Link>}
        />
      </div>
    );
  }

  const service = SERVICES.find((s) => s.id === booking.serviceId);
  const address = addresses.find((a) => a.id === booking.addressId);

  return (
    <div className="wrap fade-up max-w-2xl py-12 text-center">
      <CheckCircle2 size={60} className="mx-auto text-success" aria-hidden="true" />
      <h1 className="font-display mt-3 text-4xl font-semibold">Booking confirmed</h1>
      <p className="mt-2 text-on-surface-variant">
        Booking <strong>{booking.id}</strong> · {service?.name} · {formatSlot(booking.slot)}
      </p>

      <Card className="mt-6 p-6 text-left">
        <h2 className="font-bold">What happens next</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-on-surface-variant">
          <li>Our team assigns a verified pro — you&apos;ll be notified on assignment.</li>
          <li>The pro confirms and arrives in your slot. Track every status live.</li>
          <li>
            {booking.paymentMethod === "cash"
              ? "Pay in cash on completion and get a receipt in your history."
              : "Online payment verified — receipt is already in your history."}
          </li>
          <li>Confirm completion, rate the job and earn ~{earnPoints(booking.estimatePaisa)} loyalty points.</li>
        </ol>
        <dl className="mt-4 space-y-2 border-t border-outline pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-on-surface-variant">Address</dt><dd className="font-semibold">{address ? `${address.line}, ${address.city}` : "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-on-surface-variant">Payment</dt><dd className="font-semibold">{booking.paymentMethod === "cash" ? "Cash" : booking.paymentMethod === "esewa" ? "eSewa (verified)" : "Khalti (verified)"}</dd></div>
          <div className="flex justify-between"><dt className="text-on-surface-variant">Status</dt><dd><StatusBadge status={booking.status} /></dd></div>
          <div className="flex justify-between text-base"><dt className="font-bold">Estimated total</dt><dd className="font-bold"><Price paisa={booking.estimatePaisa} /></dd></div>
        </dl>
      </Card>

      <div className="mt-6 flex justify-center gap-3">
        <Link to={`/track/${booking.id}`}>
          <Button>Track booking</Button>
        </Link>
        <Link to="/services">
          <Button variant="outline">Book another</Button>
        </Link>
      </div>
    </div>
  );
}
