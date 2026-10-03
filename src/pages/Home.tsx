import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";
import {
  ArtTile,
  Avatar,
  Badge,
  Button,
  Card,
  Price,
  Rating,
  SectionHead,
  StatusBadge,
} from "../components/ui";
import { Reveal } from "../components/Reveal";
import { CATEGORY_HUES, CATEGORY_ICONS } from "../components/categoryIcons";
import { api, toCategory, toReview, toService, toWorker } from "../lib/api";
import type { Review, Service, ServiceCategory, Worker } from "../lib/types";

function useCatalog() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [c, s, w, r] = await Promise.all([
          api<{ categories: unknown[] }>("/api/categories"),
          api<{ services: unknown[] }>("/api/services?sort=popular"),
          api<{ workers: unknown[] }>("/api/workers?eligible=1"),
          api<{ reviews: unknown[] }>("/api/reviews?limit=2"),
        ]);
        if (!live) return;
        setCategories((c.categories as Parameters<typeof toCategory>[0][]).map(toCategory));
        setServices((s.services as Parameters<typeof toService>[0][]).map(toService));
        setWorkers((w.workers as Parameters<typeof toWorker>[0][]).map(toWorker));
        setReviews((r.reviews as Parameters<typeof toReview>[0][]).map(toReview));
      } catch {
        /* sections render empty on failure */
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return { categories, services, workers, reviews };
}

const STEPS = [
  {
    title: "Pick a service",
    body: "Twelve categories with upfront pricing — fixed, hourly or inspection-first. No hidden charges, ever.",
  },
  {
    title: "Choose your slot",
    body: "Same-day and next-day windows across Damak. Add photos and notes so the pro arrives prepared.",
  },
  {
    title: "A verified pro arrives",
    body: "Only background-checked professionals get assignments. Watch every status change live.",
  },
  {
    title: "Pay & review",
    body: "Cash, eSewa or Khalti. Confirm completion, rate the real job and earn loyalty points.",
  },
];

const FAQS = [
  {
    q: "Are workers really verified?",
    a: "Yes. Admins create every worker account and run identity, reference and background checks before activation. Unverified workers can never receive jobs.",
  },
  {
    q: "What if the final price differs from the estimate?",
    a: "Workers must get your approval for any change above the estimate. You confirm the final amount before the job closes — disputed jobs pause settlement until resolved.",
  },
  {
    q: "Which payments do you accept?",
    a: "Cash on completion, plus eSewa and Khalti on eligible bookings. Online payments are verified server-side before a job is marked paid.",
  },
];

function HeroArt() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="dotgrid absolute -inset-6 rounded-lg" />
      <Card className="elev-2 relative rotate-[-1.5deg] p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-extrabold tracking-[0.14em] text-on-surface-variant uppercase">
            Live booking · BK-1057
          </p>
          <StatusBadge status="in-progress" />
        </div>
        <p className="font-display mt-2 text-2xl font-semibold">Full Home Deep Clean</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-on-surface-variant">
          <MapPin size={14} /> Damak-5, Himal Chowk · Today 9:00 AM
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-md bg-surface-container/70 p-3">
          <Avatar name="Sita Maharjan" hue={280} size={46} ring />
          <div className="flex-1">
            <p className="text-sm font-bold">Sita Maharjan</p>
            <Rating value={4.8} count={1120} />
          </div>
          <Badge tone="marigold">
            <ShieldCheck size={12} /> Verified
          </Badge>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-pine-800" />
        </div>
        <p className="mt-1.5 text-xs font-semibold text-on-surface-variant">Crew on site · kitchen phase</p>
      </Card>
      <Card className="elev-2 absolute -right-3 -bottom-8 rotate-[2deg] p-4 sm:-right-8">
        <p className="flex items-center gap-1 text-sm font-bold">
          <Star size={15} className="fill-marigold-500 text-marigold-500" /> 4.8 / 5
        </p>
        <p className="mt-0.5 text-xs text-on-surface-variant">11,400+ verified reviews</p>
      </Card>
      <Card className="elev-2 absolute -top-7 -left-3 rotate-[-3deg] px-4 py-3 sm:-left-8">
        <p className="text-xs font-extrabold tracking-wide text-on-surface-variant uppercase">Starting at</p>
        <Price paisa={60000} prefix="" />
      </Card>
    </div>
  );
}

