import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShieldCheck, MapPin, Star, ArrowRight } from "lucide-react";
import { Button, Card, Badge, PageHero, Price } from "../components/ui";
import { api } from "../lib/api";
import type { Category, Service } from "../lib/types";

interface Review {
  id: string;
  rating: number;
  text: string;
  booking_no: string;
  worker_name: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [popular, setPopular] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    api<{ categories: Category[] }>("/api/categories").then((d) => setCats(d.categories)).catch(() => {});
    api<{ services: Service[] }>("/api/services?sort=popular").then((d) => setPopular(d.services.slice(0, 6))).catch(() => {});
    api<{ reviews: Review[] }>("/api/reviews?limit=3").then((d) => setReviews(d.reviews)).catch(() => {});
  }, []);

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Damak Municipality only · wards 1–10"
        title="Ramro Sewa, Sajilo Jeevan."
        body="Book verified electricians, plumbers, cleaners and more — pros invited and background-checked by our Damak team, never self-registered."
      />
      <div className="wrap -mt-0 py-8">
        <form
          className="elev-2 mx-auto flex max-w-2xl items-center gap-2 rounded-lg border border-outline bg-white p-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/services?q=${encodeURIComponent(q)}`);
          }}
          role="search"
        >
          <Search size={18} className="ml-2 shrink-0 text-on-surface-variant" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What needs fixing? e.g. tap repair, home cleaning…"
            aria-label="Search services"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
          <Button type="submit">Search</Button>
        </form>

        <h2 className="mt-10 font-display text-2xl font-semibold">What do you need today?</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cats.map((c) => (
            <Link key={c.id} to={`/services?category=${c.slug}`}>
              <Card className="h-full p-4 transition hover:border-pine-800">
                <p className="font-bold">{c.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{c.tagline}</p>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold">Popular in Damak</h2>
          <Link to="/services" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
            All services <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {popular.map((s) => (
            <Link key={s.id} to={`/services/${s.id}`}>
              <Card className="h-full p-5 transition hover:border-pine-800">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="success">{s.category_name}</Badge>
                  {s.rating > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold">
                      <Star size={13} aria-hidden="true" /> {s.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-bold">{s.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{s.description}</p>
                <p className="mt-3"><Price paisa={s.base_price_paisa} /></p>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {[
            ["1. Pick a service", "Fixed-price jobs book in four steps; complex jobs go through quotes you compare."],
            ["2. We assign a verified pro", "Every pro is invited, document-checked and activated by our team."],
            ["3. Code closes the job", "You share a one-time code only when the work is done. No code, no completion."],
          ].map(([t, b]) => (
            <Card key={t} className="p-5">
              <p className="font-bold">{t}</p>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{b}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-10 flex flex-col gap-3 bg-pine-950 p-6 text-white md:flex-row md:items-center">
          <ShieldCheck size={28} className="shrink-0 text-marigold-300" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-white/85">
            <strong className="text-white">Verified means verified.</strong> Identity documents,
            trade qualifications and background checks are reviewed before any pro touches a booking —
            and only genuine reviews from completed jobs appear below.
          </p>
        </Card>

        {reviews.length > 0 && (
          <>
            <h2 className="mt-10 font-display text-2xl font-semibold">From completed jobs</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {reviews.map((r) => (
                <Card key={r.id} className="p-5">
                  <p className="inline-flex items-center gap-1 text-sm font-bold">
                    <Star size={14} aria-hidden="true" /> {r.rating}/5
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{r.text || "—"}</p>
                  <p className="mt-3 text-xs text-on-surface-variant">{r.worker_name} · {r.booking_no}</p>
                </Card>
              ))}
            </div>
          </>
        )}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-on-surface-variant">
          <MapPin size={13} aria-hidden="true" /> Same-day windows across Damak · Free cancellation before pro confirmation
        </p>
      </div>
    </div>
  );
}
