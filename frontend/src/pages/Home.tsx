import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShieldCheck, MapPin, Star, ArrowRight, WifiOff } from "lucide-react";
import { Button, Card, Badge, Price } from "../components/ui";
import { categoryHue, categoryIcon } from "../components/categoryIcons";
import { api } from "../lib/api";
import type { Category, Service } from "../lib/types";

interface Review {
  id: string;
  rating: number;
  text: string;
  booking_no: string;
  worker_name: string;
}

const STEPS = [
  ["Pick a service", "Fixed-price jobs book in four steps; complex jobs go through quotes you compare."],
  ["We assign a verified pro", "Every pro is invited, document-checked and activated by our Damak team."],
  ["A code closes the job", "You share a one-time code only when the work is done. No code, no completion."],
];

const VERIFICATION_STEPS = [
  ["Invite only", "Admins create every pro account. There is no public pro signup — ever."],
  ["Documents", "Citizenship, trade certificates and references, stored privately with narrow access."],
  ["Background check", "Identity and background review by a verification officer before anything else."],
  ["Activate", "Only verified + activated pros can be assigned. Suspension is one click away."],
];

interface Stats {
  services: number;
  verifiedPros: number;
  completedJobs: number;
  openWards: number;
  reviewCount: number;
  avgRating: number;
}

const FAQS = [  {
    q: "Are pros really verified?",
    a: "Yes. Admins invite every pro and review identity, qualifications and background checks before activation. Unverified accounts can never receive jobs.",
  },
  {
    q: "What if the final price differs from the estimate?",
    a: "The estimate is confirmed with you before the job closes. Disputed jobs pause settlement until support resolves them — history is never rewritten.",
  },
  {
    q: "Which payments do you accept?",
    a: "Cash on completion, plus eSewa and Khalti where configured. Online payments are verified server-side before a job reads paid.",
  },
];

