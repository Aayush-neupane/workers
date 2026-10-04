import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransition } from "./transitions.js";

describe("booking transitions", () => {
  it("allows the happy path", () => {
    assert.equal(canTransition("pending", "awaiting-worker"), true);
    assert.equal(canTransition("awaiting-worker", "confirmed"), true);
    assert.equal(canTransition("confirmed", "en-route"), true);
    assert.equal(canTransition("en-route", "in-progress"), true);
    assert.equal(canTransition("in-progress", "awaiting-confirmation"), true);
    assert.equal(canTransition("awaiting-confirmation", "completed"), true);
  });

  it("blocks skips and backward moves", () => {
    assert.equal(canTransition("pending", "completed"), false);
    assert.equal(canTransition("completed", "cancelled"), false);
  });

  it("allows dispute and resolution", () => {
    assert.equal(canTransition("in-progress", "disputed"), true);
    assert.equal(canTransition("disputed", "completed"), true);
    assert.equal(canTransition("awaiting-confirmation", "disputed"), true);
  });
});
