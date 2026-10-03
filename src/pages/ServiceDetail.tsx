import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, MapPin, XCircle } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Price, Rating, VerifyBadge } from "../components/ui";
import { CATEGORIES, REVIEWS, SERVICES, WORKERS, BOOKINGS } from "../data/mock";
import { isEligibleWorker } from "../lib/booking";
import { PRICING_EXPLAINERS, PRICING_LABELS } from "../lib/pricing";

export default function ServiceDetail() {
  const { id } = useParams();
  const service = SERVICES.find((s) => s.id === id);

  if (!service) {
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

  const category = CATEGORIES.find((c) => c.id === service.categoryId);
  const pros = WORKERS.filter(
    (w) => isEligibleWorker(w) && w.categoryIds.includes(service.categoryId),
  );
  const bookingIds = new Set(BOOKINGS.filter((b) => b.serviceId === service.id).map((b) => b.id));
  const reviews = REVIEWS.filter((r) => bookingIds.has(r.bookingId));
  const related = SERVICES.filter(
    (s) => s.categoryId === service.categoryId && s.id !== service.id,
  ).slice(0, 3);

  return (
    <div className="wrap fade-up py-10">
      <Link to="/services" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        <ArrowLeft size={15} aria-hidden="true" /> All services
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-xs font-bold tracking-widest text-primary uppercase">{category?.name}</p>
          <h1 className="mt-1 text-3xl font-bold text-balance">{service.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Rating value={service.rating} count={service.jobsDone} />
            <span className="flex items-center gap-1 text-sm text-on-surface-variant">
              <Clock size={14} aria-hidden="true" /> ~{Math.round(service.durationMin / 60)}h typical
            </span>
            <span className="flex items-center gap-1 text-sm text-on-surface-variant">
              <MapPin size={14} aria-hidden="true" /> {service.areas.join(", ")}
            </span>
          </div>
          <p className="mt-4 leading-relaxed">{service.description}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <CheckCircle2 size={17} className="text-success" aria-hidden="true" /> What&apos;s included
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
                {service.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <XCircle size={17} className="text-error" aria-hidden="true" /> Not included
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
                {service.exclusions.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Card>
          </div>

          <h2 className="mt-8 text-xl font-bold">Verified pros for this service ({pros.length})</h2>
          {pros.length === 0 ? (
            <p className="mt-2 text-sm text-on-surface-variant">
              No eligible pro right now — new bookings wait for admin assignment from the verified pool.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {pros.map((w) => (
                <Link key={w.id} to={`/workers/${w.id}`}>
                  <Card className="flex items-center gap-3 p-4 transition hover:border-primary">
                    <Avatar name={w.name} hue={w.avatarHue} />
                    <span>
                      <span className="block font-bold">{w.name}</span>
                      <Rating value={w.rating} count={w.jobsDone} />
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <h2 className="mt-8 text-xl font-bold">Customer reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className="mt-2 text-sm text-on-surface-variant">No reviews yet — be the first to book and review.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {reviews.map((r) => (
                <Card key={r.id} className="p-4">
                  <Rating value={r.rating} />
                  <p className="mt-1 text-sm">“{r.text}”</p>
                  <p className="mt-1 text-xs text-on-surface-variant">Verified booking {r.bookingId}</p>
                </Card>
              ))}
            </ul>
          )}
        </div>

        <aside>
          <Card className="sticky top-20 p-6">
            <Badge tone="info">{PRICING_LABELS[service.pricingModel]}</Badge>
            <p className="mt-2 text-3xl font-bold">
              <Price paisa={service.basePricePaisa} prefix={service.basePricePaisa > 0 ? "from " : ""} />
            </p>
            {service.unit && <p className="text-sm text-on-surface-variant">{service.unit}</p>}
            <p className="mt-3 rounded-md bg-surface-container p-3 text-sm text-on-surface-variant">
              {PRICING_EXPLAINERS[service.pricingModel]}
            </p>
            <div className="mt-4">
              <Link to={`/book/${service.id}`}>
                <Button className="w-full">Book now</Button>
              </Link>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-on-surface-variant">
              <VerifyBadge state="verified" /> Pros assigned are always verified
            </p>
          </Card>
        </aside>
      </div>

      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold">Related services</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {related.map((s) => (
              <Link key={s.id} to={`/services/${s.id}`}>
                <Card className="h-full p-5 transition hover:border-primary">
                  <h3 className="font-bold">{s.name}</h3>
                  <p className="mt-1 text-sm">
                    <Price paisa={s.basePricePaisa} prefix="from " />
                  </p>
                  <p className="mt-1"><Rating value={s.rating} /></p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
