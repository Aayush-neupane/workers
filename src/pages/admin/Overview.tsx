import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "../../components/ui";
import { Kpi, SkeletonRows } from "../../components/ops";
import { api } from "../../lib/api";
import { formatNPR } from "../../lib/format";
import type { Overview } from "../../lib/admin";

interface Summary {
  totals: { orders: number; revenue: string; commission: string };
  by_day: { day: string; orders: number; revenue: string }[];
  by_category: { name: string | null; jobs: number; revenue: string }[];
  by_status: { status: string; orders: number }[];
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function OverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const ov = await api<Overview>("/api/admin/reports/overview");
      setOverview(ov);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const s = await api<Summary>(`/api/admin/reports/summary?from=${from}&to=${to}`);
      setSummary(s);
    } catch {
      setSummary(null);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  if (loading) return <SkeletonRows rows={5} />;
  if (failed || !overview) {
    return (
      <Card className="p-8 text-center">
        <p className="font-display text-xl font-semibold">Couldn&apos;t load admin data</p>
        <div className="mt-4">
          <Button onClick={() => void load()}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi value={`${overview.today?.orders ?? overview.totalBookings}`} label="Bookings today" sub={`${overview.totalBookings} all time`} />
        <Kpi value={formatNPR(Number(overview.today?.revenue ?? 0))} label="Revenue today" tone="success" sub={`${formatNPR(overview.revenue)} completed all time`} />
        <Kpi value={formatNPR(overview.commission)} label="Commission earned" tone="marigold" />
        <Kpi value={formatNPR(overview.cashOwed)} label="Cash commission owed" tone={overview.cashOwed > 0 ? "error" : "pine"} sub={overview.cashOwed > 0 ? "Needs settlement" : "All settled"} />
        <Kpi value={`${overview.preparing ?? 0}`} label="Jobs in progress" sub="confirmed → awaiting-confirmation" />
        <Kpi value={`${overview.disputes}`} label="Open disputes" tone={overview.disputes > 0 ? "error" : "pine"} />
      </div>

      <Card className="mt-4 p-5">
        <h3 className="font-display text-lg font-semibold">Revenue by category</h3>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase"><th className="py-1.5">Category</th><th className="text-right">Jobs</th><th className="text-right">Revenue</th><th className="text-right">Commission</th></tr></thead>
          <tbody className="tabular-nums">
            {overview.byCategory.map((e) => (
              <tr key={e.name} className="border-t border-outline">
                <td className="py-2 font-semibold">{e.name}</td>
                <td className="text-right">{e.jobs}</td>
                <td className="text-right">{formatNPR(Number(e.revenue))}</td>
                <td className="text-right">{formatNPR(Number(e.commission))}</td>
              </tr>
            ))}
            {overview.byCategory.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-on-surface-variant">No completed revenue yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">Reports</h3>
          <div className="flex items-center gap-2 text-sm">
            <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-outline bg-white px-2 py-1" /></label>
            <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-outline bg-white px-2 py-1" /></label>
          </div>
        </div>
        {!summary ? (
          <p className="mt-2 text-sm text-on-surface-variant">Pick a valid date range.</p>
        ) : (
          <div className="mt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi value={`${summary.totals.orders}`} label="Orders in range" />
              <Kpi value={formatNPR(Number(summary.totals.revenue))} label="Revenue in range" tone="success" />
              <Kpi value={formatNPR(Number(summary.totals.commission))} label="Commission in range" tone="marigold" />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-bold">Orders by day</h4>
                <table className="mt-1 w-full text-sm">
                  <tbody className="tabular-nums">
                    {summary.by_day.map((d) => (
                      <tr key={d.day} className="border-t border-outline">
                        <td className="py-1.5">{d.day}</td>
                        <td className="text-right">{d.orders}</td>
                        <td className="text-right">{formatNPR(Number(d.revenue))}</td>
                      </tr>
                    ))}
                    {summary.by_day.length === 0 && (
                      <tr><td className="py-3 text-center text-on-surface-variant">Nothing in range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="text-sm font-bold">By status</h4>
                <table className="mt-1 w-full text-sm">
                  <tbody className="tabular-nums">
                    {summary.by_status.map((s) => (
                      <tr key={s.status} className="border-t border-outline">
                        <td className="py-1.5">{s.status}</td>
                        <td className="text-right">{s.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
