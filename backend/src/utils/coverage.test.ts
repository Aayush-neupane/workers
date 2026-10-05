import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isDamakCity,
  mentionsDamak,
  normalizeArea,
  parseWard,
  serviceServesDamak,
} from "./coverage.js";

describe("coverage (Damak-only gate)", () => {
  it("accepts Damak variants, rejects everything else", () => {
    assert.equal(isDamakCity("Damak"), true);
    assert.equal(isDamakCity("Damak Municipality"), true);
    assert.equal(isDamakCity("Damak, Jhapa"), true);
    assert.equal(isDamakCity("Biratnagar"), false);
    assert.equal(isDamakCity("Birtamode"), false);
    assert.equal(isDamakCity(""), false);
    assert.equal(isDamakCity("Damakola"), false);
    assert.equal(isDamakCity("NotDamak"), false);
  });

  it("requires a Damak mention in free text", () => {
    assert.equal(mentionsDamak("Damak-5, Himal Chowk, House 12"), true);
    assert.equal(mentionsDamak("Himal Chowk, House 12"), false);
    assert.equal(mentionsDamak("Damakola street"), false);
    assert.equal(mentionsDamak("NotDamak town"), false);
    assert.equal(normalizeArea("Damak-5").includes("damak"), true);
  });

  it("parses wards 1-10, ignores missing/out-of-range", () => {
    assert.equal(parseWard("Damak-5, Himal Chowk"), 5);
    assert.equal(parseWard("ward 3, near school"), 3);
    assert.equal(parseWard("Ward No. 7"), 7);
    assert.equal(parseWard("W-5, main road"), 5);
    assert.equal(parseWard("Himal Chowk near temple"), null);
    assert.equal(parseWard("Damak-11, far away"), null);
    assert.equal(parseWard("New 5, random street"), null);
  });

  it("gates service areas on Damak", () => {
    assert.equal(serviceServesDamak(["Damak"]), true);
    assert.equal(serviceServesDamak([]), true);
    assert.equal(serviceServesDamak(undefined), true);
    assert.equal(serviceServesDamak(["Biratnagar"]), false);
  });
});
