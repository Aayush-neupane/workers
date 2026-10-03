import crypto from "node:crypto";
import { env, esewaEnabled, khaltiEnabled } from "../config/env.js";

export type Provider = "cash" | "esewa" | "khalti";

export function providers() {
  return { cash: true, esewa: esewaEnabled(), khalti: khaltiEnabled() };
}

// ---------- eSewa ePay v2 ----------
// Docs: merchant signs "total_amount,transaction_uuid,product_code" with the
// secret (HMAC-SHA256, base64). Status is verified server-to-server.

const ESEWA_FORM_URL = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
const ESEWA_STATUS_URL = "https://rc-epay.esewa.com.np/api/epay/transaction/status/";

export function esewaSignature(totalAmount: string, transactionUuid: string, productCode: string): string {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  return crypto.createHmac("sha256", env.ESEWA_SECRET_KEY).update(message).digest("base64");
}

export function esewaInitiate(args: {
  amountPaisa: number;
  transactionUuid: string;
  successUrl: string;
  failureUrl: string;
}) {
  if (!esewaEnabled()) throw new Error("eSewa not configured");
  // eSewa amounts are NPR strings; paisa must convert exactly.
  if (args.amountPaisa % 100 !== 0) throw new Error("eSewa needs whole-rupee amounts");
  const total = String(args.amountPaisa / 100);
  const fields = {
    amount: total,
    tax_amount: "0",
    total_amount: total,
    transaction_uuid: args.transactionUuid,
    product_code: env.ESEWA_MERCHANT_CODE,
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: args.successUrl,
    failure_url: args.failureUrl,
    signed_field_names: "total_amount,transaction_uuid,product_code",
    signature: esewaSignature(total, args.transactionUuid, env.ESEWA_MERCHANT_CODE),
  };
  return { endpoint: ESEWA_FORM_URL, fields };
}

export function esewaVerifyCallback(body: Record<string, string>): boolean {
  // eSewa posts back base64-encoded JSON {transaction_code, status, total_amount,
  // transaction_uuid, product_code, signed_field_names, signature}.
  const raw = body.data;
  if (!raw) return false;
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, string>;
    if (decoded.status !== "COMPLETE") return false;
    const names = (decoded.signed_field_names ?? "").split(",");
    const message = names.map((n) => `${n}=${decoded[n] ?? ""}`).join(",");
    const expected = crypto.createHmac("sha256", env.ESEWA_SECRET_KEY).update(message).digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(decoded.signature ?? "");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function esewaStatusCheck(
  totalAmount: string,
  transactionUuid: string,
): Promise<boolean> {
  if (!esewaEnabled()) return false;
  const url = `${ESEWA_STATUS_URL}?product_code=${encodeURIComponent(env.ESEWA_MERCHANT_CODE)}&total_amount=${encodeURIComponent(totalAmount)}&transaction_uuid=${encodeURIComponent(transactionUuid)}`;
  const res = await fetch(url);
  if (!res.ok) return false;
  const body = (await res.json()) as { status?: string };
  return body.status === "COMPLETE";
}

// ---------- Khalti ePayment ----------
// Sandbox: https://dev.khalti.com/api/v2/epayment/. Lookup is the source of
// truth — never trust the return_url redirect alone.

const KHALTI_BASE = "https://dev.khalti.com/api/v2/epayment";

export async function khaltiInitiate(args: {
  amountPaisa: number;
  purchaseOrderId: string;
  purchaseOrderName: string;
  returnUrl: string;
  websiteUrl: string;
}): Promise<{ pidx: string; paymentUrl: string }> {
  if (!khaltiEnabled()) throw new Error("Khalti not configured");
  const res = await fetch(`${KHALTI_BASE}/initiate/`, {
    method: "POST",
    headers: { Authorization: `Key ${env.KHALTI_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      return_url: args.returnUrl,
      website_url: args.websiteUrl,
      amount: args.amountPaisa,
      purchase_order_id: args.purchaseOrderId,
      purchase_order_name: args.purchaseOrderName,
    }),
  });
  if (!res.ok) throw new Error("Khalti initiate failed");
  const body = (await res.json()) as { pidx: string; payment_url: string };
  return { pidx: body.pidx, paymentUrl: body.payment_url };
}

export async function khaltiLookup(pidx: string): Promise<{ completed: boolean; amountPaisa: number }> {
  if (!khaltiEnabled()) return { completed: false, amountPaisa: 0 };
  const res = await fetch(`${KHALTI_BASE}/lookup/`, {
    method: "POST",
    headers: { Authorization: `Key ${env.KHALTI_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pidx }),
  });
  if (!res.ok) return { completed: false, amountPaisa: 0 };
  const body = (await res.json()) as { status?: string; total_amount?: number };
  return { completed: body.status === "Completed", amountPaisa: body.total_amount ?? 0 };
}
