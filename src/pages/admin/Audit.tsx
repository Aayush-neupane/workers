import { useCallback, useEffect, useState } from "react";
import { Card } from "../../components/ui";
import { SkeletonRows } from "../../components/ops";
import { Pager } from "../../components/AdminNav";
import { formatSlot } from "../../lib/format";
import { getPage, type AuditRow } from "../../lib/admin";

const LIMIT = 20;

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await getPage<AuditRow>("/api/admin/audit", "audit", { page, limit: LIMIT });
      setRows(r.rows);
      setTotal(r.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit log");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <SkeletonRows rows={5} />;

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-error-container p-3 text-sm font-medium text-error">{error}</p>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="bg-surface-container text-left text-[11px] font-extrabold tracking-wider uppercase"><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Actor</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Detail</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant">No admin actions recorded yet.</td></tr>}
            {rows.map((a, i) => (
              <tr key={i} className="border-t border-outline">
                <td className="px-4 py-2.5 whitespace-nowrap text-on-surface-variant">{formatSlot(a.created_at)}</td>
                <td className="px-4 py-2.5">{a.actor_name ?? "system"}</td>
                <td className="px-4 py-2.5 font-semibold">{a.action}</td>
                <td className="px-4 py-2.5">{a.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 pb-3">
          <Pager page={page} limit={LIMIT} total={total} onPage={setPage} />
        </div>
      </Card>
    </div>
  );
}
