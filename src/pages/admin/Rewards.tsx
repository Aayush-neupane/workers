import { useCallback, useEffect, useState } from "react";
import { Button, Card, Field, TextField } from "../../components/ui";
import { SkeletonRows } from "../../components/ops";
import { Pager } from "../../components/AdminNav";
import { api, put } from "../../lib/api";
import { formatNPR } from "../../lib/format";
import { getPage, type RewardRule } from "../../lib/admin";

interface RewardTx {
  id: string;
  reason: string;
  points: number;
}

const LIMIT = 15;

const FIELDS: { key: keyof RewardRule; label: string; hint: string }[] = [
  { key: "rewardPerNpr100", label: "Points per NPR 100", hint: "Earn rate on completed bookings" },
  { key: "milestoneBookings", label: "Milestone bookings", hint: "Bookings needed for a milestone bonus" },
  { key: "milestoneBonus", label: "Milestone bonus points", hint: "Points granted at each milestone" },
  { key: "redeemPoints", label: "Points per redemption", hint: "Points consumed per discount" },
  { key: "redeemDiscountPaisa", label: "Discount per redemption (paisa)", hint: "Paisa off per redemption" },
];

export default function RewardsPage() {
  const [rules, setRules] = useState<RewardRule>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [txs, setTxs] = useState<RewardTx[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [r, t] = await Promise.all([
        api<RewardRule>("/api/admin/rewards/rules"),
        getPage<RewardTx>("/api/admin/rewards/ledger", "ledger", { page, limit: LIMIT }),
      ]);
      setRules(r);
      setDraft(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])));
      setTxs(t.rows);
      setTotal(t.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load rewards");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved("");
    const patch: Record<string, number> = {};
    for (const f of FIELDS) {
      const raw = draft[String(f.key)];
      if (raw === undefined || raw === "") continue;
      const v = Number(raw);
      if (!Number.isInteger(v) || v < 0) {
        setError(`${f.label} must be a non-negative integer.`);
        return;
      }
      if (v !== rules[f.key]) patch[String(f.key)] = v;
    }
    if (Object.keys(patch).length === 0) {
      setSaved("No changes.");
      return;
    }
    try {
      await put("/api/admin/rewards/rules", patch);
      setSaved("Rules saved — applies to future bookings.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rules");
    }
  };

  if (loading) return <SkeletonRows rows={4} />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        {error && (
          <p role="alert" className="mb-4 rounded-md bg-error-container p-3 text-sm font-medium text-error">{error}</p>
        )}
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold">Reward rules</h3>
          <p className="text-xs text-on-surface-variant">Settings-driven — refunds reverse the points they issued.</p>
          <form onSubmit={(e) => void saveRules(e)} className="mt-3 space-y-3">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <TextField
                  value={draft[String(f.key)] ?? ""}
                  onChange={(e) => setDraft((p) => ({ ...p, [String(f.key)]: e.target.value }))}
                  inputMode="numeric"
                  placeholder={String(rules[f.key] ?? "")}
                />
                <p className="mt-0.5 text-xs text-on-surface-variant">{f.hint}</p>
              </Field>
            ))}
            <Button type="submit">Save rules</Button>
            {saved && <p role="status" className="text-sm font-bold text-success">{saved}</p>}
          </form>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold">Reward ledger ({total})</h3>
        <ul className="mt-2 max-h-96 space-y-1.5 overflow-auto text-sm tabular-nums">
          {[...txs].reverse().map((t) => (
            <li key={t.id} className="flex justify-between gap-2 border-t border-outline pt-1.5 first:border-0">
              <span>{t.reason}</span>
              <strong className={t.points < 0 ? "text-error" : "text-success"}>{t.points > 0 ? `+${t.points}` : t.points}</strong>
            </li>
          ))}
          {txs.length === 0 && <li className="text-on-surface-variant">No reward activity yet.</li>}
        </ul>
        <Pager page={page} limit={LIMIT} total={total} onPage={setPage} />
        <p className="mt-3 text-xs text-on-surface-variant">
          {typeof rules.redeemPoints === "number" && typeof rules.redeemDiscountPaisa === "number"
            ? `Currently ${rules.redeemPoints} pts = ${formatNPR(rules.redeemDiscountPaisa)}.`
            : "Redemption rate not configured yet."}
        </p>
      </Card>
    </div>
  );
}
