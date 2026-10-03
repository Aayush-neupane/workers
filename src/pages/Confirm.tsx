import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button, Card, EmptyState, Price, StatusBadge } from "../components/ui";
import { api, toService } from "../lib/api";
import { useStore } from "../lib/store";
import { earnPoints } from "../lib/booking";
import { formatSlot } from "../lib/format";
import type { Booking, Service } from "../lib/types";

export default function Confirm() {
  const { id } = useParams();
  const { fetchBooking } = useStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    fetchBooking(id ?? "").then((b) => {
      if (!live) return;
      if (!b) {
        setMissing(true);
        return;
      }
      setBooking(b);
      api<{ service: unknown }>(`/api/services/${b.serviceId}`)
        .then((d) => {
          if (live) setService(toService(d.service as Parameters<typeof toService>[0]));
        })
        .catch(() => undefined);
    });
    return () => {
      live = false;
    };
  }, [id, fetchBooking]);

  if (missing) {
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

  if (!booking) {
    return (
      <div className="wrap py-12" role="status">
        <div className="animate-pulse space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-surface-container" />
          <div className="mx-auto h-8 w-64 rounded bg-surface-container-high" />
        </div>
      </div>
    );
  }

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
          <div className="flex justify-between"><dt className="text-on-surface-variant">Address</dt><dd className="font-semibold">{booking.addressText || "—"}</dd></div>
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
