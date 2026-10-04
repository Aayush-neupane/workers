import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card } from "../../components/ui";
import { SkeletonRows } from "../../components/ops";
import { Pager } from "../../components/AdminNav";
import { post } from "../../lib/api";
import { formatNPR } from "../../lib/format";
import { getPage, type LedgerRow } from "../../lib/admin";

const LIMIT = 10;

export default function FinancePage() {
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await getPage<LedgerRow>("/api/admin/ledger", "ledger", { page, limit: LIMIT });
      setLedger(r.rows);
      setTotal(r.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ledger");
    } finally {
      setLoading(false);
    }
  }, [page]);

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

  const exportLedger = async () => {
    try {
      const rows = ["booking,total_paisa,commission_paisa,method"];
      let p = 1;
      for (;;) {
        const r = await getPage<LedgerRow>("/api/admin/ledger", "ledger", { page: p, limit: 50 });
        for (const b of r.rows) {
          rows.push(`${b.booking_no},${b.total_paisa},${b.commission_paisa},${b.payment_method}`);
        }
        if (r.rows.length < 50 || p * 50 >= r.total) break;
        p += 1;
      }
      const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "commission-ledger.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-error-container p-3 text-sm font-medium text-error">{error}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-on-surface-variant tabular-nums">{total} ledger entries</p>
        <Button variant="outline" onClick={() => void exportLedger()}>Export ledger CSV</Button>
      </div>
      {loading ? (
        <SkeletonRows rows={4} />
      ) : (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="bg-surface-container text-left text-[11px] font-extrabold tracking-wider uppercase"><th className="px-4 py-2.5">Booking</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Commission</th><th className="px-4 py-2.5">Method</th><th className="px-4 py-2.5">Settlement</th><th className="px-4 py-2.5">Actions</th></tr></thead>
            <tbody className="tabular-nums">
              {ledger.map((b) => (
                <tr key={b.booking_no} className="border-t border-outline">
                  <td className="px-4 py-2.5 font-semibold"><Link to={`/track/${b.booking_no}`} className="hover:text-primary">{b.booking_no}</Link></td>
                  <td className="px-4 py-2.5 text-right">{formatNPR(Number(b.total_paisa))}</td>
                  <td className="px-4 py-2.5 text-right">{formatNPR(Number(b.commission_paisa))}</td>
                  <td className="px-4 py-2.5">{b.payment_method}</td>
                  <td className="px-4 py-2.5">
                    {b.payment_method === "cash"
                      ? b.is_settled
                        ? <Badge tone="success">Settled</Badge>
                        : <Badge tone="warning">Owed</Badge>
                      : <Badge tone="success">Auto-settled</Badge>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      {b.payment_method === "cash" && !b.is_settled && b.worker_id && (
                        <Button
                          variant="outline"
                          onClick={() => void run(() => post("/api/admin/settlements", {
                            workerId: b.worker_id,
                            amountPaisa: Number(b.commission_paisa),
                            kind: "collection",
                            note: `Cash commission for ${b.booking_no}`,
                          }))}
                        >
                          Record settlement
                        </Button>
                      )}
                      {b.payment_state === "verified" && b.payment_id && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            if (!window.confirm(`Refund ${formatNPR(Number(b.total_paisa))} for ${b.booking_no}?`)) return;
                            void run(() => post("/api/admin/refunds", {
                              paymentId: b.payment_id,
                              amountPaisa: Number(b.total_paisa),
                              reason: "Admin refund",
                            }));
                          }}
                        >
                          Refund
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">No completed revenue yet.</td></tr>
              )}
            </tbody>
          </table>
          <div className="px-4 pb-3">
            <Pager page={page} limit={LIMIT} total={total} onPage={setPage} />
          </div>
        </Card>
      )}
      <p className="mt-3 text-xs text-on-surface-variant">
        Ledger math: commission = ⌊total × bps / 10000⌋ in integer paisa. Snapshots never change after completion.
      </p>
    </div>
  );
}