export default function Home() {
  const { categories, services, workers, reviews } = useCatalog();
  const totalJobs = services.reduce((n, s) => n + s.jobsDone, 0);
  const verifiedPros = workers.length;
  const avgRating = services.length
    ? services.reduce((n, s) => n + s.rating, 0) / services.length
    : 0;
  const popular = [...services].sort((a, b) => b.jobsDone - a.jobsDone).slice(0, 6);
  const pros = workers.slice(0, 4);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from("[data-hero] > *", {
      y: 26,
      opacity: 0,
      duration: 0.6,
      stagger: 0.09,
      ease: "power2.out",
      clearProps: "all",
    });
  }, []);

  return (
    <div className="fade-up">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-outline">
        <div className="dotgrid absolute inset-0" aria-hidden="true" />
        <div
          className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-pine-900 via-primary to-marigold-500"
          aria-hidden="true"
        />
        <div className="wrap relative grid items-center gap-12 py-14 md:grid-cols-[1.05fr_0.95fr] md:py-20">
          <div data-hero>
            <Badge tone="success">
              <ShieldCheck size={13} aria-hidden="true" /> 100% verified professionals
            </Badge>
            <h1 className="font-display mt-5 text-5xl leading-[1.04] font-semibold text-balance md:text-6xl">
              The right pro for every{" "}
              <span className="relative inline-block">
                home repair
                <span aria-hidden="true" className="absolute inset-x-0 -bottom-1 h-3 bg-marigold-300/70" />
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-on-surface-variant">
              Plumbing, electrical, cleaning, AC and eight more trades — done by
              background-checked pros with upfront pricing and live job tracking
              across Damak.
            </p>
            <form action="/services" method="get" className="mt-7 flex max-w-lg gap-2" role="search">
              <label htmlFor="hero-search" className="sr-only">
                Search services
              </label>
              <div className="relative flex-1">
                <Search
                  size={17}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant"
                />
                <input
                  id="hero-search"
                  name="q"
                  type="search"
                  placeholder="Try “AC service”, “deep clean”, “plumber”…"
                  className="elev-1 w-full rounded-lg border border-outline bg-white py-3.5 pr-4 pl-11 text-[15px] focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
              <Button type="submit" className="px-6 py-3.5 text-[15px]">
                Search
              </Button>
            </form>
            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-outline pt-6">
              {[
                [`${(totalJobs / 1000).toFixed(1)}k+`, "jobs completed"],
                [`${avgRating.toFixed(1)} / 5`, "average rating"],
                [`${verifiedPros}`, "verified pros live"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-display text-3xl font-semibold text-pine-950">{v}</dd>
                  <dd className="mt-0.5 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroArt />
        </div>
      </section>

      {/* Ticker */}
      <div className="ticker border-b border-pine-900 bg-pine-950 py-3.5 text-white" aria-hidden="true">
        <div className="ticker-track text-sm font-bold tracking-[0.14em] uppercase">
          {[0, 1].map((copy) => (
            <span key={copy} className="inline-flex gap-10">
              {services.slice(0, 10).map((s) => (
                <span key={`${copy}-${s.id}`} className="inline-flex items-center gap-10">
                  {s.name} <span className="text-marigold-300">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Trust strip */}
      <section className="wrap grid gap-3 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: BadgeCheck, t: "Background-checked pros", b: "ID, references & skill review before activation" },
          { icon: CreditCard, t: "Cash or online", b: "eSewa, Khalti and receipted cash" },
          { icon: CalendarCheck, t: "Live tracking", b: "Every status from dispatch to completion" },
          { icon: Star, t: "Rate real jobs", b: "Reviews tied to completed bookings only" },
        ].map((f) => (
          <Card key={f.t} className="elev-lift flex gap-3.5 p-5">
            <ArtTile hue={150} size={46}>
              <f.icon size={21} aria-hidden="true" />
            </ArtTile>
            <span>
              <span className="block text-[15px] font-bold">{f.t}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-on-surface-variant">{f.b}</span>
            </span>
          </Card>
        ))}
      </section>

      {/* Categories */}
      <section className="wrap py-8" aria-labelledby="cats-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead eyebrow="Categories" title="What does your home need today?" />
          <Link to="/services">
            <Button variant="outline">All services <ArrowRight size={15} aria-hidden="true" /></Button>
          </Link>
        </div>
        <Reveal id="cats" className="mt-7 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.icon] ?? Wrench;
            const hue = CATEGORY_HUES[c.id] ?? 150;
            const count = services.filter((s) => s.categoryId === c.id).length;
            return (
              <Link
                key={c.id}
                to={`/services?category=${c.id}`}
                className="elev-1 elev-lift group rounded-lg border border-outline/80 bg-white p-5"
              >
                <ArtTile hue={hue} size={48}>
                  <Icon size={22} aria-hidden="true" />
                </ArtTile>
                <span className="mt-3.5 block text-[15px] font-bold">{c.name}</span>
                <span className="block text-[13px] text-on-surface-variant">{c.tagline}</span>
                <span className="mt-2.5 block text-[13px] font-bold text-primary">
                  {count} service{count === 1 ? "" : "s"} <span aria-hidden="true" className="transition group-hover:ml-1">→</span>
                </span>
              </Link>
            );
          })}
        </Reveal>
      </section>

      {/* Popular */}
      <section className="mt-10 border-y border-outline bg-surface-container/60" aria-labelledby="popular-heading">
        <div className="wrap py-14">
          <SectionHead
            eyebrow="Most booked"
            title="Popular right now"
            body="Real booking counts from across Damak. Shown prices are estimates — the final amount is always confirmed with you first."
          />
          <Reveal id="popular" className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {popular.map((s) => (
              <Link key={s.id} to={`/services/${s.id}`}>
                <Card className="elev-lift h-full border-t-4 border-t-pine-800 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg leading-snug font-semibold">{s.name}</h3>
                    <Rating value={s.rating} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-on-surface-variant">{s.description}</p>
                  <p className="mt-3.5 flex items-baseline justify-between border-t border-outline/70 pt-3">
                    <Price paisa={s.basePricePaisa} prefix="from " />
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {s.jobsDone.toLocaleString()} jobs · ~{Math.round(s.durationMin / 60)}h
                    </span>
                  </p>
                </Card>
              </Link>
            ))}
          </Reveal>
        </div>
      </section>

      {/* How it works — dark band */}
      <section className="ring-band dotgrid-light" aria-labelledby="how-heading">
        <div className="wrap py-16">
          <SectionHead dark eyebrow="Process" title="From tap to done in four steps" />
          <ol id="how" className="mt-9 grid gap-4 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-lg border border-white/15 bg-white/[0.06] p-6 backdrop-blur-[1px]">
                <span aria-hidden="true" className="font-display text-5xl font-semibold text-marigold-300">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-bold text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-9">
            <Link to="/services">
              <Button variant="marigold">Start your first booking <ArrowRight size={16} aria-hidden="true" /></Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pros */}
      <section className="wrap py-14" aria-labelledby="pros-heading">
        <SectionHead
          eyebrow="Professionals"
          title="Meet verified pros"
          body="Public profiles show real ratings and completed-job counts. Private documents stay private — always."
        />
        <Reveal id="pros" className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pros.map((w) => (
            <Link key={w.id} to={`/workers/${w.id}`}>
              <Card className="elev-lift h-full p-6 text-center">
                <Avatar name={w.name} hue={w.avatarHue} size={64} ring />
                <h3 className="font-display mt-3 text-lg font-semibold">{w.name}</h3>
                <p className="mt-1 flex justify-center">
                  <Rating value={w.rating} count={w.jobsDone} />
                </p>
                <p className="mt-3">
                  <Badge tone="success"><ShieldCheck size={12} aria-hidden="true" /> Verified</Badge>
                </p>
              </Card>
            </Link>
          ))}
        </Reveal>
      </section>

      {/* Reviews + rewards */}
      <section className="wrap grid gap-4 pb-4 lg:grid-cols-5">
        <Card className="p-7 lg:col-span-3">
          <SectionHead eyebrow="Reviews" title="Customers rate real jobs" />
          <ul className="mt-5 space-y-5">
            {reviews.map((r) => (
              <li key={r.id} className="border-t border-outline pt-5 first:border-0 first:pt-0">
                <span aria-hidden="true" className="font-display text-4xl leading-none text-marigold-500">“</span>
                <p className="font-display -mt-3 text-lg leading-snug font-medium">{r.text}</p>
                <p className="mt-2 flex items-center gap-2">
                  <Rating value={r.rating} />
                  <span className="text-xs text-on-surface-variant">Verified booking {r.bookingId}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
        <div className="ring-band dotgrid-light flex flex-col justify-between rounded-lg p-7 lg:col-span-2">
          <div>
            <p className="text-xs font-extrabold tracking-[0.18em] text-marigold-300 uppercase">Loyalty</p>
            <h3 className="font-display mt-2 text-3xl font-semibold text-white">Earn points on every job</h3>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-white/80">
              <li><strong className="text-white">1 point</strong> per Rs 100 of eligible spend</li>
              <li><strong className="text-white">+100 bonus</strong> every 5 completed bookings</li>
              <li><strong className="text-white">Rs 50 off</strong> for every 100 points redeemed</li>
            </ul>
            <p className="mt-3 text-[13px] text-white/60">No tiers. No expiry games. No dark patterns.</p>
          </div>
          <div className="mt-7">
            <Link to="/rewards">
              <Button variant="marigold">See rewards <ArrowRight size={16} aria-hidden="true" /></Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="wrap py-12" aria-label="Service areas">
        <Card className="flex flex-col items-center gap-4 p-7 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="font-display text-2xl font-semibold">Proudly Damak-only</h2>
            <p className="mt-1 text-sm text-on-surface-variant">One city, done properly. Same-day slots in every municipal ward.</p>
          </div>
          <ul className="flex flex-wrap justify-center gap-2">
            {["Himal Chowk", "Station Road", "Campus Chowk", "Jyoti Chowk", "All wards"].map((c) => (
              <li key={c}>
                <Badge tone="neutral"><MapPin size={12} aria-hidden="true" /> {c}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* FAQ */}
      <section className="wrap pb-2" aria-labelledby="faq-heading">
        <SectionHead align="center" eyebrow="Trust" title="Questions, answered" />
        <div id="faq" className="mx-auto mt-7 grid max-w-4xl gap-4 md:grid-cols-3">
          {FAQS.map((f) => (
            <Card key={f.q} className="elev-lift p-6">
              <h3 className="font-display text-lg leading-snug font-semibold">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{f.a}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/services">
            <Button className="px-8 py-3.5 text-base">
              Book your first service <ArrowRight size={17} aria-hidden="true" />
            </Button>
          </Link>
          <p className="mt-3 text-xs text-on-surface-variant">Free cancellation before worker confirmation</p>
        </div>
      </section>

    </div>
  );
}
