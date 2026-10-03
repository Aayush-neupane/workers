import { Link } from "react-router-dom";
import { Gift } from "lucide-react";
import { Button, Card, PageHero } from "../components/ui";
import { PLATFORM } from "../data/mock";
import { useStore } from "../lib/store";
import { formatDate } from "../lib/format";

export default function Rewards() {
  const { rewardTxs, rewardBalance } = useStore();
  const progress = Math.min(rewardBalance, PLATFORM.redeemPoints);

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Loyalty"
        title="Rewards that respect you"
        body="No tiers, no dark patterns. Earn on eligible spend, redeem for real discounts."
      />
      <div className="wrap max-w-3xl py-8">
      <Card className="ring-band dotgrid-light border-0 p-6 text-white">
        <p className="flex items-center gap-2 text-sm opacity-90">
          <Gift size={16} aria-hidden="true" /> Your balance
        </p>
        <p className="font-display mt-1 text-5xl font-semibold">{rewardBalance} <span className="text-2xl">points</span></p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={PLATFORM.redeemPoints} aria-label="Progress to next reward">
          <div className="h-full rounded-full bg-white" style={{ width: `${(progress / PLATFORM.redeemPoints) * 100}%` }} />
        </div>
        <p className="mt-2 text-sm opacity-90">
          {PLATFORM.redeemPoints - progress > 0
            ? `${PLATFORM.redeemPoints - progress} points to your next Rs 50 reward`
            : "Reward unlocked — redeem it at checkout"}
        </p>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          [`${PLATFORM.rewardPerNpr100} pt / Rs 100`, "Earn on every eligible completed booking"],
          [`+${PLATFORM.milestoneBonus} pts`, `Bonus every ${PLATFORM.milestoneBookings} completed bookings`],
          [`${PLATFORM.redeemPoints} pts = Rs 50`, "Redeem during checkout, applied instantly"],
        ].map(([t, b]) => (
          <Card key={t} className="p-4">
            <p className="font-bold">{t}</p>
            <p className="mt-1 text-sm text-on-surface-variant">{b}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 text-xl font-bold">Transaction history</h2>
      <Card className="mt-3 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container text-left text-xs tracking-wide uppercase">
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Reason</th>
              <th className="px-4 py-2.5 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {[...rewardTxs].reverse().map((t) => (
              <tr key={t.id} className="border-t border-outline">
                <td className="px-4 py-2.5 text-on-surface-variant">{formatDate(t.at)}</td>
                <td className="px-4 py-2.5">{t.reason}</td>
                <td className={`px-4 py-2.5 text-right font-bold ${t.points < 0 ? "text-error" : "text-success"}`}>
                  {t.points > 0 ? `+${t.points}` : t.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-6 text-center">
        <Link to="/services">
          <Button>Book a service to earn</Button>
        </Link>
      </div>
      </div>
    </div>
  );
}
