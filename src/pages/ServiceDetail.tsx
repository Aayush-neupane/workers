import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, MapPin, ShieldCheck, XCircle } from "lucide-react";
import {
  ArtTile,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHero,
  Price,
  Rating,
} from "../components/ui";
import { CATEGORY_HUES } from "../components/categoryIcons";
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
  const hue = CATEGORY_HUES[service.categoryId] ?? 150;
  const pros = WORKERS.filter(
    (w) => isEligibleWorker(w) && w.categoryIds.includes(service.categoryId),
  );
  const bookingIds = new Set(BOOKINGS.filter((b) => b.serviceId === service.id).map((b) => b.id));
  const reviews = REVIEWS.filter((r) => bookingIds.has(r.bookingId));
  const related = SERVICES.filter(
    (s) => s.categoryId === service.categoryId && s.id !== service.id,
  ).slice(0, 3);

  return (
    <div className="fade-up">
      <PageHero
        eyebrow={category?.name ?? "Service"}
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

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-2xl font-semibold">Related services</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {related.map((s) => (
                <Link key={s.id} to={`/services/${s.id}`}>
                  <Card className="elev-lift h-full p-5">
                    <ArtTile hue={hue} size={40}>
                      <span className="font-display text-lg font-semibold">{s.name[0]}</span>
                    </ArtTile>
                    <h3 className="mt-2.5 font-bold">{s.name}</h3>
                    <p className="mt-1"><Price paisa={s.basePricePaisa} prefix="from " /> · <Rating value={s.rating} /></p>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
