/** Integer paisa math — never floats for money. rateBps: basis points (1500 = 15%). */
export function calcCommission(totalPaisa: number, rateBps: number): number {
  if (!Number.isInteger(totalPaisa) || totalPaisa < 0) throw new Error("bad amount");
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new Error("bad rate");
  return Math.floor((totalPaisa * rateBps) / 10000);
}

/** Loyalty: 1 point per NPR 100 of eligible spending. */
export function earnPoints(totalPaisa: number): number {
  if (!Number.isInteger(totalPaisa) || totalPaisa < 0) throw new Error("bad amount");
  return Math.floor(totalPaisa / 10000);
}

/** Redemption: 100 points = NPR 50 discount. Returns discount paisa. */
export function redeemValue(points: number): number {
  if (!Number.isInteger(points) || points < 0) throw new Error("bad points");
  return Math.floor(points / 100) * 5000;
}
