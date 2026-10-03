import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { esewaSignature, esewaVerifyCallback } from "./payments.js";

describe("esewa signing", () => {
  it("round-trips a COMPLETE callback", () => {
    const total = "800";
    const uuid = "BK-1042-abc";
    const code = "EPAYTEST";
    const sig = esewaSignature(total, uuid, code);
    const payload = {
      transaction_code: "000XXXX",
      status: "COMPLETE",
      total_amount: total,
      transaction_uuid: uuid,
      product_code: code,
      signed_field_names: "total_amount,transaction_uuid,product_code",
      signature: sig,
    };
    const data = Buffer.from(JSON.stringify(payload)).toString("base64");
    assert.equal(esewaVerifyCallback({ data }), true);
  });
  it("rejects tampered amounts and non-COMPLETE states", () => {
    const sig = esewaSignature("800", "u1", "EPAYTEST");
    const bad = {
      status: "COMPLETE",
      total_amount: "801",
      transaction_uuid: "u1",
      product_code: "EPAYTEST",
      signed_field_names: "total_amount,transaction_uuid,product_code",
      signature: sig,
    };
    assert.equal(
      esewaVerifyCallback({ data: Buffer.from(JSON.stringify(bad)).toString("base64") }),
      false,
    );
    const pending = { ...bad, total_amount: "800", status: "PENDING" };
    assert.equal(
      esewaVerifyCallback({ data: Buffer.from(JSON.stringify(pending)).toString("base64") }),
      false,
    );
  });
});
