import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, MapPin, ShieldCheck } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Price, Rating, VerifyBadge } from "../components/ui";
import { api, toCategory, toReview, toService, toWorker } from "../lib/api";
import type { Review, Service, ServiceCategory, Worker } from "../lib/types";
import { formatDate } from "../lib/format";

export default function WorkerProfile() {
  const { id } = useParams();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [cats, setCats] = useState<ServiceCategory[]>([]);
  const [offered, setOffered] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligible, setEligible] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    setWorker(null);
    setMissing(false);
    api<{ worker: unknown; categories: unknown[]; offered: unknown[]; reviews: unknown[]; eligible: boolean }>(
      `/api/workers/${id}`,
    )
      .then((d) => {
        if (!live) return;
        setWorker(toWorker(d.worker as Parameters<typeof toWorker>[0]));
        setCats((d.categories as Parameters<typeof toCategory>[0][]).map(toCategory));
        setOffered((d.offered as Parameters<typeof toService>[0][]).map(toService));
        setReviews((d.reviews as Parameters<typeof toReview>[0][]).map(toReview));
        setEligible(d.eligible);
      })
      .catch(() => {
        if (live) setMissing(true);
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (missing) {
    return (
      <div className="wrap py-12">
        <EmptyState
          title="Professional not found"
          body="This profile may have been removed."
          action={<Link to="/services"><Button>Browse services</Button></Link>}
        />
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="wrap py-12" role="status">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-1/3 rounded bg-surface-container-high" />
          <div className="h-4 w-full rounded bg-surface-container" />
        </div>
      </div>
    );
  }

  return (
    <div className="wrap fade-up py-10">
      <Link to="/services" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
        <ArrowLeft size={15} aria-hidden="true" /> Back to services
      </Link>

      <Card className="elev-2 mt-4 overflow-hidden">
        <div className="ring-band dotgrid-light px-6 py-8 md:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar name={worker.name} hue={worker.avatarHue} size={92} ring />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-3xl font-semibold text-white">{worker.name}</h1>
                <VerifyBadge state={worker.verification} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cats.map((c) => (
                  <Badge key={c.id} tone="marigold">{c.name}</Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-white/10 px-5 py-3 text-center backdrop-blur-[1px] sm:text-right">
              {worker.jobsDone > 0 ? (
                <>
                  <p className="font-display text-3xl font-semibold text-white">{worker.rating.toFixed(1)}</p>
                  <p className="text-xs font-semibold tracking-wide text-white/70 uppercase">{worker.jobsDone} jobs</p>
                </>
              ) : (
                <p className="text-sm text-white/70">No jobs yet</p>
              )}
            </div>
          </div>
        </div>
        <div className="p-6 md:px-8">
          <p className="max-w-2xl leading-relaxed text-on-surface-variant">{worker.bio}</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <Briefcase size={15} className="text-primary" aria-hidden="true" /> {worker.yearsExp} years experience
            </span>
            {worker.areas.length > 0 && (
              <span className="flex items-center gap-1.5">
                <MapPin size={15} className="text-primary" aria-hidden="true" /> {worker.areas.join(", ")}
              </span>
            )}
            <span className="text-on-surface-variant">Member since {formatDate(worker.joinedAt)}</span>
          </div>
          {!eligible && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-warning-container p-3.5 text-sm text-warning" role="note">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              This professional is not currently eligible for new assignments ({worker.verification}). Only verified, active pros receive bookings.
            </p>
          )}
        </div>
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-semibold">Services offered</h2>
          <div className="mt-4 grid gap-3">
            {offered.map((s) => (
              <Link key={s.id} to={`/services/${s.id}`}>
                <Card className="elev-lift flex items-center justify-between gap-3 p-4">
                  <span>
                    <span className="block font-bold">{s.name}</span>
                    <Rating value={s.rating} />
                  </span>
                  <Price paisa={s.basePricePaisa} prefix="from " />
                </Card>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">Reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className="mt-3 text-sm text-on-surface-variant">No reviews yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reviews.map((r) => (
                <Card key={r.id} className="p-5">
                  <Rating value={r.rating} />
                  <p className="font-display mt-1.5 text-[17px] leading-snug">“{r.text}”</p>
                  <p className="mt-1.5 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">Verified booking {r.bookingId}</p>
                </Card>
              ))}
            </ul>
          )}
          {eligible && offered[0] && (
            <div className="mt-5">
              <Link to={`/book/${offered[0].id}`}>
                <Button>Book {worker.name.split(" ")[0]}&apos;s service</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
