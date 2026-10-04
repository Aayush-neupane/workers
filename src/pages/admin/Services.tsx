import { useCallback, useEffect, useState } from "react";
import { Badge, Card, Price } from "../../components/ui";
import { SkeletonRows } from "../../components/ops";
import { Pager } from "../../components/AdminNav";
import { api, put } from "../../lib/api";
import { getPage, type Category, type ServiceRow } from "../../lib/admin";

const LIMIT = 10;

export default function ServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [serviceTotal, setServiceTotal] = useState(0);
  const [servicePage, setServicePage] = useState(1);
  const [wards, setWards] = useState<boolean[]>(Array(10).fill(true));
  const [commEdit, setCommEdit] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cat, svc, wd] = await Promise.all([
        api<{ categories: Category[] }>("/api/categories"),
        getPage<ServiceRow>("/api/admin/services-all", "services", { page: servicePage, limit: LIMIT }),
        api<{ wards: { ward: number; is_open: boolean }[] }>("/api/admin/wards"),
      ]);
      setCategories(cat.categories);
      setServices(svc.rows);
      setServiceTotal(svc.total);
      const arr = Array(10).fill(true);
      for (const x of wd.wards) arr[x.ward - 1] = x.is_open;
      setWards(arr);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load services");
    } finally {
      setLoading(false);
    }
  }, [servicePage]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const openWards = wards.filter(Boolean).length;

  if (loading) return <SkeletonRows rows={4} />;

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-error-container p-3 text-sm font-medium text-error">{error}</p>
      )}
      <Card className="ring-band dotgrid-light border-0 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-xl font-semibold">Coverage zone: Damak (Jhapa)</h3>
            <p className="mt-0.5 text-sm text-white/70">Single-city policy — every service inherits this zone.</p>
          </div>
          <Badge tone="marigold">{openWards}/10 wards open</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Open wards">
          {wards.map((open, i) => (
            <button
              key={i}
              onClick={() => void run(async () => {
                const next = wards.map((v, j) => (j === i ? !v : v));
                setWards(next);
                await put("/api/admin/wards", { wards: next });
              })}
              aria-pressed={open}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                open ? "bg-marigold-300 text-pine-950" : "bg-white/15 text-white/60"
              }`}
            >
              W{i + 1}
            </button>
          ))}
        </div>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold">Commission rules</h3>
          <p className="text-xs text-on-surface-variant">Basis points · 1500 = 15% · future bookings only</p>
          <div className="mt-3 space-y-2">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{c.name}</span>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={commEdit[c.id] ?? String(c.commission_bps)}
                  onChange={(e) => setCommEdit((p) => ({ ...p, [c.id]: e.target.value }))}
                  onBlur={() => void run(async () => {
                    const v = Number(commEdit[c.id] ?? c.commission_bps);
                    if (Number.isInteger(v) && v >= 0 && v <= 5000 && v !== c.commission_bps) {
                      await put(`/api/admin/categories/${c.id}`, { commissionBps: v });
                    }
                  })}
                  className="w-24 rounded-md border border-outline bg-white px-2 py-1.5 tabular-nums"
                  aria-label={`${c.name} commission basis points`}
                />
              </label>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold">Services ({serviceTotal})</h3>
          <ul className="mt-2 max-h-96 space-y-2 overflow-auto text-sm">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 border-t border-outline pt-2 first:border-0 first:pt-0">
                <span className="font-semibold">{s.name} {!s.is_active && <Badge>Inactive</Badge>}</span>
                <Price paisa={Number(s.base_price_paisa)} />
              </li>
            ))}
          </ul>
          <Pager page={servicePage} limit={LIMIT} total={serviceTotal} onPage={setServicePage} />
        </Card>
      </div>
    </div>
  );
}
