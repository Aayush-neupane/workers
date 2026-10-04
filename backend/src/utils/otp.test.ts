import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateOtp, hashOtp, otpExpiry, OTP_MAX_ATTEMPTS, OTP_TTL_MIN } from "./otp.js";

describe("completion OTP", () => {
  it("generates 6-digit codes", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateOtp();
      assert.match(code, /^\d{6}$/);
    }
  });

  it("generates unique codes (no repeats in a batch)", () => {
    const batch = new Set(Array.from({ length: 50 }, generateOtp));
    assert.ok(batch.size > 45);
  });

  it("hashes deterministically and never equals the plain code", () => {
    const h1 = hashOtp("123456");
    assert.equal(h1, hashOtp("123456"));
    assert.notEqual(h1, "123456");
    assert.match(h1, /^[0-9a-f]{64}$/);
  });

  it("expires in 10 minutes with a 5-attempt budget", () => {
    assert.equal(OTP_TTL_MIN, 10);
    assert.equal(OTP_MAX_ATTEMPTS, 5);
    const exp = otpExpiry(new Date("2026-01-01T00:00:00Z"));
    assert.equal(exp.toISOString(), "2026-01-01T00:10:00.000Z");
  });
});
