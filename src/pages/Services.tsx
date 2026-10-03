import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import {
  ArtTile,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHero,
  Price,
  Rating,
} from "../components/ui";
import { CATEGORY_HUES, CATEGORY_ICONS } from "../components/categoryIcons";
import { CATEGORIES, SERVICES } from "../data/mock";
import { PRICING_LABELS } from "../lib/pricing";
import type { PricingModel } from "../lib/types";

type Sort = "popular" | "price-asc" | "price-desc" | "rating";

export default function Services() {
  const [params, setParams] = useSearchParams();
  const [maxPrice, setMaxPrice] = useState("1000000");
  const [model, setModel] = useState("all");
  const [minRating, setMinRating] = useState("0");
  const [sort, setSort] = useState<Sort>("popular");

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "all";

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = SERVICES.filter((s) => {
      if (category !== "all" && s.categoryId !== category) return false;
      if (model !== "all" && s.pricingModel !== (model as PricingModel)) return false;
      if (s.rating < Number(minRating)) return false;
      if (s.basePricePaisa > Number(maxPrice)) return false;
      if (needle) {
        const hay = `${s.name} ${s.description}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "price-asc") return a.basePricePaisa - b.basePricePaisa;
      if (sort === "price-desc") return b.basePricePaisa - a.basePricePaisa;
      if (sort === "rating") return b.rating - a.rating;
      return b.jobsDone - a.jobsDone;
    });
  }, [q, category, model, minRating, maxPrice, sort]);

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Directory"
        title="Browse services"
        body="Every price is an honest estimate. The final amount is always confirmed with you before work starts."
      >
        <form
          role="search"
          className="flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get("q");
            setParams((p) => {
              if (typeof v === "string" && v.trim()) p.set("q", v.trim());
              else p.delete("q");
              return p;
            });
          }}
        >
          <label htmlFor="dir-search" className="sr-only">Search services</label>
          <div className="relative flex-1">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              id="dir-search"
              name="q"
              defaultValue={q}
              type="search"
              placeholder="Search plumber, AC, painting…"
              className="w-full rounded-lg border border-white/25 bg-white py-3 pr-4 pl-11 text-[15px] text-on-surface placeholder:text-on-surface-variant/70 focus:border-marigold-300 focus:ring-2 focus:ring-marigold-300/40 focus:outline-none"
            />
          </div>
          <Button type="submit" variant="marigold">
            Search
          </Button>
        </form>
      </PageHero>

      <div className="wrap py-8">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {[{ id: "all", name: "All" }, ...CATEGORIES].map((c) => {
            const active = category === c.id || (c.id === "all" && category === "all");
            return (
              <button
                key={c.id}
                onClick={() =>
                  setParams((p) => {
                    if (c.id === "all") p.delete("category");
                    else p.set("category", c.id);
                    return p;
                  })
                }
                aria-pressed={active}
                className={`cursor-pointer rounded-lg border px-3.5 py-1.5 text-sm font-bold transition active:scale-95 ${
                  active
                    ? "border-pine-950 bg-pine-950 text-white"
                    : "border-outline bg-white hover:border-pine-800 hover:text-pine-950"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        <Card className="mt-4 grid gap-3 p-4 sm:grid-cols-4">
          {[
            { label: "Max price", value: maxPrice, set: setMaxPrice, opts: [["100000", "Up to Rs 1,000"], ["300000", "Up to Rs 3,000"], ["1000000", "Up to Rs 10,000"], ["99999999", "Any price"]] },
            { label: "Pricing", value: model, set: setModel, opts: [["all", "All pricing"], ...Object.entries(PRICING_LABELS)] },
            { label: "Rating", value: minRating, set: setMinRating, opts: [["0", "Any rating"], ["4.5", "4.5 & up"], ["4.8", "4.8 & up"]] },
            { label: "Sort", value: sort, set: (v: string) => setSort(v as Sort), opts: [["popular", "Most booked"], ["rating", "Highest rated"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"]] },
          ].map((f) => (
            <label key={f.label} className="block text-sm">
              <span className="mb-1 block font-semibold">{f.label}</span>
              <select
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-full rounded-lg border border-outline bg-white px-3 py-2"
              >
                {f.opts.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
          ))}
        </Card>

        <p className="mt-6 text-sm font-semibold text-on-surface-variant" role="status">
          {results.length} service{results.length === 1 ? "" : "s"} found{q && <> for “{q}”</>}
        </p>

        {results.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No services match"
              body="Try widening the price range, clearing the area filter, or searching a simpler word like “clean” or “AC”."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((s) => {
              const cat = CATEGORIES.find((c) => c.id === s.categoryId);
              const Icon = CATEGORY_ICONS[s.categoryId] ?? Search;
              const hue = CATEGORY_HUES[s.categoryId] ?? 150;
              return (
                <Link key={s.id} to={`/services/${s.id}`}>
                  <Card className="elev-lift h-full p-5">
                    <div className="flex items-center gap-3">
                      <ArtTile hue={hue} size={48}>
                        <Icon size={22} aria-hidden="true" />
                      </ArtTile>
                      <div>
                        <h3 className="font-display text-[17px] leading-snug font-semibold">{s.name}</h3>
                        <p className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">{cat?.name}</p>
                      </div>
                    </div>
                    <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-on-surface-variant">{s.description}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-outline/70 pt-3">
                      <span className="flex items-center gap-2 text-sm">
                        <Badge tone="info">{PRICING_LABELS[s.pricingModel]}</Badge>
                        <Price paisa={s.basePricePaisa} prefix={s.basePricePaisa > 0 ? "from " : ""} />
                      </span>
                      <Rating value={s.rating} />
                    </div>
                  <p className="mt-2 text-xs font-medium text-on-surface-variant">
                    {s.jobsDone.toLocaleString()} jobs · Damak
                  </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
