import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OpsShell } from "./ops";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { ADMIN_TABS } from "../lib/admin";
import { Button } from "./ui";

/** Pager for admin tables: Prev/Next over server-side page/total. */
export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-sm">
      <p className="text-on-surface-variant tabular-nums">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex gap-1.5">
        <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        <Button variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/** Back-office shell: ops sidebar tabs (route-driven) + live queue counts. */
export function AdminShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const [counts, setCounts] = useState({ assign: 0, verify: 0, people: 0, support: 0 });

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [b, w, open, prog] = await Promise.all([
          api<{ total: number }>("/api/admin/bookings?status=pending&page=1&limit=1"),
          api<{ total: number }>("/api/admin/workers?page=1&limit=1"),
          api<{ total: number }>("/api/admin/tickets?status=open&page=1&limit=1"),
          api<{ total: number }>("/api/admin/tickets?status=in-progress&page=1&limit=1"),
        ]);
        const ov = await api<{ pendingVerify: number }>("/api/admin/reports/overview").catch(() => null);
        if (live) {
          setCounts({
            assign: b.total,
            verify: ov?.pendingVerify ?? 0,
            people: w.total,
            support: open.total + prog.total,
          });
        }
      } catch {
        /* counts stay zero; pages load their own data */
      }
    })();
    return () => {
      live = false;
    };
  }, [loc.pathname]);

  const tabs = ADMIN_TABS.map((t) => {
    let count: number | undefined;
    if (t.to === "/admin/bookings") count = counts.assign;
    else if (t.to === "/admin/verify") count = counts.verify;
    else if (t.to === "/admin/people") count = counts.people;
    else if (t.to === "/admin/support") count = counts.support;
    return { id: t.to, label: t.label, count };
  });

  return (
    <OpsShell<string>
      eyebrow="Administration"
      title="Control center"
      body="Verification, assignments, money and audit."
      badge={
        <span className="flex items-center gap-2 text-xs text-white/70">
          <span className="max-w-40 truncate">{user?.email}</span>
          <button
            onClick={() => void signOut().then(() => nav("/signin"))}
            className="cursor-pointer rounded-full border border-white/30 px-3 py-1 font-bold text-white transition hover:border-white"
          >
            Log out
          </button>
        </span>
      }
      tabs={tabs}
      value={loc.pathname}
      onChange={(to) => nav(to)}
    >
      {children}
    </OpsShell>
  );
}
