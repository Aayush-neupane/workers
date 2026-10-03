import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bookingKey } from "./lookup.js";

describe("bookingKey", () => {
  it("accepts BK numbers case-insensitively", () => {
    assert.deepEqual(bookingKey("BK-1042"), { column: "booking_no", value: "BK-1042" });
    assert.deepEqual(bookingKey("bk-2752"), { column: "booking_no", value: "BK-2752" });
  });
  it("accepts UUIDs", () => {
    const id = "6aadfc49-e762-4c06-9a39-73db208b9a77";
    assert.deepEqual(bookingKey(id), { column: "id", value: id });
  });
  it("rejects garbage (no uuid-parse errors downstream)", () => {
    assert.equal(bookingKey("1"), null);
    assert.equal(bookingKey("../../etc"), null);
    assert.equal(bookingKey("BK-"), null);
  });
});
