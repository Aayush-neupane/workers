import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export const OTP_TTL_MIN = 10;
export const OTP_MAX_ATTEMPTS = 5;
/** Minimum gap between two codes for the same booking (brute-force throttle). */
export const OTP_REISSUE_DELAY_MS = 60_000;

/** 6-digit numeric code. Unpredictable — crypto RNG, never Math.random. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * HMAC-SHA256 hex with the server secret as pepper — what we store; the
 * plain code only ever reaches the customer. Unsalted sha256 of a 6-digit
 * code is rainbow-table trivial on a DB leak, HMAC is not.
 */
export function hashOtp(code: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(code, "utf8").digest("hex");
}

/** Constant-time comparison — no timing oracle for code guesses. */
export function otpMatches(storedHex: string, candidate: string): boolean {
  const a = Buffer.from(storedHex, "hex");
  const b = Buffer.from(hashOtp(candidate), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function otpExpiry(from = new Date()): Date {
  return new Date(from.getTime() + OTP_TTL_MIN * 60 * 1000);
}
