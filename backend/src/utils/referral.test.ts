import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { referralCodeFor, normalizeReferral } from "./referral.js";

describe("referrals", () => {
  it("builds readable codes from the owner name", () => {
    const code = referralCodeFor("Gita Sharma", () => 0);
    assert.equal(code, "GITASH-AAAAAA");
  });

  it("falls back when the name has no latin letters", () => {
    assert.match(referralCodeFor("सजिलो", () => 0.99), /^SAJILO-/);
  });

  it("normalizes user input", () => {
    assert.equal(normalizeReferral("  gita-4f8k2q "), "GITA-4F8K2Q");
  });

  it("generates unique codes", () => {
    const set = new Set(Array.from({ length: 100 }, () => referralCodeFor("Ram")));
    assert.equal(set.size, 100);
  });
});
