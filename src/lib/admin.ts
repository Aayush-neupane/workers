import { useEffect, useState } from "react";
import { api } from "./api";
import type { BookingStatus, VerificationState } from "./types";

// ---------- Shared admin row types (snake_case rows as returned by /api/admin/*) ----------
export interface AdminWorker {
  id: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  years_exp: number;
  areas: string[];
  verification_state: VerificationState;
  is_active: boolean;
  jobs_done: number;
  categories: string[];
}

export interface AdminBooking {
  id: string;
  booking_no: string;
  service_id: string;
  service_name: string;
  worker_id: string | null;
  customer_name: string;
  status: BookingStatus;
  slot: string;
}

export interface LedgerRow {
  booking_no: string;
  total_paisa: string | number;
  commission_paisa: string | number;
  payment_method: string;
  worker_id: string | null;
  is_settled: boolean;
  payment_id: string | null;
  payment_state: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  commission_bps: number;
}

export interface Invite {
  id: string;
  email: string;
  name: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ServiceRow {
  id: string;
  name: string;
  base_price_paisa: string | number;
  is_active: boolean;
}

export interface Ticket {
  id: string;
  subject: string;
  status: string;
  messages: { from: string; text: string; at: string }[] | null;
}

export interface AuditRow {
  created_at: string;
  actor_name: string | null;
  action: string;
  detail: string;
}

export interface Overview {
  totalBookings: number;
  revenue: number;
  commission: number;
  cashOwed: number;
  disputes: number;
  pendingVerify: number;
  today?: { orders: number; revenue: number };
  preparing?: number;
  byCategory: { name: string; jobs: number; revenue: string; commission: string }[];
}

export interface RewardRule {
  rewardPerNpr100?: number;
  milestoneBookings?: number;
  milestoneBonus?: number;
  redeemPoints?: number;
  redeemDiscountPaisa?: number;
}

// ---------- Tabs (single ADMIN pass sees every section; backend enforces the same) ----------
export const ADMIN_TABS = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/bookings", label: "Assignments" },
  { to: "/admin/verify", label: "Verification" },
  { to: "/admin/people", label: "People" },
  { to: "/admin/services", label: "Services" },
  { to: "/admin/finance", label: "Finance" },
  { to: "/admin/rewards", label: "Rewards" },
  { to: "/admin/support", label: "Support" },
  { to: "/admin/audit", label: "Audit" },
];

export const CHECKS = ["Identity document verified", "References checked", "Background check clear", "Skill assessed"];

export function inviteLink(token: string): string {
  return `${window.location.origin}/invite?token=${token}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ---------- Debounced search value (350ms, mirrors reference back-office pattern) ----------
export function useDebouncedValue<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// ---------- Paginated admin list fetcher ----------
// Backend returns { [key]: rows, total, page, limit }; extra params (q, status…)
// are appended alongside page/limit.
export async function getPage<T>(
  path: string,
  key: string,
  opts: { page: number; limit: number; params?: Record<string, string> },
): Promise<{ rows: T[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("page", String(opts.page));
  qs.set("limit", String(opts.limit));
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v) qs.set(k, v);
  }
  const r = await api<Record<string, unknown>>(`${path}?${qs.toString()}`);
  return { rows: (r[key] as T[]) ?? [], total: Number(r.total ?? 0) };
}
