import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Star, Check, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Price } from "../components/ui";
import { api } from "../lib/api";
import { formatNPR } from "../lib/format";
import type { Service } from "../lib/types";

interface Pro {
  id: string;
  name: string;
  bio: string;
  years_exp: number;
  rating: number;
  jobs_done: number;
}

interface Review {
  id: string;
  rating: number;
  text: string;
  booking_no: string;
}

export default function ServiceDetail() {
  const { id } = useParams();
  const [service, setService] = useState<(Service & { category_name?: string }) | null>(null);
  const [pros, setPros] = useState<Pro[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api<{ service: Service; pros: Pro[]; reviews: Review[] }>(`/api/services/${id}`)
      .then((d) => { setService(d.service); setPros(d.pros); setReviews(d.reviews); })
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return <div className="wrap py-12"><EmptyState title="Service not found" body="It may have been retired by our team." /></div>;
  }
  if (!service) return <p role="status" className="wrap py-12 text-center text-on-surface-variant">Loading…</p>;

  const isQuote = service.pricing_model === "custom-quote" || service.pricing_model === "inspection-quote";

  return (
    <div className="fade-up">
      <div className="wrap py-8">
        <Link to="/services" className="text-sm font-bold text-primary hover:underline">← All services</Link>
        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <div>
            <Badge tone="success">{service.category_name}</Badge>
            <h1 className="font-display mt-2 text-3xl font-semibold md:text-4xl">{service.name}</h1>
            <p className="mt-2 max-w-2xl leading-relaxed text-on-surface-variant">{service.description}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <p className="text-xs font-extrabold tracking-widest text-on-surface-variant uppercase">What's included</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {(service.requirements.length > 0 ? service.requirements : ["Trained verified pro", "Standard materials check", "Cleanup after work"]).map((r) => (
                    <li key={r} className="flex items-start gap-1.5"><Check size={15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /> {r}</li>
                  ))}
                </ul>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-extrabold tracking-widest text-on-surface-variant uppercase">Not included</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {(service.exclusions.length > 0 ? service.exclusions : ["Major parts (billed at MRP with your approval)"]).map((r) => (
                    <li key={r} className="flex items-start gap-1.5"><X size={15} className="mt-0.5 shrink-0 text-error" aria-hidden="true" /> {r}</li>
                  ))}
                </ul>
              </Card>
            </div>
            {pros.length > 0 && (
              <>
                <h2 className="mt-8 font-display text-xl font-semibold">Verified pros for this service</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {pros.map((p) => (
                    <Card key={p.id} className="p-4">
                      <p className="font-bold">{p.name}</p>
                      <p className="text-xs text-on-surface-variant">{p.years_exp} yrs experience · {p.jobs_done} jobs done</p>
                      {p.rating > 0 && <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold"><Star size={14} aria-hidden="true" /> {p.rating.toFixed(1)}</p>}
                    </Card>
                  ))}
                </div>
              </>
            )}
            {reviews.length > 0 && (
              <>
                <h2 className="mt-8 font-display text-xl font-semibold">Recent reviews</h2>
                <div className="mt-3 space-y-3">
                  {reviews.map((r) => (
                    <Card key={r.id} className="p-4">
                      <p className="inline-flex items-center gap-1 text-sm font-bold"><Star size={14} aria-hidden="true" /> {r.rating}/5 · {r.booking_no}</p>
                      <p className="mt-1 text-sm">{r.text || "—"}</p>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside className="lg:sticky lg:top-24">
            <Card className="elev-2 overflow-hidden">
              <div className="bg-pine-950 px-5 py-4">
                <p className="text-xs font-extrabold tracking-[0.14em] text-marigold-300 uppercase">Booking</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {isQuote ? "Custom quote" : formatNPR(service.base_price_paisa)}
                </p>
                <p className="text-xs text-white/70">{isQuote ? "Fixed price after site visit or photos" : "Estimate — confirmed before work closes"} · ~{service.duration_min} min</p>
              </div>
              <div className="space-y-2 p-5">
                {isQuote ? (
                  <Link to="/quotes/new"><Button className="w-full">Request a quote</Button></Link>
                ) : (
                  <Link to={`/book/${service.id}`}><Button className="w-full">Book now</Button></Link>
                )}
                <p className="text-center text-xs text-on-surface-variant">Damak wards 1–10 · Free cancellation before pro confirmation</p>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
