import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  Search,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Price, Rating, SectionHead } from "../components/ui";
import { CATEGORY_ICONS } from "../components/categoryIcons";
import { CATEGORIES, REVIEWS, SERVICES, WORKERS } from "../data/mock";
import { isEligibleWorker } from "../lib/booking";

const totalJobs = SERVICES.reduce((n, s) => n + s.jobsDone, 0);
const verifiedPros = WORKERS.filter(isEligibleWorker).length;
const avgRating =
  SERVICES.reduce((n, s) => n + s.rating, 0) / SERVICES.length;
const popular = [...SERVICES].sort((a, b) => b.jobsDone - a.jobsDone).slice(0, 6);
const pros = WORKERS.filter(isEligibleWorker).slice(0, 4);

const STEPS = [
  {
    title: "Pick a service",
    body: "Browse 12 categories with upfront pricing — fixed, hourly or inspection-first. No hidden charges.",
  },
  {
    title: "Choose your slot",
    body: "Same-day and next-day windows across Kathmandu Valley. Add photos and notes for the pro.",
  },
  {
    title: "A verified pro arrives",
    body: "Only background-checked professionals get assignments. Track every status change live.",
  },
  {
    title: "Pay & review",
    body: "Cash, eSewa or Khalti. Confirm completion, rate the job and earn loyalty points.",
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

export default function Home() {
  return (
    <div className="fade-up">
      {/* Hero */}
      <section className="border-b border-outline bg-surface-container/50">
        <div className="wrap grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            <Badge tone="success">
              <ShieldCheck size={13} aria-hidden="true" /> 100% verified professionals
            </Badge>
            <h1 className="mt-4 text-4xl font-bold text-balance md:text-5xl">
              Trusted home services, booked in minutes
            </h1>
            <p className="mt-4 max-w-lg text-lg text-on-surface-variant">
              Plumbing, electrical, cleaning, AC and 8 more categories — done by
              background-checked pros with upfront pricing and live job tracking.
            </p>
            <form action="/services" method="get" className="mt-6 flex max-w-lg gap-2" role="search">
              <label htmlFor="hero-search" className="sr-only">
                Search services
              </label>
              <input
                id="hero-search"
                name="q"
                type="search"
                placeholder="Try “AC service”, “deep clean”, “plumber”…"
                className="w-full rounded-md border border-outline bg-white px-4 py-3 text-sm"
              />
              <Button type="submit" aria-label="Search">
                <Search size={17} aria-hidden="true" />
                <span className="hidden sm:inline">Search</span>
              </Button>
            </form>
            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4">
              {[
                [`${(totalJobs / 1000).toFixed(1)}k+`, "jobs completed"],
                [`${avgRating.toFixed(1)} / 5`, "average rating"],
                [`${verifiedPros}`, "verified pros live"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="text-2xl font-bold text-primary">{v}</dd>
                  <dd className="text-xs text-on-surface-variant">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
            {popular.slice(0, 4).map((s, i) => {
              const Icon = CATEGORY_ICONS[CATEGORIES.find((c) => c.id === s.categoryId)?.icon ?? "wrench"] ?? Wrench;
              return (
                <Card
                  key={s.id}
                  className={`p-5 ${i % 2 === 1 ? "sm:mt-6" : ""} border-l-4 border-l-primary`}
                >
                  <span className="grid size-10 place-items-center rounded-md bg-primary-container text-on-primary-container">
                    <Icon size={19} />
                  </span>
                  <p className="mt-3 text-sm font-bold">{s.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    <Price paisa={s.basePricePaisa} prefix="from " /> · {s.jobsDone.toLocaleString()} jobs
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="wrap grid gap-3 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: BadgeCheck, t: "Background-checked pros", b: "ID, references & skill review before activation" },
          { icon: CreditCard, t: "Cash or online", b: "eSewa, Khalti and cash with receipts" },
          { icon: CalendarCheck, t: "Live tracking", b: "Every status from dispatch to completion" },
          { icon: Star, t: "Rate everything", b: "Reviews tied to real completed jobs only" },
        ].map((f) => (
          <Card key={f.t} className="flex gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-container text-primary">
              <f.icon size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold">{f.t}</span>
              <span className="block text-xs text-on-surface-variant">{f.b}</span>
            </span>
          </Card>
        ))}
      </section>

      {/* Categories */}
      <section className="wrap py-10" aria-labelledby="cats">
        <div className="flex items-end justify-between gap-4">
          <SectionHead
            eyebrow="Categories"
            title="What does your home need today?"
          />
          <Link to="/services" className="hidden shrink-0 text-sm font-semibold text-primary sm:block">
            All services →
          </Link>
        </div>
        <div id="cats" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c.icon] ?? Wrench;
            const count = SERVICES.filter((s) => s.categoryId === c.id).length;
            return (
              <Link
                key={c.id}
                to={`/services?category=${c.id}`}
                className="elev-1 group rounded-lg border border-outline bg-white p-5 transition hover:-translate-y-0.5 hover:border-primary"
              >
                <span className="grid size-11 place-items-center rounded-md bg-primary-container text-on-primary-container transition group-hover:bg-primary group-hover:text-white">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="mt-3 block font-bold">{c.name}</span>
                <span className="block text-xs text-on-surface-variant">{c.tagline}</span>
                <span className="mt-2 block text-xs font-semibold text-primary">
                  {count} service{count === 1 ? "" : "s"} →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Popular services */}
      <section className="border-y border-outline bg-surface-container/50" aria-labelledby="popular">
        <div className="wrap py-12">
          <SectionHead
            eyebrow="Most booked"
            title="Popular right now"
            body="Real booking counts from across the valley. Prices shown are estimates — the final amount is always confirmed with you first."
          />
          <div id="popular" className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {popular.map((s) => (
              <Link key={s.id} to={`/services/${s.id}`}>
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-primary">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold">{s.name}</h3>
                    <Rating value={s.rating} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{s.description}</p>
                  <p className="mt-3 text-sm">
                    <Price paisa={s.basePricePaisa} prefix="from " />
                    <span className="text-on-surface-variant"> · ~{Math.round(s.durationMin / 60)}h</span>
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="wrap py-12" aria-labelledby="how">
        <SectionHead eyebrow="Process" title="From tap to done in four steps" />
        <ol id="how" className="mt-6 grid gap-4 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <Card className="h-full p-5">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Pros */}
      <section className="wrap py-4" aria-labelledby="pros">
        <SectionHead eyebrow="Professionals" title="Meet verified pros" body="Public profiles show real ratings and completed-job counts. Private documents stay private." />
        <div id="pros" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pros.map((w) => (
            <Link key={w.id} to={`/workers/${w.id}`}>
              <Card className="h-full p-5 text-center transition hover:-translate-y-0.5 hover:border-primary">
                <Avatar name={w.name} hue={w.avatarHue} size={56} />
                <h3 className="mt-2 font-bold">{w.name}</h3>
                <p className="mt-1 flex justify-center">
                  <Rating value={w.rating} count={w.jobsDone} />
                </p>
                <p className="mt-2">
                  <Badge tone="success">Verified</Badge>
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Reviews + rewards */}
      <section className="wrap grid gap-4 py-12 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHead eyebrow="Reviews" title="Customers rate real jobs" />
          <ul className="mt-4 space-y-4">
            {REVIEWS.map((r) => (
              <li key={r.id} className="border-t border-outline pt-4 first:border-0 first:pt-0">
                <Rating value={r.rating} />
                <p className="mt-1 text-sm">“{r.text}”</p>
                <p className="mt-1 text-xs text-on-surface-variant">Booking {r.bookingId}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col justify-between bg-primary p-6 text-white">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase opacity-80">Loyalty</p>
            <h3 className="mt-1 text-2xl font-bold">Earn points on every job</h3>
            <p className="mt-2 text-sm opacity-90">
              1 point per Rs 100, a 100-point bonus every 5 bookings, and Rs 50 off for
              every 100 points redeemed. No tiers, no expiry games.
            </p>
          </div>
          <div className="mt-6">
            <Link to="/rewards">
              <Button variant="secondary">
                See rewards <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </Card>
      </section>

      {/* FAQ */}
      <section className="wrap pb-4" aria-labelledby="faq">
        <SectionHead eyebrow="Trust" title="Questions, answered" />
        <div id="faq" className="mt-6 grid gap-4 md:grid-cols-3">
          {FAQS.map((f) => (
            <Card key={f.q} className="p-5">
              <h3 className="font-bold">{f.q}</h3>
              <p className="mt-2 text-sm text-on-surface-variant">{f.a}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link to="/services">
            <Button>
              Book your first service <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
