import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, TextField } from "../../components/ui";
import { SkeletonRows } from "../../components/ops";
import { Pager } from "../../components/AdminNav";
import { api, post } from "../../lib/api";
import { formatSlot } from "../../lib/format";
import { getPage, useDebouncedValue, type AdminBooking, type AdminWorker } from "../../lib/admin";

const STATUSES = ["pending", "awaiting-worker", "confirmed", "en-route", "in-progress", "awaiting-confirmation", "completed", "disputed", "cancelled"];
const LIMIT = 10;

export default function BookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const [workers, setWorkers] = useState<AdminWorker[]>([]);
  const [assignSel, setAssignSel] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (status !== "all") params.status = status;
      if (debouncedQ.trim()) params.q = debouncedQ.trim();
      const [b, w] = await Promise.all([
        getPage<AdminBooking>("/api/admin/bookings", "bookings", { page, limit: LIMIT, params }),
        workers.length === 0
          ? api<{ workers: AdminWorker[] }>("/api/admin/workers?page=1&limit=50")
          : Promise.resolve(null),
      ]);
      setBookings(b.rows);
      setTotal(b.total);
      if (w) setWorkers(w.workers);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bookings");
    } finally {
      setLoading(false);
    }
  }, [page, status, debouncedQ, workers.length]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [status, debouncedQ]);

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
          placeholder="Search booking no, worker, customer…"
          aria-label="Search bookings"
          className="min-w-52 flex-1"
        />
        <label className="flex items-center gap-1.5 text-sm">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-outline bg-white px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </Card>
      {loading ? (
        <SkeletonRows rows={4} />
      ) : (
        <>
          {bookings.length === 0 && (
            <Card className="p-8 text-center">
              <p className="font-display text-lg font-semibold">No bookings found</p>
              <p className="mt-1 text-sm text-on-surface-variant">Try a different search or status.</p>
            </Card>
          )}
          {bookings.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-marigold-500 p-4">
              <div className="text-sm">
                <Link to={`/track/${b.booking_no}`} className="font-bold hover:text-primary">{b.booking_no}</Link>
                <p className="text-on-surface-variant">{b.service_name} · {formatSlot(b.slot)}</p>
                <p className="mt-0.5"><Badge tone="success">Damak</Badge> <span className="text-on-surface-variant">{b.customer_name} · {b.status}</span></p>
              </div>
              <div className="flex gap-2">
                <label className="sr-only" htmlFor={`assign-${b.id}`}>Assign worker</label>
                <select
                  id={`assign-${b.id}`}
                  value={assignSel[b.booking_no] ?? ""}
                  onChange={(e) => setAssignSel((p) => ({ ...p, [b.booking_no]: e.target.value }))}
                  className="rounded-md border border-outline bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select verified pro…</option>
                  {workers
                    .filter((w) => w.verification_state === "verified" && w.is_active)
                    .map((w) => (
                      <option key={w.id} value={w.id}>{w.name} · {w.categories.join(", ") || "general"}</option>
                    ))}
                </select>
                <Button
                  disabled={!assignSel[b.booking_no]}
                  onClick={() => void run(() => post(`/api/bookings/${b.booking_no}/transition`, {
                    to: "awaiting-worker",
                    workerId: assignSel[b.booking_no],
                    note: "Assigned by admin",
                  }))}
                >
                  Assign
                </Button>
              </div>
            </Card>
          ))}
          <Pager page={page} limit={LIMIT} total={total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
