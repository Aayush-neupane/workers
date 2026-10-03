import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransition } from "./transitions.js";

describe("booking transitions", () => {
  it("allows the happy path forward", () => {
    const path = [
      ["pending", "awaiting-worker"],
      ["awaiting-worker", "confirmed"],
      ["confirmed", "en-route"],
      ["en-route", "in-progress"],
      ["in-progress", "awaiting-confirmation"],
      ["awaiting-confirmation", "completed"],
    ] as const;
    for (const [from, to] of path) assert.equal(canTransition(from, to), true);
  });
  it("blocks skips and backward moves", () => {
    assert.equal(canTransition("pending", "completed"), false);
    assert.equal(canTransition("completed", "pending"), false);
    assert.equal(canTransition("cancelled", "pending"), false);
  });
  it("allows dispute and resolution", () => {
    assert.equal(canTransition("in-progress", "disputed"), true);
    assert.equal(canTransition("disputed", "completed"), true);
    assert.equal(canTransition("disputed", "cancelled"), true);
  });
});
