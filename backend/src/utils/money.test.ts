import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcCommission, earnPoints, redeemValue } from "./money.js";

describe("money (integer paisa)", () => {
  it("computes 15% of NPR 2000 as NPR 300", () => {
    assert.equal(calcCommission(200000, 1500), 30000);
  });
  it("floors fractional paisa instead of rounding up", () => {
    assert.equal(calcCommission(999, 1500), 149);
  });
  it("rejects negative amounts and out-of-range rates", () => {
    assert.throws(() => calcCommission(-1, 1500));
    assert.throws(() => calcCommission(100, 10001));
  });
  it("earns 1 point per NPR 100", () => {
    assert.equal(earnPoints(80000), 8);
    assert.equal(earnPoints(9999), 0);
  });
  it("redeems 100 points for NPR 50", () => {
    assert.equal(redeemValue(100), 5000);
    assert.equal(redeemValue(250), 10000);
    assert.equal(redeemValue(99), 0);
  });
});
