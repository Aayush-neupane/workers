import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card } from "../../components/ui";
import { SkeletonRows } from "../../components/ops";
import { Pager } from "../../components/AdminNav";
import { post } from "../../lib/api";
import { getPage, type Ticket } from "../../lib/admin";

const LIMIT = 10;

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filter !== "all") params.status = filter;
      const r = await getPage<Ticket>("/api/admin/tickets", "tickets", { page, limit: LIMIT, params });
      setTickets(r.rows);
      setTotal(r.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tickets");
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [filter]);

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
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">Tickets ({total})</h3>
          <div className="flex gap-1.5" role="group" aria-label="Filter tickets">
            {["all", "open", "in-progress", "resolved"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                aria-pressed={filter === s}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold transition ${
                  filter === s ? "bg-pine-950 text-white" : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="mt-3"><SkeletonRows rows={3} /></div>
        ) : (
          <>
            {tickets.map((t) => (
              <div key={t.id} className="mt-3 border-t border-outline pt-3 first:border-0">
                <p className="text-sm font-bold">{t.subject} <Badge tone={t.status === "resolved" ? "success" : "warning"}>{t.status}</Badge></p>
                {(t.messages ?? []).map((m, i) => (
                  <p key={i} className="mt-1 text-sm"><strong>{m.from}:</strong> {m.text}</p>
                ))}
                <div className="mt-2 flex gap-2">
                  <input
                    value={replies[t.id] ?? ""}
                    onChange={(e) => setReplies((p) => ({ ...p, [t.id]: e.target.value }))}
                    placeholder="Write a reply…"
                    aria-label={`Reply to ${t.subject}`}
                    className="w-full rounded-md border border-outline bg-white px-3 py-1.5 text-sm"
                  />
                  <Button
                    variant="outline"
                    disabled={!(replies[t.id] ?? "").trim()}
                    onClick={() => void run(async () => {
                      await post(`/api/admin/tickets/${t.id}/reply`, { body: replies[t.id].trim() });
                      setReplies((p) => ({ ...p, [t.id]: "" }));
                    })}
                  >
                    Reply
                  </Button>
                  {t.status !== "resolved" && (
                    <Button
                      variant="ghost"
                      onClick={() => void run(() => post(`/api/admin/tickets/${t.id}/status`, { status: "resolved" }))}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {tickets.length === 0 && <p className="mt-2 text-sm text-on-surface-variant">No tickets.</p>}
            <Pager page={page} limit={LIMIT} total={total} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
