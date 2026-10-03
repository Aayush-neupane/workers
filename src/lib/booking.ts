import type { BookingStatus, VerificationState } from "./types";

/** Valid booking state transitions. */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["awaiting-worker", "cancelled"],
  "awaiting-worker": ["confirmed", "cancelled"],
  confirmed: ["en-route", "cancelled"],
  "en-route": ["in-progress", "cancelled"],
  "in-progress": ["awaiting-confirmation", "disputed"],
  "awaiting-confirmation": ["completed", "disputed"],
  completed: [],
  cancelled: [],
  disputed: ["completed", "cancelled"],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

/** Only verified + active workers may receive assignments. */
export function isEligibleWorker(v: {
  verification: VerificationState;
  active: boolean;
}): boolean {
  return v.verification === "verified" && v.active;
}

/**
 * Commission in paisa using integer math.
 * rateBps = basis points, e.g. 1500 = 15%.
 */
export function calcCommission(totalPaisa: number, rateBps: number): number {
  return Math.floor((totalPaisa * rateBps) / 10000);
}

/** Loyalty: 1 point per NPR 100 of eligible spending. */
export function earnPoints(totalPaisa: number): number {
  return Math.floor(totalPaisa / 10000);
}

/** Redemption: 100 points = NPR 50 discount. Returns discount paisa. */
export function redeemValue(points: number): number {
  return Math.floor(points / 100) * 5000;
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  "awaiting-worker": "Awaiting worker confirmation",
  confirmed: "Confirmed",
  "en-route": "Worker en route",
  "in-progress": "In progress",
  "awaiting-confirmation": "Awaiting your confirmation",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};
