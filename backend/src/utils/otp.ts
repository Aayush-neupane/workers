import { createHash, randomInt } from "node:crypto";

export const OTP_TTL_MIN = 10;
export const OTP_MAX_ATTEMPTS = 5;

/** 6-digit numeric code. Unpredictable — crypto RNG, never Math.random. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** sha256 hex — what we store; the plain code only ever reaches the customer. */
export function hashOtp(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function otpExpiry(from = new Date()): Date {
  return new Date(from.getTime() + OTP_TTL_MIN * 60 * 1000);
}
