import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, MapPin, ShieldCheck, XCircle } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHero,
  Rating,
} from "../components/ui";
import { api, toReview, toService, toWorker } from "../lib/api";
import type { Review, Service, Worker } from "../lib/types";
import { PRICING_EXPLAINERS, PRICING_LABELS } from "../lib/pricing";

export default function ServiceDetail() {
  const { id } = useParams();
  const [service, setService] = useState<Service | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [pros, setPros] = useState<Worker[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    setService(null);
    setMissing(false);
    api<{ service: unknown; pros: unknown[]; reviews: unknown[] }>(`/api/services/${id}`)
      .then((d) => {
        if (!live) return;
        const s = d.service as Parameters<typeof toService>[0];
        setService(toService(s));
        setCategoryName((s.category_name as string | undefined) ?? "");
        setPros((d.pros as Parameters<typeof toWorker>[0][]).map(toWorker));
        setReviews((d.reviews as Parameters<typeof toReview>[0][]).map(toReview));
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
          title="Service not found"
          body="This service may have been renamed or removed."
          action={<Link to="/services"><Button>Browse services</Button></Link>}
        />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="wrap py-12" role="status">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-1/2 rounded bg-surface-container-high" />
          <div className="h-4 w-full rounded bg-surface-container" />
          <div className="h-4 w-2/3 rounded bg-surface-container" />
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <PageHero
        eyebrow={categoryName || "Service"}
        title={service.name}
        body={service.description}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
          <Rating value={service.rating} />
          <span className="text-white/60">·</span>
          <span>{service.jobsDone.toLocaleString()} jobs done</span>
          <span className="text-white/60">·</span>
          <span className="flex items-center gap-1.5"><Clock size={14} aria-hidden="true" /> ~{Math.round(service.durationMin / 60)}h typical</span>
          <span className="text-white/60">·</span>
          <span className="flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" /> {service.areas.join(", ")}</span>
        </div>
      </PageHero>

      <div className="wrap py-10">
        <Link to="/services" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
          <ArrowLeft size={15} aria-hidden="true" /> All services
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-t-4 border-t-pine-800 p-6">
                <h2 className="flex items-center gap-2 font-bold">
                  <CheckCircle2 size={18} className="text-success" aria-hidden="true" /> Good to know
                </h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-on-surface-variant">
                  {service.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </Card>
              <Card className="border-t-4 border-t-marigold-500 p-6">
                <h2 className="flex items-center gap-2 font-bold">
                  <XCircle size={18} className="text-error" aria-hidden="true" /> Not included
                </h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-on-surface-variant">
                  {service.exclusions.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Card>
            </div>

            <h2 className="font-display mt-9 text-2xl font-semibold">Verified pros for this service ({pros.length})</h2>
            {pros.length === 0 ? (
              <p className="mt-2 text-sm text-on-surface-variant">
                No eligible pro right now — new bookings wait for admin assignment from the verified pool.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {pros.map((w) => (
                  <Link key={w.id} to={`/workers/${w.id}`}>
                    <Card className="elev-lift flex items-center gap-3.5 p-4">
                      <Avatar name={w.name} hue={w.avatarHue} size={52} ring />
                      <span>
                        <span className="block font-bold">{w.name}</span>
                        <Rating value={w.rating} count={w.jobsDone} />
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            <h2 className="font-display mt-9 text-2xl font-semibold">Customer reviews ({reviews.length})</h2>
            {reviews.length === 0 ? (
              <p className="mt-2 text-sm text-on-surface-variant">No reviews yet — be the first to book and review.</p>
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
          </div>

          <aside>
            <Card className="elev-2 sticky top-32 overflow-hidden">
              <div className="bg-pine-950 px-6 py-4">
                <Badge tone="marigold">{PRICING_LABELS[service.pricingModel]}</Badge>
                <p className="mt-2 text-white">
                  <span className="font-display text-4xl font-semibold tracking-tight">
                    {service.basePricePaisa > 0 ? `from Rs ${(service.basePricePaisa / 100).toLocaleString("en-IN")}` : "Custom quote"}
                  </span>
                </p>
                {service.unit && <p className="text-sm text-white/65">{service.unit}</p>}
              </div>
              <div className="p-6">
                <p className="rounded-md bg-surface-container p-3.5 text-[13px] leading-relaxed text-on-surface-variant">
                  {PRICING_EXPLAINERS[service.pricingModel]}
                </p>
                <div className="mt-4">
                  <Link to={`/book/${service.id}`}>
                    <Button className="w-full py-3">Book now</Button>
                  </Link>
                </div>
                <p className="mt-3.5 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                  <ShieldCheck size={14} className="text-success" aria-hidden="true" /> Assigned pros are always verified
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">Free cancellation before worker confirmation</p>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
