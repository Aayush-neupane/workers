import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ApiError,
  api,
  del,
  post,
  toAddress,
  toBooking,
  toHistory,
  toNotification,
  toReward,
  toTicket,
} from "./api";
import { useAuth } from "./auth";
import type {
  Address,
  AppNotification,
  Booking,
  BookingStatus,
  RewardTx,
  Ticket,
} from "./types";

export interface NewBooking {
  serviceId: string;
  addressId?: string;
  addressText?: string;
  slot: string;
  instructions: string;
  paymentMethod: Booking["paymentMethod"];
  useRewards: boolean;
}

interface StoreValue {
  ready: boolean;
  error: string;
  bookings: Booking[];
  addresses: Address[];
  rewardTxs: RewardTx[];
  rewardBalance: number;
  tickets: Ticket[];
  notifications: AppNotification[];
  providers: { cash: boolean; esewa: boolean; khalti: boolean };
  reload: () => Promise<void>;
  fetchBooking: (no: string) => Promise<Booking | null>;
  addBooking: (b: NewBooking) => Promise<{ bookingNo: string; discountPaisa: number }>;
  advanceBooking: (
    no: string,
    to: BookingStatus,
    opts?: { note?: string; finalPaisa?: number; workerId?: string },
  ) => Promise<boolean>;
  addAddress: (a: Omit<Address, "id">) => Promise<Address>;
  deleteAddress: (id: string) => Promise<void>;
  createTicket: (subject: string, message: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [rewardTxs, setRewardTxs] = useState<RewardTx[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [providers, setProviders] = useState({ cash: true, esewa: false, khalti: false });

  const reload = useCallback(async () => {
    if (!user) {
      setBookings([]);
      setAddresses([]);
      setRewardTxs([]);
      setTickets([]);
      setNotifications([]);
      setReady(true);
      return;
    }
    setError("");
    try {
      const [b, a, r, t, n, p] = await Promise.all([
        api<{ bookings: unknown[] }>("/api/bookings/mine"),
        api<{ addresses: unknown[] }>("/api/addresses"),
        api<{ txs: unknown[] }>("/api/rewards/mine"),
        api<{ tickets: unknown[] }>("/api/tickets"),
        api<{ notifications: unknown[] }>("/api/notifications"),
        api<{ cash: boolean; esewa: boolean; khalti: boolean }>("/api/payments/providers"),
      ]);
      setBookings((b.bookings as Parameters<typeof toBooking>[0][]).map(toBooking));
      setAddresses((a.addresses as Parameters<typeof toAddress>[0][]).map(toAddress));
      setRewardTxs((r.txs as Parameters<typeof toReward>[0][]).map(toReward));
      setTickets((t.tickets as Parameters<typeof toTicket>[0][]).map(toTicket));
      setNotifications((n.notifications as Parameters<typeof toNotification>[0][]).map(toNotification));
      setProviders(p);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setReady(true);
    }
  }, [user]);

  useEffect(() => {
    if (authReady) void reload();
  }, [authReady, reload]);

  const value = useMemo<StoreValue>(() => {
    const rewardBalance = rewardTxs.reduce((sum, t) => sum + t.points, 0);
    return {
      ready,
      error,
      bookings,
      addresses,
      rewardTxs,
      rewardBalance,
      tickets,
      notifications,
      providers,
      reload,
      fetchBooking: async (no: string) => {
        try {
          const d = await api<{ booking: unknown; history: unknown[] }>(
            `/api/bookings/${encodeURIComponent(no)}`,
          );
          const b = toBooking(d.booking as Parameters<typeof toBooking>[0]);
          b.history = toHistory(d.history as Parameters<typeof toHistory>[0]);
          return b;
        } catch {
          return null;
        }
      },
      addBooking: async (nb: NewBooking) => {
        const d = await post<{ bookingNo: string; id: string; discountPaisa: number }>("/api/bookings", {
          serviceId: nb.serviceId,
          addressId: nb.addressId || undefined,
          addressText: nb.addressText || undefined,
          slot: nb.slot,
          instructions: nb.instructions,
          paymentMethod: nb.paymentMethod,
          useRewards: nb.useRewards,
        });
        await reload();
        return { bookingNo: d.bookingNo, discountPaisa: d.discountPaisa };
      },
      advanceBooking: async (no, to, opts) => {
        try {
          await post(`/api/bookings/${encodeURIComponent(no)}/transition`, {
            to,
            note: opts?.note ?? "",
            finalPaisa: opts?.finalPaisa,
            workerId: opts?.workerId,
          });
          await reload();
          return true;
        } catch (e) {
          if (e instanceof ApiError) return false;
          throw e;
        }
      },
      addAddress: async (a) => {
        const d = await post<{ address: unknown }>("/api/addresses", a);
        await reload();
        return toAddress(d.address as Parameters<typeof toAddress>[0]);
      },
      deleteAddress: async (id: string) => {
        await del(`/api/addresses/${id}`);
        await reload();
      },
      createTicket: async (subject: string, message: string) => {
        await post("/api/tickets", { subject, message });
        await reload();
      },
      markNotificationRead: async (id: string) => {
        await post(`/api/notifications/${id}/read`, {});
        await reload();
      },
    };
  }, [ready, error, bookings, addresses, rewardTxs, tickets, notifications, providers, reload]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
