export type Role = "customer" | "worker" | "admin";

export type BookingStatus =
  | "pending" | "awaiting-worker" | "confirmed" | "en-route"
  | "in-progress" | "awaiting-confirmation" | "completed"
  | "cancelled" | "disputed";

export interface Service {
  id: string;
  name: string;
  description: string;
  pricing_model: string;
  base_price_paisa: number;
  duration_min: number;
  areas: string[];
  category_name?: string;
  category_slug?: string;
  rating: number;
  jobs_done: number;
  requirements: string[];
  exclusions: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  icon: string;
  commission_bps: number;
}

export interface Address {
  id: string;
  label: string;
  line: string;
  city: string;
  ward: number | null;
  phone: string;
  lat: number | null;
  lng: number | null;
}

export interface Booking {
  id: string;
  booking_no: string;
  service_id: string;
  service_name?: string;
  worker_id?: string | null;
  worker_name?: string | null;
  status: BookingStatus;
  address_text?: string;
  ward?: number | null;
  lat?: number | null;
  lng?: number | null;
  slot: string;
  instructions: string;
  estimate_paisa: number;
  discount_paisa: number;
  final_paisa?: number | null;
  payment_method: string;
  payment_status: string;
}

export interface QuoteRequest {
  id: string;
  title: string;
  description: string;
  photos: string[];
  window_start: string;
  window_end: string;
  ward: number | null;
  status: string;
  category_name?: string;
  proposals?: Proposal[] | null;
}

export interface Proposal {
  id: string;
  worker_user_id: string | null;
  price_paisa: number;
  scope: string;
  availability: string;
  approved: boolean;
  created_at: string;
}
