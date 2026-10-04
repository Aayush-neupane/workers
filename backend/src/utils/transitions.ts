export type BookingStatus =
  | "pending"
  | "awaiting-worker"
  | "confirmed"
  | "en-route"
  | "in-progress"
  | "awaiting-confirmation"
  | "completed"
  | "cancelled"
  | "disputed";

export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
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
  return (TRANSITIONS[from] ?? []).includes(to);
}

export type VerificationState =
  | "draft"
  | "awaiting-documents"
  | "under-review"
  | "verified"
  | "rejected"
  | "suspended";
