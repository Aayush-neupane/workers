import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, TextField, VerifyBadge } from "../../components/ui";
import { SkeletonRows } from "../../components/ops";
import { Pager } from "../../components/AdminNav";
import { post } from "../../lib/api";
import { getPage, useDebouncedValue, type AdminWorker } from "../../lib/admin";

const STATES = ["draft", "awaiting-documents", "under-review", "verified", "rejected", "suspended"];
const LIMIT = 10;

export default function PeoplePage() {
  const [workers, setWorkers] = useState<AdminWorker[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState("all");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (state !== "all") params.state = state;
      if (debouncedQ.trim()) params.q = debouncedQ.trim();
      const r = await getPage<AdminWorker>("/api/admin/workers", "workers", { page, limit: LIMIT, params });
      setWorkers(r.rows);
      setTotal(r.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workers");
    } finally {
      setLoading(false);
    }
  }, [page, state, debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [state, debouncedQ]);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">{error}</p>
      )}
      <Card className="flex flex-wrap items-center gap-2 p-4">
        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email…"
          aria-label="Search workers"
          className="min-w-52 flex-1"
        />
        <label className="flex items-center gap-1.5 text-sm">
          State
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="rounded-md border border-outline bg-white px-3 py-2 text-sm"
          >
            <option value="all">All ({total})</option>
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </Card>
      {loading ? (
        <SkeletonRows rows={4} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="bg-surface-container text-left text-[11px] font-extrabold tracking-wider uppercase"><th className="px-4 py-2.5">Worker</th><th className="px-4 py-2.5">Verification</th><th className="px-4 py-2.5 text-right">Jobs</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Action</th></tr></thead>
            <tbody className="tabular-nums">
              {workers.map((w) => (
                <tr key={w.id} className="border-t border-outline">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold">{w.name}</span>
                    <span className="block text-xs text-on-surface-variant">{w.email}</span>
                  </td>
                  <td className="px-4 py-2.5"><VerifyBadge state={w.verification_state} /></td>
                  <td className="px-4 py-2.5 text-right">{w.jobs_done}</td>
                  <td className="px-4 py-2.5">{w.is_active ? <Badge tone="success">Active</Badge> : <Badge>Suspended</Badge>}</td>
                  <td className="px-4 py-2.5">
                    <Button
                      variant="outline"
                      onClick={() => void run(() => post(`/api/admin/workers/${w.id}/activate`, { active: !w.is_active }))}
                    >
                      {w.is_active ? "Suspend" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
              {workers.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">No workers match.</td></tr>
              )}
            </tbody>
          </table>
          <div className="px-4 pb-3">
            <Pager page={page} limit={LIMIT} total={total} onPage={setPage} />
          </div>
        </Card>
      )}
    </div>
  );
}
