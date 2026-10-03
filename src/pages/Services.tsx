import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Badge, Button, Card, EmptyState, Price, Rating, SectionHead } from "../components/ui";
import { CATEGORY_ICONS } from "../components/categoryIcons";
import { CATEGORIES, SERVICES } from "../data/mock";
import { PRICING_LABELS } from "../lib/pricing";

const AREAS = ["Kathmandu", "Lalitpur", "Bhaktapur", "Kirtipur"];

type Sort = "popular" | "price-asc" | "price-desc" | "rating";

export default function Services() {
  const [params, setParams] = useSearchParams();
  const [maxPrice, setMaxPrice] = useState("1000000");
  const [area, setArea] = useState("all");
  const [minRating, setMinRating] = useState("0");
  const [sort, setSort] = useState<Sort>("popular");

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "all";

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = SERVICES.filter((s) => {
      if (category !== "all" && s.categoryId !== category) return false;
      if (area !== "all" && !s.areas.includes(area)) return false;
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
  }, [q, category, area, minRating, maxPrice, sort]);

  return (
    <div className="wrap fade-up py-10">
      <SectionHead
        eyebrow="Directory"
        title="Browse services"
        body="Every price is an honest estimate. The final amount is always confirmed with you before work starts."
      />

      <form
        role="search"
        className="mt-6 flex gap-2"
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
        <input
          id="dir-search"
          name="q"
          defaultValue={q}
          type="search"
          placeholder="Search plumber, AC, painting…"
          className="w-full rounded-md border border-outline bg-white px-4 py-2.5 text-sm"
        />
        <Button type="submit" aria-label="Search services">
          <Search size={16} aria-hidden="true" /> Search
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {[{ id: "all", name: "All" }, ...CATEGORIES].map((c) => (
          <button
            key={c.id}
            onClick={() =>
              setParams((p) => {
                if (c.id === "all") p.delete("category");
                else p.set("category", c.id);
                return p;
              })
            }
            aria-pressed={category === c.id || (c.id === "all" && category === "all")}
            className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              (category === c.id || (c.id === "all" && category === "all"))
                ? "border-primary bg-primary text-white"
                : "border-outline bg-white hover:border-primary"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-outline bg-white p-4 sm:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Max price</span>
          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full rounded-md border border-outline bg-white px-3 py-2"
          >
            <option value="100000">Up to Rs 1,000</option>
            <option value="300000">Up to Rs 3,000</option>
            <option value="1000000">Up to Rs 10,000</option>
            <option value="99999999">Any price</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Area</span>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full rounded-md border border-outline bg-white px-3 py-2"
          >
            <option value="all">All areas</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Rating</span>
          <select
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className="w-full rounded-md border border-outline bg-white px-3 py-2"
          >
            <option value="0">Any rating</option>
            <option value="4.5">4.5 & up</option>
            <option value="4.8">4.8 & up</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="w-full rounded-md border border-outline bg-white px-3 py-2"
          >
            <option value="popular">Most booked</option>
            <option value="rating">Highest rated</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </label>
      </div>

      <p className="mt-6 text-sm text-on-surface-variant" role="status">
        {results.length} service{results.length === 1 ? "" : "s"} found
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
            return (
              <Link key={s.id} to={`/services/${s.id}`}>
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-primary">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-container text-on-primary-container">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-bold">{s.name}</h3>
                      <p className="text-xs text-on-surface-variant">{cat?.name}</p>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{s.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm">
                      <Badge tone="info">{PRICING_LABELS[s.pricingModel]}</Badge>{" "}
                      <Price paisa={s.basePricePaisa} prefix={s.basePricePaisa > 0 ? "from " : ""} />
                    </span>
                    <Rating value={s.rating} />
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {s.jobsDone.toLocaleString()} jobs · {s.areas.join(", ")}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
