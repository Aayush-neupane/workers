import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validPin } from "./geo.js";

describe("geo pins", () => {
  it("accepts Damak-area pins, rejects junk", () => {
    assert.equal(validPin(26.655, 87.699), true); // Himal Chowk approx
    assert.equal(validPin(null, null), true); // pins are optional
    assert.equal(validPin(26.655, null), false);
    assert.equal(validPin(0, 0), false);
    assert.equal(validPin(27.7, 85.3), true); // elsewhere in Nepal
    assert.equal(validPin(40.7, -74), false); // New York
  });
});
