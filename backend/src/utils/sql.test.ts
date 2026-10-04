import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { likePattern } from "./sql.js";
import { pageLimit } from "./pagination.js";

describe("likePattern", () => {
  it("wraps input in % wildcards", () => {
    assert.equal(likePattern("ram"), "%ram%");
  });
  it("escapes % _ and backslash literally", () => {
    assert.equal(likePattern("100%_\\"), "%100\\%\\_\\\\%");
  });
});

describe("pageLimit", () => {
  it("defaults to page 1, limit 20", () => {
    assert.deepEqual(pageLimit({}, 20, 50), { page: 1, limit: 20, offset: 0 });
  });
  it("caps limit at max and floors page at 1", () => {
    assert.deepEqual(pageLimit({ page: "0", limit: "999" }, 20, 50), { page: 1, limit: 50, offset: 0 });
    assert.deepEqual(pageLimit({ page: "3", limit: "10" }, 20, 50), { page: 3, limit: 10, offset: 20 });
  });
});
