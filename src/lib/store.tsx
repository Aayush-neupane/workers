import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ADDRESSES, BOOKINGS, REWARDS } from "../data/mock";
import { calcCommission, canTransition } from "./booking";
import type {
  Address,
  Booking,
  BookingStatus,
  RewardTx,
  Role,
} from "./types";

interface StoreValue {
  bookings: Booking[];
  addresses: Address[];
  rewardTxs: RewardTx[];
  rewardBalance: number;
  addBooking: (b: Booking) => void;
  advanceBooking: (id: string, to: BookingStatus, by: Role, note?: string) => boolean;
  addAddress: (a: Address) => void;
  spendPoints: (points: number, reason: string) => boolean;
}

const StoreCtx = createContext<StoreValue | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — demo continues in memory */
  }
}

export function nextBookingId(existing: Booking[]): string {
  for (let i = 0; i < 50; i++) {
    const id = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!existing.some((b) => b.id === id) && !BOOKINGS.some((b) => b.id === id)) return id;
  }
  return `BK-${Date.now().toString().slice(-6)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [userBookings, setUserBookings] = useState<Booking[]>(() => load("wk-bookings", []));
  const [addresses, setAddresses] = useState<Address[]>(() => load("wk-addresses", ADDRESSES));
  const [rewardTxs, setRewardTxs] = useState<RewardTx[]>(() => load("wk-rewards", REWARDS));

  useEffect(() => save("wk-bookings", userBookings), [userBookings]);
  useEffect(() => save("wk-addresses", addresses), [addresses]);
  useEffect(() => save("wk-rewards", rewardTxs), [rewardTxs]);

  const value = useMemo<StoreValue>(() => {
    const bookings = [...userBookings, ...BOOKINGS];
    const rewardBalance = rewardTxs.reduce((n, t) => n + t.points, 0);
    return {
      bookings,
      addresses,
      rewardTxs,
      rewardBalance,
      addBooking: (b) => setUserBookings((prev) => [b, ...prev]),
      advanceBooking: (id, to, by, note) => {
        let ok = false;
        setUserBookings((prev) =>
          prev.map((b) => {
            if (b.id !== id || !canTransition(b.status, to)) return b;
            ok = true;
            const finalPaisa = b.finalPaisa ?? b.estimatePaisa;
            return {
              ...b,
              status: to,
              ...(to === "completed"
                ? {
                    finalPaisa,
                    commissionPaisa: calcCommission(finalPaisa, b.commissionBps),
                    paymentStatus: b.paymentMethod === "cash" ? b.paymentStatus : "paid",
                  }
                : null),
              history: [...b.history, { status: to, at: new Date().toISOString(), by, ...(note ? { note } : {}) }],
            };
          }),
        );
        // Mock seed bookings are read-only in this demo; only user bookings advance.
        return ok;
      },
      addAddress: (a) => setAddresses((prev) => [...prev, a]),
      spendPoints: (points, reason) => {
        if (points <= 0 || points > rewardBalance) return false;
        setRewardTxs((prev) => [
          ...prev,
          { id: `rw-${Date.now()}`, kind: "redeem", points: -points, reason, at: new Date().toISOString() },
        ]);
        return true;
      },
    };
  }, [userBookings, addresses, rewardTxs]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
