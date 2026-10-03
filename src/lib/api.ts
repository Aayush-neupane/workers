import type {
  Address,
  AppNotification,
  Booking,
  BookingStatus,
  Review,
  RewardTx,
  Service,
  ServiceCategory,
  Ticket,
  Worker,
} from "./types";

const BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4001";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** AuthProvider registers this so a 401 anywhere drops the stale session. */
export function onUnauthorized(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { credentials: "include", ...init });
  } catch {
    throw new ApiError(0, "Cannot reach the server — is the backend running?");
  }
  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler?.();
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) throw new ApiError(res.status, body.error);
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
    throw new ApiError(res.status, `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function put<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function del<T>(path: string): Promise<T> {
  return api<T>(path, { method: "DELETE" });
}

// ---------- Normalizers (snake_case rows -> camelCase app types) ----------

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  icon: string;
  commission_bps: number;
}

export function toCategory(r: CategoryRow): ServiceCategory {
  return { id: r.id, slug: r.slug, name: r.name, tagline: r.tagline, icon: r.icon, commissionBps: r.commission_bps };
}

interface ServiceRow {
  id: string;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  name: string;
  description: string;
  pricing_model: Service["pricingModel"];
  base_price_paisa: string | number;
  unit: string;
  duration_min: number;
  areas: string[];
  requirements: string[];
  exclusions: string[];
  rating: number | string;
  jobs_done: number | string;
}

export function toService(r: ServiceRow): Service {
  return {
    id: r.id,
    categoryId: r.category_id,
    categorySlug: r.category_slug,
    name: r.name,
    description: r.description,
    pricingModel: r.pricing_model,
    basePricePaisa: Number(r.base_price_paisa),
    unit: r.unit,
    durationMin: r.duration_min,
    areas: r.areas ?? ["Damak"],
    rating: Number(r.rating ?? 0),
    jobsDone: Number(r.jobs_done ?? 0),
    requirements: r.requirements ?? [],
    exclusions: r.exclusions ?? [],
  };
}

interface WorkerRow {
  id: string;
  name: string;
  bio: string;
  years_exp: number;
  areas: string[];
  avatar_hue: number;
  verification_state: Worker["verification"];
  is_active: boolean;
  rating: number | string;
  jobs_done: number | string;
  joined_at: string;
}

export function toWorker(r: WorkerRow): Worker {
  return {
    id: r.id,
    name: r.name,
    avatarHue: r.avatar_hue,
    categoryIds: [],
    verification: r.verification_state,
    active: r.is_active,
    rating: Number(r.rating ?? 0),
    jobsDone: Number(r.jobs_done ?? 0),
    yearsExp: r.years_exp,
    areas: r.areas ?? [],
    bio: r.bio ?? "",
    joinedAt: (r.joined_at ?? "").slice(0, 10),
  };
}

interface BookingRow {
  id: string;
  booking_no: string;
  service_id: string;
  service_name?: string;
  worker_id: string | null;
  worker_name?: string | null;
  status: BookingStatus;
  address_id: string | null;
  address_text?: string;
  slot: string;
  instructions: string;
  estimate_paisa: string | number;
  discount_paisa?: string | number | null;
  final_paisa: string | number | null;
  payment_method: Booking["paymentMethod"];
  payment_status: Booking["paymentStatus"];
  commission_bps: number;
  commission_paisa?: string | number | null;
  created_at: string;
}

export function toBooking(r: BookingRow): Booking {
  return {
    id: r.booking_no,
    serviceId: r.service_id,
    serviceName: r.service_name,
    workerId: r.worker_id ?? undefined,
    workerName: r.worker_name ?? undefined,
    status: r.status,
    addressId: r.address_id ?? "",
    addressText: r.address_text ?? "",
    slot: r.slot,
    instructions: r.instructions,
    estimatePaisa: Number(r.estimate_paisa),
    discountPaisa: r.discount_paisa === null || r.discount_paisa === undefined ? 0 : Number(r.discount_paisa),
    finalPaisa: r.final_paisa === null || r.final_paisa === undefined ? undefined : Number(r.final_paisa),
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    commissionBps: r.commission_bps,
    commissionPaisa:
      r.commission_paisa === null || r.commission_paisa === undefined
        ? undefined
        : Number(r.commission_paisa),
    history: [],
    createdAt: r.created_at,
  };
}

interface EventRow {
  status: BookingStatus;
  by_role: string;
  note: string;
  at: string;
}

export function toHistory(rows: EventRow[]): Booking["history"] {
  return rows.map((h) => ({ status: h.status, at: h.at, by: h.by_role as Booking["history"][0]["by"], note: h.note || undefined }));
}

interface ReviewRow {
  id: string;
  booking_id?: string;
  booking_no?: string;
  worker_id?: string;
  rating: number;
  text: string;
  created_at?: string;
  at?: string;
}

export function toReview(r: ReviewRow): Review {
  return {
    id: r.id,
    bookingId: r.booking_no ?? r.booking_id ?? "",
    workerId: r.worker_id ?? "",
    rating: r.rating,
    text: r.text,
    at: r.created_at ?? r.at ?? "",
  };
}

interface RewardRow {
  id: string;
  points: number;
  kind: RewardTx["kind"];
  reason: string;
  at?: string;
  created_at?: string;
}

export function toReward(r: RewardRow): RewardTx {
  return { id: r.id, points: r.points, kind: r.kind, reason: r.reason, at: r.at ?? r.created_at ?? "" };
}

interface TicketRow {
  id: string;
  subject: string;
  status: Ticket["status"];
  messages: { from: string; text: string; at: string }[] | null;
  updated_at: string;
}

export function toTicket(r: TicketRow): Ticket {
  return {
    id: r.id,
    subject: r.subject,
    status: r.status,
    messages: (r.messages ?? []).map((m) => ({ from: m.from, text: m.text, at: m.at })),
    updatedAt: r.updated_at,
  };
}

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export function toNotification(r: NotificationRow): AppNotification {
  return { id: r.id, title: r.title, body: r.body, at: r.created_at, read: r.is_read };
}

interface AddressRow {
  id: string;
  label: string;
  line: string;
  city: string;
  phone: string;
}

export function toAddress(r: AddressRow): Address {
  return { id: r.id, label: r.label, line: r.line, city: r.city, phone: r.phone };
}
