/** Integer paisa math — never floats for money. rateBps: basis points (1500 = 15%). */
export function calcCommission(totalPaisa: number, rateBps: number): number {
  if (!Number.isInteger(totalPaisa) || totalPaisa < 0) throw new Error("bad amount");
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new Error("bad rate");
  return Math.floor((totalPaisa * rateBps) / 10000);
}

/** Loyalty: points per NPR 100 of eligible spending (rate from platform settings). */
export function earnPoints(totalPaisa: number, per100 = 1): number {
  if (!Number.isInteger(totalPaisa) || totalPaisa < 0) throw new Error("bad amount");
  return Math.floor(totalPaisa / 10000) * per100;
}
