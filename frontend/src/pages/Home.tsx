import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShieldCheck, MapPin, Star, ArrowRight, ArrowUpRight, WifiOff, BadgeCheck } from "lucide-react";
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

interface Stats {
  services: number;
  verifiedPros: number;
  completedJobs: number;
  openWards: number;
  reviewCount: number;
  avgRating: number;
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

const FAQS = [
  {
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

const TICKER = [
  "Electrical", "Plumbing", "Deep cleaning", "Appliance repair", "Painting", "Carpentry",
  "Damak wards 1–10", "Invite-verified pros", "OTP-closed jobs", "Cash · eSewa · Khalti",
];

function SectionHead({ eyebrow, title, linkTo, linkLabel, light }: {
  eyebrow: string; title: string; linkTo?: string; linkLabel?: string; light?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className={`text-xs font-extrabold tracking-[0.16em] uppercase ${light ? "text-marigold-300" : "text-secondary"}`}>{eyebrow}</p>
        <h2 className={`font-display mt-1 text-2xl font-semibold md:text-3xl ${light ? "text-white" : ""}`}>{title}</h2>
      </div>
      {linkTo && (
        <Link to={linkTo} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          {linkLabel} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
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

  const heroService = popular[0] ?? null;

  return (
    <div className="fade-up">
      {/* ===== HERO — deep pine band ===== */}
      <section className="ring-band dotgrid-light relative overflow-hidden text-white">
        <span aria-hidden="true"
          className="font-display pointer-events-none absolute -right-6 -bottom-10 hidden text-[11rem] leading-none font-semibold text-white/[0.05] select-none lg:block">
          सजिलो
        </span>
        <div className="wrap relative grid items-center gap-10 py-14 md:grid-cols-[1.05fr_0.95fr] md:py-20">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-marigold-300">
              <ShieldCheck size={14} aria-hidden="true" /> 100% invite-verified professionals · Damak only
            </p>
            <h1 className="font-display mt-5 text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl md:text-6xl">
              The right pro for every{" "}
              <span className="relative inline-block text-marigold-300">
                Damak home
                <span aria-hidden="true" className="absolute inset-x-0 -bottom-1 h-2.5 rounded bg-marigold-300/25" />
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75 md:text-lg">
              Electrical, plumbing, cleaning, appliances and more — done by background-checked
              pros with upfront pricing and live job tracking across Damak wards 1–10.
            </p>
            <form
              className="elev-2 mt-7 flex max-w-lg gap-2 rounded-xl bg-white p-2"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/services?q=${encodeURIComponent(q)}`);
              }}
            >
              <label htmlFor="hero-search" className="sr-only">Search services</label>
              <div className="flex flex-1 items-center gap-2 px-2.5">
                <Search size={18} className="shrink-0 text-on-surface-variant" aria-hidden="true" />
                <input
                  id="hero-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="What needs fixing? e.g. tap repair…"
                  className="w-full bg-transparent py-2.5 text-sm text-on-surface outline-none"
                />
              </div>
              <Button type="submit" className="px-6 py-3">Search</Button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {cats.slice(0, 5).map((c) => (
                <Link key={c.id} to={`/services?category=${c.slug}`}
                  className="rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-bold text-white/85 transition hover:border-marigold-300 hover:text-marigold-300">
                  {c.name}
                </Link>
              ))}
            </div>
            {stats && (
              <dl className="mt-8 grid max-w-lg grid-cols-2 gap-4 border-t border-white/15 pt-5 sm:grid-cols-4" aria-label="Platform in numbers">
                {[
                  [`${stats.services}`, "Services"],
                  [`${stats.verifiedPros}`, "Verified pros"],
                  [`${stats.completedJobs}`, "Jobs done"],
                  [`${stats.openWards}/10`, "Wards open"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <dd className="font-display text-2xl font-semibold text-white md:text-3xl">{v}</dd>
                    <dt className="mt-0.5 text-[11px] font-bold tracking-wide text-white/60 uppercase">{l}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Hero art — coverage + OTP signature cards */}
          <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
            <Card className="elev-2 relative z-10 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-extrabold tracking-[0.14em] text-on-surface-variant uppercase">
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
                {heroService ? <>Booking now: <strong className="text-on-surface">{heroService.name}</strong> — every address checked ward-by-ward.</> : "Every address is checked ward-by-ward before a booking is accepted."}
              </p>
            </Card>
            <Card className="elev-2 relative z-10 mx-6 -mt-3 border-t-2 border-marigold-500 p-5">
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-on-surface-variant uppercase">
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
                No code, no completion.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ===== TICKER ===== */}
      <div className="ticker border-b border-pine-900 bg-pine-950 py-2.5" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((half) => (
            <span key={half} className="inline-flex shrink-0 items-center">
              {TICKER.map((t) => (
                <span key={`${half}-${t}`} className="mx-5 inline-flex items-center gap-5 text-xs font-extrabold tracking-[0.14em] whitespace-nowrap text-marigold-300/90 uppercase">
                  {t} <span className="text-white/25">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="wrap py-10 md:py-14">
        {loadError && (
          <p role="alert" className="mb-6 flex items-center gap-2 rounded-md bg-error-container p-3.5 text-sm font-medium text-error">
            <WifiOff size={16} aria-hidden="true" />
            Couldn't reach the server — is the API running on :4001 with the database migrated and seeded?
          </p>
        )}

        {/* ===== CATEGORIES ===== */}
        <SectionHead eyebrow="Trades" title="What do you need today?" linkTo="/services" linkLabel="All services" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cats.map((c) => {
            const Icon = categoryIcon(c.slug);
            const hue = categoryHue(c.slug);
            return (
              <Link key={c.id} to={`/services?category=${c.slug}`} className="group">
                <Card className="elev-lift h-full p-4">
                  <span
                    className="grid size-11 place-items-center rounded-xl"
                    style={{ backgroundColor: `hsl(${hue} 55% 88%)`, color: `hsl(${hue} 55% 26%)` }}
                    aria-hidden="true"
                  >
                    <Icon size={22} />
                  </span>
                  <p className="mt-3 font-extrabold">{c.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">{c.tagline}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-primary opacity-0 transition group-hover:opacity-100">
                    Explore <ArrowUpRight size={13} aria-hidden="true" />
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* ===== POPULAR ===== */}
        <div className="mt-12">
          <SectionHead eyebrow="Booked most" title="Popular in Damak" linkTo="/services" linkLabel="All services" />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {popular.map((s) => {
              const Icon = categoryIcon(s.category_slug ?? "");
              const hue = categoryHue(s.category_slug ?? "");
              const isQuote = s.pricing_model === "custom-quote" || s.pricing_model === "inspection-quote";
              return (
                <Link key={s.id} to={`/services/${s.id}`} className="group">
                  <Card className="elev-lift flex h-full flex-col p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold"
                        style={{ backgroundColor: `hsl(${hue} 55% 88%)`, color: `hsl(${hue} 55% 26%)` }}
                      >
                        <Icon size={13} aria-hidden="true" /> {s.category_name}
                      </span>
                      {s.rating > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold">
                          <Star size={13} aria-hidden="true" className="fill-marigold-500 text-marigold-500" /> {s.rating.toFixed(1)}
                          <span className="font-normal text-on-surface-variant">· {s.jobs_done} jobs</span>
                        </span>
                      )}
                    </div>
                    <p className="font-display mt-3 text-xl font-semibold">{s.name}</p>
                    <p className="mt-1 line-clamp-2 flex-1 text-sm text-on-surface-variant">{s.description}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-outline/60 pt-3.5">
                      {isQuote
                        ? <span className="text-sm font-extrabold text-secondary">Custom quote</span>
                        : <Price paisa={s.base_price_paisa} />}
                      <span className="inline-flex items-center gap-1 rounded-md bg-pine-950 px-3 py-1.5 text-xs font-extrabold text-white transition group-hover:bg-pine-800">
                        {isQuote ? "Get quote" : "Book"} <ArrowUpRight size={13} aria-hidden="true" />
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ===== HOW IT WORKS ===== */}
        <section className="ring-band dotgrid-light mt-12 rounded-2xl p-7 md:p-10" aria-label="How it works">
          <SectionHead light eyebrow="Process" title="From problem to booked in minutes" />
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {STEPS.map(([t, b], i) => (
              <div key={t} className="flex gap-3.5">
                <span aria-hidden="true" className="font-display grid size-10 shrink-0 place-items-center rounded-full bg-marigold-300 text-base font-bold text-pine-950">
                  {i + 1}
                </span>
                <div>
                  <p className="font-extrabold text-white">{t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/75">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== VERIFICATION + PROS ===== */}
        <section className="mt-12 grid items-start gap-6 lg:grid-cols-2" aria-label="Why trust us">
          <div>
            <SectionHead eyebrow="Trust machinery" title="Verified means verified" />
            <p className="mt-3 max-w-lg leading-relaxed text-on-surface-variant">
              Anyone can print "trusted" on a homepage. Here's the machinery behind ours —
              every step leaves an audit trail our team can show.
            </p>
            <div className="mt-6 space-y-5">
              {VERIFICATION_STEPS.map(([t, b], i) => (
                <div key={t} className="flex gap-3.5">
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-pine-950 text-sm font-extrabold text-marigold-300">
                    {i + 1}
                  </span>
                  <div className="border-b border-outline/60 pb-5">
                    <p className="font-extrabold">{t}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-on-surface-variant">{b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 lg:sticky lg:top-24">
            <Card className="ring-band dotgrid-light border-0 p-6 text-white md:p-8">
              <p className="text-xs font-extrabold tracking-[0.14em] text-marigold-300 uppercase">Are you a skilled pro?</p>
              <p className="font-display mt-2 text-2xl font-semibold">Good work deserves good work.</p>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                Steady Damak jobs, transparent per-job earnings, weekly settlements, no platform games.
                There is no public signup — introduce yourself and our team starts your verification.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/support"><Button className="bg-marigold-300 text-pine-950 hover:brightness-105">Talk to our team</Button></Link>
                <Link to="/services"><Button variant="outline" className="border-white/30 text-white hover:bg-white/10">See the trades</Button></Link>
              </div>
            </Card>
            <Card className="flex items-start gap-3 border-l-4 border-l-success p-5">
              <BadgeCheck size={22} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
              <p className="text-sm leading-relaxed">
                <strong>Completion codes close every job.</strong> Your pro can't mark work done —
                only the code sent to <em>you</em> can. {stats && stats.reviewCount > 0 && (
                  <>Customers rate {stats.avgRating.toFixed(1)}/5 across {stats.reviewCount} genuine reviews.</>
                )}
              </p>
            </Card>
          </div>
        </section>

        {/* ===== REVIEWS ===== */}
        {reviews.length > 0 && (
          <div className="mt-12">
            <SectionHead eyebrow="Proof" title="From completed jobs" />
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {reviews.map((r) => (
                <Card key={r.id} className="flex flex-col p-5">
                  <p className="inline-flex items-center gap-1 text-sm font-extrabold">
                    <Star size={14} aria-hidden="true" className="fill-marigold-500 text-marigold-500" /> {r.rating}/5
                  </p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed">"{r.text || "—"}"</p>
                  <p className="mt-3 border-t border-outline/60 pt-2.5 text-xs font-bold text-on-surface-variant">{r.worker_name} · {r.booking_no}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ===== FAQ ===== */}
        <div className="mt-12">
          <SectionHead eyebrow="Answers" title="Good questions" linkTo="/support" linkLabel="Ask support" />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {FAQS.map((f) => (
              <Card key={f.q} className="p-5">
                <p className="font-extrabold">{f.q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{f.a}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* ===== FINAL CTA ===== */}
        <section className="mt-12 overflow-hidden rounded-2xl border border-pine-900 bg-pine-950 text-white" aria-label="Get started">
          <div className="dotgrid-light grid items-center gap-6 p-7 md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <p className="text-xs font-extrabold tracking-[0.16em] text-marigold-300 uppercase">Damak wards 1–10 · Free cancellation before confirmation</p>
              <h2 className="font-display mt-2 text-2xl font-semibold md:text-3xl">Something broken right now?</h2>
              <p className="mt-2 max-w-xl leading-relaxed text-white/75">
                Fixed-price jobs book in four steps. Uncertain work goes through quotes you compare.
                Either way: Damak only, verified pros only.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
              <Link to="/services"><Button className="bg-marigold-300 px-8 py-3 text-pine-950 hover:brightness-105">Book a service</Button></Link>
              <Link to="/quotes/new"><Button variant="outline" className="border-white/30 px-8 py-3 text-white hover:bg-white/10">Request a quote</Button></Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
