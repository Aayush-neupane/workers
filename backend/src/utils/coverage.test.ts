import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isDamakCity,
  mentionsDamak,
  parseWard,
  serviceServesDamak,
  normalizeArea,
} from "./coverage.js";

describe("coverage (Damak-only gate)", () => {
  it("accepts Damak city variants, rejects everything else", () => {
    assert.equal(isDamakCity("Damak"), true);
    assert.equal(isDamakCity("damak"), true);
    assert.equal(isDamakCity("Damak Municipality"), true);
    assert.equal(isDamakCity("Damak, Jhapa"), true);
    assert.equal(isDamakCity("Biratnagar"), false);
    assert.equal(isDamakCity("Birtamode"), false);
    assert.equal(isDamakCity(""), false);
  });

  it("detects Damak mentions in free text (never trusts bare landmarks)", () => {
    assert.equal(mentionsDamak("Damak-5, Himal Chowk, House 12"), true);
    assert.equal(mentionsDamak("Himal Chowk, House 12"), false);
    assert.equal(normalizeArea("Damak-5").includes("damak"), true);
  });

  it("parses ward numbers 1-10, ignores missing wards", () => {
    assert.equal(parseWard("Damak-5, Himal Chowk"), 5);
    assert.equal(parseWard("Damak 10, main road"), 10);
    assert.equal(parseWard("ward 3, near school"), 3);
    assert.equal(parseWard("Ward No. 7"), 7);
    assert.equal(parseWard("Himal Chowk near temple"), null);
    assert.equal(parseWard("Damak-11, far away"), null);
  });

  it("gates service areas on Damak", () => {
    assert.equal(serviceServesDamak(["Damak"]), true);
    assert.equal(serviceServesDamak([]), true);
    assert.equal(serviceServesDamak(undefined), true);
    assert.equal(serviceServesDamak(["Biratnagar"]), false);
    assert.equal(serviceServesDamak(["Damak", "Birtamode"]), true);
  });
});
