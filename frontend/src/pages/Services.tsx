import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Star, WifiOff } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHero, Price, TextField, Select } from "../components/ui";
import { api } from "../lib/api";
import type { Category, Service } from "../lib/types";

export default function Services() {
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [q, setQ] = useState(params.get("q") ?? "");
  const category = params.get("category") ?? "";
  const [sort, setSort] = useState("popular");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api<{ categories: Category[] }>("/api/categories").then((d) => setCats(d.categories)).catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams({ sort });
    if (q) qs.set("q", q);
    if (category) qs.set("category", category);
    api<{ services: Service[] }>(`/api/services?${qs}`).then((d) => { setServices(d.services); setLoadError(false); }).catch(() => setLoadError(true));
  }, [q, category, sort]);

  return (
    <div className="fade-up">
      <PageHero eyebrow="Damak only" title="Services" body="Every listing is configured and priced by our team. Estimates are marked; confirmed prices are agreed before work closes." />
      <div className="wrap py-8">
        {loadError && (
          <p role="alert" className="mb-4 flex items-center gap-2 rounded-md bg-error-container p-3.5 text-sm font-medium text-error">
            <WifiOff size={16} aria-hidden="true" />
            Couldn't reach the server — is the API running on :4001 with the database migrated and seeded?
          </p>
        )}
        <div className="flex flex-col gap-3 md:flex-row">
          <TextField value={q} onChange={(e) => { setQ(e.target.value); setParams((p) => { e.target.value ? p.set("q", e.target.value) : p.delete("q"); return p; }); }} placeholder="Search services…" aria-label="Search services" />
          <div className="flex gap-3">
            <Select value={category} onChange={(e) => setParams((p) => { e.target.value ? p.set("category", e.target.value) : p.delete("category"); return p; })} aria-label="Category">
              <option value="">All categories</option>
              {cats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="popular">Popular</option>
              <option value="price-asc">Price: low first</option>
              <option value="price-desc">Price: high first</option>
              <option value="rating">Top rated</option>
            </Select>
          </div>
        </div>
        {services.length === 0 ? (
          <div className="mt-6"><EmptyState title="No services found" body="Try a different search — or request a quote for unusual jobs." /></div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Link key={s.id} to={`/services/${s.id}`}>
                <Card className="h-full p-5 transition hover:border-pine-800">
                  <div className="flex items-center justify-between">
                    <Badge tone="success">{s.category_name}</Badge>
                    {s.rating > 0 && <span className="inline-flex items-center gap-1 text-xs font-bold"><Star size={13} aria-hidden="true" /> {s.rating.toFixed(1)} · {s.jobs_done} jobs</span>}
                  </div>
                  <p className="mt-2 font-bold">{s.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{s.description}</p>
                  <p className="mt-3">
                    {s.pricing_model === "custom-quote" || s.pricing_model === "inspection-quote"
                      ? <span className="text-sm font-bold text-marigold-700">Custom quote</span>
                      : <Price paisa={s.base_price_paisa} />}
                  </p>
                  <span className="mt-3 inline-block"><Button variant="outline">View & book</Button></span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