function HeroArt({ service, openWards }: { service: Service | null; openWards: number | null }) {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="dotgrid absolute -inset-6 rounded-lg" />
      {/* Coverage card — the Damak-only promise, visualized */}
      <Card className="elev-2 relative p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-extrabold tracking-[0.14em] text-on-surface-variant uppercase">
            Coverage · Damak Municipality
          </p>
          <Badge tone="success"><MapPin size={12} /> {openWards ?? 10}/10 wards</Badge>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className={`grid aspect-square place-items-center rounded-md text-xs font-extrabold ${
                openWards === null || i < openWards
                  ? "bg-primary-container text-on-primary-container"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          {service ? <>Booking now: <strong className="text-on-surface">{service.name}</strong> — every address checked ward-by-ward.</> : "Every address is checked ward-by-ward before a booking is accepted."}
        </p>
      </Card>
      {/* OTP card — the Sajilo signature */}
      <Card className="elev-2 relative mx-6 -mt-3 border-t-2 border-marigold-500 p-5">
        <p className="text-xs font-extrabold tracking-[0.14em] text-on-surface-variant uppercase">
          How jobs close here
        </p>
        <div className="mt-3 flex gap-1.5">
          {["4", "9", "2", "0", "7", "1"].map((d, i) => (
            <span key={i} className="grid size-9 place-items-center rounded-md bg-pine-950 font-mono text-base font-bold text-marigold-300">
              {d}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-on-surface-variant">
          A one-time code reaches <strong className="text-on-surface">only you</strong> when the work ends.
          No code, no completion — satisfaction can't be faked.
        </p>
      </Card>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [popular, setPopular] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [openWards, setOpenWards] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api<{ categories: Category[] }>("/api/categories").then((d) => setCats(d.categories)).catch(() => setLoadError("server"));
    api<{ services: Service[] }>("/api/services?sort=popular").then((d) => setPopular(d.services.slice(0, 6))).catch(() => setLoadError("server"));
    api<{ reviews: Review[] }>("/api/reviews?limit=3").then((d) => setReviews(d.reviews)).catch(() => {});
    api<{ wards: { ward: number; is_open: boolean }[] }>("/api/wards")
      .then((d) => setOpenWards(d.wards.filter((w) => w.is_open).length)).catch(() => {});
    api<Stats>("/api/stats").then(setStats).catch(() => {});
  }, []);

  return (
    <div className="fade-up">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-outline">
        <div className="dotgrid absolute inset-0" aria-hidden="true" />
        <div className="wrap relative grid items-center gap-12 py-14 md:grid-cols-[1.05fr_0.95fr] md:py-20">
          <div>
            <Badge tone="success"><ShieldCheck size={13} aria-hidden="true" /> 100% invite-verified professionals</Badge>
            <h1 className="font-display mt-5 text-5xl leading-[1.04] font-semibold text-balance md:text-6xl">
              The right pro for every{" "}
              <span className="relative inline-block">
                Damak home
                <span aria-hidden="true" className="absolute inset-x-0 -bottom-1 h-3 bg-marigold-300/70" />
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-on-surface-variant">
              Electrical, plumbing, cleaning, appliances and more — done by background-checked
              pros with upfront pricing and live job tracking across Damak wards 1–10.
            </p>
            <form
              className="mt-7 flex max-w-lg gap-2"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/services?q=${encodeURIComponent(q)}`);
              }}
            >
              <label htmlFor="hero-search" className="sr-only">Search services</label>
              <div className="elev-1 flex flex-1 items-center gap-2 rounded-lg border border-outline bg-white px-4">
                <Search size={18} className="shrink-0 text-on-surface-variant" aria-hidden="true" />
                <input
                  id="hero-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="What needs fixing? e.g. tap repair…"
                  className="w-full bg-transparent py-3 text-sm outline-none"
                />
              </div>
              <Button type="submit" className="px-6">Search</Button>
            </form>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-on-surface-variant">
              <MapPin size={13} aria-hidden="true" /> Damak Municipality only · Free cancellation before pro confirmation
            </p>
          </div>
          <HeroArt service={popular[0] ?? null} openWards={openWards} />
        </div>
      </section>

      <div className="wrap py-10">
        {loadError && (
          <p role="alert" className="mb-6 flex items-center gap-2 rounded-md bg-error-container p-3.5 text-sm font-medium text-error">
            <WifiOff size={16} aria-hidden="true" />
            Couldn't reach the server — is the API running on :4001 with the database migrated and seeded?
          </p>
        )}

        {stats && (
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-outline/60 bg-white p-5 sm:grid-cols-3 lg:grid-cols-6" aria-label="Platform in numbers">
            {[
              [`${stats.services}`, "Services live"],
              [`${stats.verifiedPros}`, "Verified pros"],
              [`${stats.completedJobs}`, "Jobs completed"],
              [`${stats.openWards}/10`, "Wards open"],
              [stats.reviewCount > 0 ? stats.avgRating.toFixed(1) : "—", "Average rating"],
              [`${stats.reviewCount}`, "Genuine reviews"],
            ].map(([v, l]) => (
              <div key={l} className="text-center">
                <dd className="font-display text-3xl font-semibold">{v}</dd>
                <dt className="mt-0.5 text-xs font-bold text-on-surface-variant uppercase tracking-wide">{l}</dt>
              </div>
            ))}
          </dl>
        )}

        <h2 className="font-display text-2xl font-semibold">What do you need today?</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cats.map((c) => {
            const Icon = categoryIcon(c.slug);
            const hue = categoryHue(c.slug);
            return (
              <Link key={c.id} to={`/services?category=${c.slug}`}>
                <Card className="elev-lift h-full p-4">
                  <span
                    className="grid size-10 place-items-center rounded-lg"
                    style={{ backgroundColor: `hsl(${hue} 55% 88%)`, color: `hsl(${hue} 55% 28%)` }}
                    aria-hidden="true"
                  >
                    <Icon size={20} />
                  </span>
                  <p className="mt-2.5 font-bold">{c.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">{c.tagline}</p>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold">Popular in Damak</h2>
          <Link to="/services" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
            All services <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {popular.map((s) => {
            const Icon = categoryIcon(s.category_slug ?? "");
            const hue = categoryHue(s.category_slug ?? "");
            return (
              <Link key={s.id} to={`/services/${s.id}`}>
                <Card className="elev-lift h-full p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ backgroundColor: `hsl(${hue} 55% 88%)`, color: `hsl(${hue} 55% 28%)` }}
                    >
                      <Icon size={13} aria-hidden="true" /> {s.category_name}
                    </span>
                    {s.rating > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold">
                        <Star size={13} aria-hidden="true" /> {s.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 font-bold">{s.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{s.description}</p>
                  <p className="mt-3">
                    {s.pricing_model === "custom-quote" || s.pricing_model === "inspection-quote" ? (
                      <span className="text-sm font-bold text-secondary">Custom quote</span>
                    ) : (
                      <Price paisa={s.base_price_paisa} />
                    )}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* How it works */}
        <section className="ring-band dotgrid-light mt-12 rounded-lg p-7 md:p-10" aria-label="How it works">
          <h2 className="font-display text-2xl font-semibold text-white">From problem to booked in minutes</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {STEPS.map(([t, b], i) => (
              <div key={t} className="flex gap-3">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-marigold-300 text-sm font-extrabold text-pine-950">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold text-white">{t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/75">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {reviews.length > 0 && (
          <>
            <h2 className="mt-10 font-display text-2xl font-semibold">From completed jobs</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {reviews.map((r) => (
                <Card key={r.id} className="p-5">
                  <p className="inline-flex items-center gap-1 text-sm font-bold">
                    <Star size={14} aria-hidden="true" className="fill-marigold-500 text-marigold-500" /> {r.rating}/5
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{r.text || "—"}</p>
                  <p className="mt-3 text-xs text-on-surface-variant">{r.worker_name} · {r.booking_no}</p>
                </Card>
              ))}
            </div>
          </>
        )}

        <section className="mt-10 grid items-start gap-5 lg:grid-cols-2" aria-label="Why trust us">
          <div>
            <h2 className="font-display text-2xl font-semibold">Verified means verified</h2>
            <p className="mt-2 max-w-lg leading-relaxed text-on-surface-variant">
              Anyone can print "trusted" on a homepage. Here's the machinery behind ours —
              every step leaves an audit trail our team can show.
            </p>
            <div className="mt-5 space-y-4">
              {VERIFICATION_STEPS.map(([t, b], i) => (
                <div key={t} className="flex gap-3">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-pine-950 text-sm font-extrabold text-marigold-300">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-bold">{t}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-on-surface-variant">{b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Card className="ring-band dotgrid-light border-0 p-6 text-white md:p-8 lg:sticky lg:top-24">
            <p className="text-xs font-extrabold tracking-[0.14em] text-marigold-300 uppercase">Are you a skilled pro?</p>
            <p className="font-display mt-2 text-2xl font-semibold">Good work deserves good work.</p>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              We invite electricians, plumbers, cleaners and more — steady Damak jobs, transparent
              per-job earnings, weekly settlements, no platform games. There is no public signup:
              introduce yourself and our team starts your verification.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/support"><Button className="bg-marigold-300 text-pine-950 hover:brightness-105">Talk to our team</Button></Link>
              <Link to="/services"><Button variant="outline" className="border-white/30 text-white hover:bg-white/10">See the trades</Button></Link>
            </div>
          </Card>
        </section>

        <h2 className="mt-10 font-display text-2xl font-semibold">Good questions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {FAQS.map((f) => (
            <Card key={f.q} className="p-5">
              <p className="font-bold">{f.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{f.a}</p>
            </Card>
          ))}
        </div>

        <section className="mt-10 overflow-hidden rounded-lg border border-outline/60 bg-white" aria-label="Get started">
          <div className="grid items-center gap-6 p-7 md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <h2 className="font-display text-2xl font-semibold md:text-3xl">Something broken right now?</h2>
              <p className="mt-2 max-w-xl leading-relaxed text-on-surface-variant">
                Fixed-price jobs book in four steps. Uncertain, variable work goes through quotes
                you compare side by side. Either way: Damak only, verified pros only.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
              <Link to="/services"><Button className="px-8 py-3">Book a service</Button></Link>
              <Link to="/quotes/new"><Button variant="outline" className="px-8 py-3">Request a quote</Button></Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
