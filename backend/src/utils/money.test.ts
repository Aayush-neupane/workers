import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcCommission, earnPoints } from "./money.js";

describe("money (integer paisa)", () => {
  it("computes 15% of NPR 2000 as NPR 300", () => {
    assert.equal(calcCommission(200000, 1500), 30000);
  });

  it("floors fractional paisa", () => {
    assert.equal(calcCommission(10001, 1500), 1500);
  });

  it("rejects bad inputs", () => {
    assert.throws(() => calcCommission(-1, 1500));
    assert.throws(() => calcCommission(100, 10001));
  });

  it("earns 1 point per NPR 100", () => {
    assert.equal(earnPoints(200000), 20);
    assert.equal(earnPoints(9999), 0);
  });
});
