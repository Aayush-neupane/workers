import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBookingNo, isUuid, resolveBookingId } from "./booking.js";

describe("booking refs", () => {
  it("accepts new 6-digit and legacy 4-digit booking numbers", () => {
    assert.equal(isBookingNo("BK-200123"), true);
    assert.equal(isBookingNo("BK-2001"), true);
    assert.equal(isBookingNo("BK-123"), false);
    assert.equal(isBookingNo("BK-ABC"), false);
    assert.equal(isBookingNo("BK-2001'; DROP TABLE bookings;--"), false);
    assert.equal(isBookingNo(""), false);
  });

  it("accepts UUIDs, rejects lookalikes", () => {
    assert.equal(isUuid("73246495-c7e4-4975-9554-d8a16ba0336f"), true);
    assert.equal(isUuid("not-a-uuid"), false);
    assert.equal(isUuid("73246495c7e449549554d8a16ba0336f"), false);
  });

  it("resolves known refs and nulls unknown/invalid ones", async () => {
    const run = {
      query: async (text: string, params?: unknown[]) => {
        if (String(params?.[0]) === "BK-200123") {
          return { rows: [{ id: "booking-1" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    assert.equal(await resolveBookingId(run, "BK-200123"), "booking-1");
    assert.equal(await resolveBookingId(run, "BK-999999"), null);
    assert.equal(await resolveBookingId(run, "garbage"), null);
    assert.equal(await resolveBookingId(run, "BK-200123' OR '1'='1"), null);
  });
});
