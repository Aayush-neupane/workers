import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Gift, Users } from "lucide-react";
import { Button, Card, EmptyState, PageHero } from "../components/ui";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";

interface Tx {
  id: string;
  points: number;
  kind: "earn" | "redeem" | "reverse" | "bonus";
  reason: string;
  at: string;
}

interface Rules {
  rewardPerNpr100: number;
  redeemPoints: number;
  redeemDiscountPaisa: number;
  milestoneBookings: number;
  milestoneBonus: number;
}

export default function Rewards() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [balance, setBalance] = useState(0);
  const [rules, setRules] = useState<Rules>({ rewardPerNpr100: 1, redeemPoints: 100, redeemDiscountPaisa: 5000, milestoneBookings: 5, milestoneBonus: 100 });
  const [referral, setReferral] = useState<{ code: string; bonus: number; uses: { referee: string; rewarded: boolean; created_at: string }[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState("");
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  function load() {
    setLoadError("");
    api<{ txs: Tx[]; balance: number }>("/api/rewards/mine").then((d) => { setTxs(d.txs); setBalance(d.balance); }).catch(() => setLoadError("Couldn't load your rewards."));
    api<Rules>("/api/settings").then(setRules).catch(() => {});
    api<typeof referral>("/api/referrals/mine").then(setReferral).catch(() => {});
  }

  useEffect(load, []);

  async function copyCode() {
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral.code);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const progress = Math.min(Math.max(balance, 0), rules.redeemPoints);
  const progressPct = rules.redeemPoints > 0 ? (progress / rules.redeemPoints) * 100 : 0;

  return (
    <div className="fade-up">
      <PageHero eyebrow="Loyalty" title="Rewards that respect you" body="Earned only on completed jobs. No tiers, no expiry surprises — points in, discounts out." />
      <div className="wrap grid items-start gap-5 py-8 lg:grid-cols-[320px_1fr]">
        <div className="ring-band dotgrid-light rounded-lg p-6 text-white lg:sticky lg:top-24">
          <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-[0.14em] text-marigold-300 uppercase">
            <Gift size={14} aria-hidden="true" /> Balance
          </p>
          <p className="font-display mt-1 text-5xl font-semibold">{balance} <span className="text-2xl">pts</span></p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/25" role="progressbar"
            aria-valuenow={progress} aria-valuemin={0} aria-valuemax={rules.redeemPoints} aria-label="Progress to next reward">
            <div className="h-full rounded-full bg-marigold-300" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/75">
            {balance >= rules.redeemPoints
              ? `Reward unlocked — redeem ${rules.redeemPoints} pts for Rs ${rules.redeemDiscountPaisa / 100} off at checkout`
              : `${rules.redeemPoints - progress} points to your next Rs ${rules.redeemDiscountPaisa / 100} reward`}
          </p>
          <Link to="/services" className="mt-4 inline-block"><Button variant="gold">Earn more</Button></Link>
        </div>
        <div className="space-y-5">
          {loadError && (
            <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-error-container p-3.5 text-sm font-medium text-error">
              {loadError}
              <Button variant="outline" onClick={load}>Retry</Button>
            </p>
          )}
          <Card className="p-5">
            <p className="font-bold">How it works</p>
            <ul className="mt-2 grid gap-2 text-sm text-on-surface-variant sm:grid-cols-3">
              <li className="rounded-md bg-surface-container p-3"><strong className="text-on-surface">{rules.rewardPerNpr100} pt / Rs 100</strong><br />earned per completed booking</li>
              <li className="rounded-md bg-surface-container p-3"><strong className="text-on-surface">+{rules.milestoneBonus} pts</strong><br />bonus every {rules.milestoneBookings} completions</li>
              <li className="rounded-md bg-surface-container p-3"><strong className="text-on-surface">{rules.redeemPoints} pts = Rs {rules.redeemDiscountPaisa / 100}</strong><br />redeemable at checkout</li>
            </ul>
            <p className="mt-2 text-xs text-on-surface-variant">Refunded bookings reverse their points automatically. One earn entry per booking — duplicates are impossible by database constraint.</p>
          </Card>
          <Card className="p-5">
            <p className="flex items-center gap-1.5 font-bold"><Users size={16} aria-hidden="true" /> Refer friends — both earn {referral?.bonus ?? 50} pts</p>
            <p className="mt-1 text-sm text-on-surface-variant">Your friend enters your code at signup. When their first job completes, you both get bonus points. Self-referrals are rejected.</p>
            {referral && (
              <>
                <button onClick={copyCode}
                  className="mt-3 flex w-full items-center justify-between gap-2 rounded-md border-2 border-dashed border-primary/50 bg-primary-container/50 px-4 py-3 font-mono text-lg font-extrabold tracking-widest transition active:scale-[0.99]">
                  {referral.code}
                  <span className="inline-flex items-center gap-1 font-sans text-xs font-bold text-primary">
                    <Copy size={14} aria-hidden="true" /> {copied ? "Copied!" : "Copy"}
                  </span>
                </button>
                {referral.uses.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {referral.uses.map((u, i) => (
                      <li key={i} className="flex justify-between rounded-md bg-surface-container px-3 py-2">
                        <span>{u.referee}</span>
                        <span className={u.rewarded ? "font-bold text-success" : "text-on-surface-variant"}>
                          {u.rewarded ? `+${referral.bonus} pts paid` : "waiting for first job"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-on-surface-variant">No invites yet — share your code in the family group.</p>
                )}
              </>
            )}
          </Card>
          <Card className="overflow-x-auto">
            <p className="px-4 pt-4 font-bold">History</p>
            {txs.length === 0 ? (
              <div className="p-4"><EmptyState title="No reward activity yet" body="Complete a booking to earn your first points." /></div>
            ) : (
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="text-left text-xs text-on-surface-variant">
                  <th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Reason</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5 text-right">Points</th>
                </tr></thead>
                <tbody>
                  {[...txs].reverse().map((t) => (
                    <tr key={t.id} className="border-t border-outline/60">
                      <td className="px-4 py-2.5 text-xs text-on-surface-variant">{formatDate(t.at)}</td>
                      <td className="px-4 py-2.5">{t.reason}</td>
                      <td className="px-4 py-2.5 capitalize">{t.kind}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${t.points < 0 ? "text-error" : "text-success"}`}>
                        {t.points > 0 ? `+${t.points}` : t.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
