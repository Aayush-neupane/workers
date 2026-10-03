export type Role = "customer" | "worker" | "admin";

export type VerificationState =
  | "draft"
  | "awaiting-documents"
  | "under-review"
  | "verified"
  | "rejected"
  | "suspended";

export type PricingModel =
  | "fixed"
  | "starting"
  | "hourly"
  | "inspection-quote"
  | "custom-quote";

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

export type PaymentMethod = "cash" | "esewa" | "khalti";
export type PaymentStatus =
  | "unpaid"
  | "pending-verification"
  | "paid"
  | "refunded"
  | "partially-refunded"
  | "failed";

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  commissionBps: number;
}

export interface Service {
  id: string;
  categoryId: string;
  categorySlug?: string;
  name: string;
  description: string;
  pricingModel: PricingModel;
  /** Minor units (paisa). Meaning depends on pricingModel. */
  basePricePaisa: number;
  unit?: string;
  durationMin: number;
  areas: string[];
  rating: number;
  jobsDone: number;
  requirements: string[];
  exclusions: string[];
}

export interface Worker {
  id: string;
  name: string;
  avatarHue: number;
  categoryIds: string[];
  verification: VerificationState;
  active: boolean;
  rating: number;
  jobsDone: number;
  yearsExp: number;
  areas: string[];
  bio: string;
  joinedAt: string;
}

export interface Address {
  id: string;
  label: string;
  line: string;
  city: string;
  phone: string;
}

export interface StatusEvent {
  status: BookingStatus;
  at: string;
  by: Role;
  note?: string;
}

export interface Booking {
  id: string;
  serviceId: string;
  serviceName?: string;
  workerId?: string;
  workerName?: string;
  status: BookingStatus;
  addressId: string;
  addressText?: string;
  slot: string;
  instructions: string;
  estimatePaisa: number;
  discountPaisa?: number;
  finalPaisa?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  commissionBps: number;
  commissionPaisa?: number;
  history: StatusEvent[];
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  workerId: string;
  rating: number;
  text: string;
  at: string;
}

export interface RewardTx {
  id: string;
  kind: "earn" | "redeem" | "reverse" | "bonus";
  points: number;
  reason: string;
  at: string;
}

export interface Ticket {
  id: string;
  subject: string;
  status: "open" | "in-progress" | "resolved";
  messages: { from: string; text: string; at: string }[];
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
}
