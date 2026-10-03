import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, PageHero, Price, Tabs, VerifyBadge } from "../components/ui";
import { api, post, put } from "../lib/api";
import { formatNPR, formatSlot } from "../lib/format";
import type { BookingStatus, VerificationState } from "../lib/types";

type Tab =
  | "overview"
  | "assign"
  | "verify"
  | "people"
  | "services"
  | "finance"
  | "rewards"
  | "support"
  | "audit";

interface AdminWorker {
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

interface AdminBooking {
  id: string;
  booking_no: string;
  service_id: string;
  service_name: string;
  worker_id: string | null;
  worker_name: string | null;
  customer_name: string;
  status: BookingStatus;
  slot: string;
}

interface LedgerRow {
  booking_no: string;
  total_paisa: string | number;
  commission_paisa: string | number;
  payment_method: string;
  status: string;
  service_name: string;
  worker_id: string | null;
  worker_name: string | null;
  is_settled: boolean;
  payment_id: string | null;
  payment_state: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  commission_bps: number;
}

interface ServiceRow {
  id: string;
  name: string;
  base_price_paisa: string | number;
  is_active: boolean;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  messages: { from: string; text: string; at: string }[] | null;
}

interface AuditRow {
  at?: string;
  created_at: string;
  actor: string;
  actor_name: string | null;
  action: string;
  detail: string;
}

const CHECKS = ["Identity document verified", "References checked", "Background check clear", "Skill assessed"];

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Record<string, number> & { byCategory: { name: string; jobs: number; revenue: string; commission: string }[] } | null>(null);
  const [workers, setWorkers] = useState<AdminWorker[]>([]);
  const [pendingBookings, setPendingBookings] = useState<AdminBooking[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [rewardTxs, setRewardTxs] = useState<{ id: string; reason: string; points: number }[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [wards, setWards] = useState<boolean[]>(Array(10).fill(true));
  const [checks, setChecks] = useState<Record<string, string[]>>({});
  const [assignSel, setAssignSel] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [commEdit, setCommEdit] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, w, pb, cat, svc, led, rwd, tix, aud, wd] = await Promise.all([
        api<Record<string, number> & { byCategory: { name: string; jobs: number; revenue: string; commission: string }[] }>("/api/admin/reports/overview"),
        api<{ workers: AdminWorker[] }>("/api/admin/workers"),
        api<{ bookings: AdminBooking[] }>("/api/admin/bookings?status=pending"),
        api<{ categories: Category[] }>("/api/categories"),
        api<{ services: ServiceRow[] }>("/api/admin/services-all"),
        api<{ ledger: LedgerRow[] }>("/api/admin/ledger"),
        api<{ ledger: { id: string; reason: string; points: number }[] }>("/api/admin/rewards/ledger"),
        api<{ tickets: Ticket[] }>("/api/admin/tickets"),
        api<{ audit: AuditRow[] }>("/api/admin/audit?limit=100"),
        api<{ wards: { ward: number; is_open: boolean }[] }>("/api/admin/wards"),
      ]);
      setOverview(ov);
      setWorkers(w.workers);
      setPendingBookings(pb.bookings);
      setCategories(cat.categories);
      setServices(svc.services);
      setLedger(led.ledger);
      setRewardTxs(rwd.ledger);
      setTickets(tix.tickets);
      setAudit(aud.audit);
      const arr = Array(10).fill(true);
      for (const x of wd.wards) arr[x.ward - 1] = x.is_open;
      setWards(arr);
    } catch {
      /* admin shows empty sections on failure */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingVerify = workers.filter((w) =>
    ["draft", "awaiting-documents", "under-review"].includes(w.verification_state),
  ).length;
  const openWards = wards.filter(Boolean).length;

  const exportLedger = () => {
    const rows = ["booking,total_paisa,commission_paisa,method,status"];
    for (const b of ledger) {
      rows.push(`${b.booking_no},${b.total_paisa},${b.commission_paisa},${b.payment_method},${b.status}`);
    }
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "commission-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Administration"
        title="Control center"
        body="Verification, assignments, money and audit — least-privilege actions, all logged."
      />
      <div className="wrap py-8">

      <div className="mt-2">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "assign", label: `Assignments (${pendingBookings.length})` },
            { id: "verify", label: `Verification (${pendingVerify})` },
            { id: "people", label: "People" },
            { id: "services", label: "Services" },
            { id: "finance", label: "Finance" },
            { id: "rewards", label: "Rewards" },
            { id: "support", label: "Support" },
            { id: "audit", label: "Audit" },
          ]}
        />
      </div>

      {loading && (
        <p role="status" className="mt-6 text-sm text-on-surface-variant">Loading admin data…</p>
      )}

      {tab === "overview" && overview && (
        <div className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [`${overview.totalBookings}`, "total bookings"],
              [formatNPR(overview.revenue), "completed revenue"],
              [formatNPR(overview.commission), "commission earned"],
              [formatNPR(overview.cashOwed), "cash commission owed"],
              [`${overview.disputes}`, "open disputes"],
              [`Damak · ${openWards}/10 wards`, "coverage zone"],
            ].map(([v, l]) => (
              <Card key={l} className="border-t-4 border-t-pine-800 p-4">
                <p className="font-display text-[22px] font-semibold text-pine-950">{v}</p>
                <p className="text-xs font-bold tracking-wide text-on-surface-variant uppercase">{l}</p>
              </Card>
            ))}
          </div>
          <Card className="mt-4 p-5">
            <h3 className="font-bold">Revenue by category</h3>
            <table className="mt-2 w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-on-surface-variant"><th className="py-1.5">Category</th><th className="text-right">Jobs</th><th className="text-right">Revenue</th><th className="text-right">Commission</th></tr></thead>
              <tbody>
                {overview.byCategory.map((e) => (
                  <tr key={e.name} className="border-t border-outline">
                    <td className="py-1.5 font-semibold">{e.name}</td>
                    <td className="text-right">{e.jobs}</td>
                    <td className="text-right">{formatNPR(Number(e.revenue))}</td>
                    <td className="text-right">{formatNPR(Number(e.commission))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "assign" && (
        <div className="mt-4 space-y-3">
          {pendingBookings.length === 0 && (
            <Card className="p-6 text-center text-sm text-on-surface-variant">Assignment queue is clear.</Card>
          )}
          {pendingBookings.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="text-sm">
                <Link to={`/track/${b.booking_no}`} className="font-bold hover:text-primary">{b.booking_no}</Link>
                <p className="text-on-surface-variant">{b.service_name} · {formatSlot(b.slot)} · {b.customer_name}</p>
                <p className="mt-0.5"><Badge tone="success">Damak</Badge></p>
              </div>
              <div className="flex gap-2">
                <label className="sr-only" htmlFor={`assign-${b.id}`}>Assign worker</label>
                <select
                  id={`assign-${b.id}`}
                  value={assignSel[b.booking_no] ?? ""}
                  onChange={(e) => setAssignSel((p) => ({ ...p, [b.booking_no]: e.target.value }))}
                  className="rounded-md border border-outline bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select verified pro…</option>
                  {workers
                    .filter((w) => w.verification_state === "verified" && w.is_active)
                    .map((w) => (
                      <option key={w.id} value={w.id}>{w.name} · {w.categories.join(", ") || "general"}</option>
                    ))}
                </select>
                <Button
                  disabled={!assignSel[b.booking_no]}
                  onClick={async () => {
                    try {
                      await post(`/api/bookings/${b.booking_no}/transition`, {
                        to: "awaiting-worker",
                        workerId: assignSel[b.booking_no],
                        note: "Assigned by admin",
                      });
                      await load();
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Assign failed");
                    }
                  }}
                >
                  Assign
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "verify" && (
        <div className="mt-4 space-y-4">
          {workers.filter((w) => ["draft", "awaiting-documents", "under-review", "rejected"].includes(w.verification_state)).map((w) => {
            const done = checks[w.id] ?? [];
            const ready = CHECKS.every((c) => done.includes(c));
            return (
              <Card key={w.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{w.name} <span className="text-sm font-normal text-on-surface-variant">· {w.email} · {w.years_exp}y exp · {(w.areas ?? []).join(", ")}</span></p>
                    <p className="mt-1 text-sm text-on-surface-variant">{w.bio}</p>
                  </div>
                  <VerifyBadge state={w.verification_state} />
                </div>
                <fieldset className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  <legend className="sr-only">Verification checks for {w.name}</legend>
                  {CHECKS.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={done.includes(c)}
                        onChange={() =>
                          setChecks((p) => ({
                            ...p,
                            [w.id]: done.includes(c) ? done.filter((x) => x !== c) : [...done, c],
                          }))
                        }
                        className="size-4 accent-[#0f6b44]"
                      />
                      {c}
                    </label>
                  ))}
                </fieldset>
                <div className="mt-3 flex gap-2">
                  <Button
                    disabled={!ready}
                    onClick={async () => {
                      await post(`/api/admin/workers/${w.id}/verify`, { state: "verified", notes: "All checks passed" });
                      await load();
                    }}
                  >
                    Approve & activate
                  </Button>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      await post(`/api/admin/workers/${w.id}/verify`, { state: "rejected", notes: "Rejected by admin" });
                      await load();
                    }}
                  >
                    Reject
                  </Button>
                </div>
                {!ready && <p className="mt-2 text-xs text-on-surface-variant">All four checks must pass — a worker is never “background-checked” by account creation alone.</p>}
              </Card>
            );
          })}
          {pendingVerify === 0 && (
            <Card className="p-6 text-center text-sm text-on-surface-variant">Verification queue is clear.</Card>
          )}
        </div>
      )}

      {tab === "people" && (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="bg-surface-container text-left text-xs uppercase"><th className="px-4 py-2.5">Worker</th><th className="px-4 py-2.5">Verification</th><th className="px-4 py-2.5">Jobs</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Action</th></tr></thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} className="border-t border-outline">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold">{w.name}</span>
                    <span className="block text-xs text-on-surface-variant">{w.email}</span>
                  </td>
                  <td className="px-4 py-2.5"><VerifyBadge state={w.verification_state} /></td>
                  <td className="px-4 py-2.5">{w.jobs_done}</td>
                  <td className="px-4 py-2.5">{w.is_active ? <Badge tone="success">Active</Badge> : <Badge>Suspended</Badge>}</td>
                  <td className="px-4 py-2.5">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await post(`/api/admin/workers/${w.id}/activate`, { active: !w.is_active });
                        await load();
                      }}
                    >
                      {w.is_active ? "Suspend" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "services" && (
        <div className="mt-4">
          <Card className="ring-band dotgrid-light border-0 p-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xl font-semibold">Coverage zone: Damak (Jhapa)</h3>
                <p className="mt-0.5 text-sm text-white/70">Single-city policy — every service inherits this zone.</p>
              </div>
              <Badge tone="marigold">{openWards}/10 wards open</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Open wards">
              {wards.map((open, i) => (
                <button
                  key={i}
                  onClick={async () => {
                    const next = wards.map((v, j) => (j === i ? !v : v));
                    setWards(next);
                    await put("/api/admin/wards", { wards: next });
                  }}
                  aria-pressed={open}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                    open ? "bg-marigold-300 text-pine-950" : "bg-white/15 text-white/60"
                  }`}
                >
                  W{i + 1}
                </button>
              ))}
            </div>
          </Card>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-bold">Commission rules (basis points · 1500 = 15%)</h3>
              <div className="mt-3 space-y-2">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{c.name}</span>
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      value={commEdit[c.id] ?? String(c.commission_bps)}
                      onChange={(e) => setCommEdit((p) => ({ ...p, [c.id]: e.target.value }))}
                      onBlur={async () => {
                        const v = Number(commEdit[c.id] ?? c.commission_bps);
                        if (Number.isInteger(v) && v >= 0 && v <= 5000 && v !== c.commission_bps) {
                          await put(`/api/admin/categories/${c.id}`, { commissionBps: v });
                          await load();
                        }
                      }}
                      className="w-24 rounded-md border border-outline px-2 py-1.5"
                      aria-label={`${c.name} commission basis points`}
                    />
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs text-on-surface-variant">Applies to future bookings only — completed jobs keep their snapshots.</p>
            </Card>
            <Card className="p-5">
              <h3 className="font-bold">Services ({services.length})</h3>
              <ul className="mt-2 max-h-96 space-y-2 overflow-auto text-sm">
                {services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 border-t border-outline pt-2 first:border-0 first:pt-0">
                    <span className="font-semibold">{s.name} {!s.is_active && <Badge>Inactive</Badge>}</span>
                    <Price paisa={Number(s.base_price_paisa)} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === "finance" && (
        <div className="mt-4">
          <div className="mt-0 flex justify-end">
            <Button variant="outline" onClick={exportLedger}>Export ledger CSV</Button>
          </div>
          <Card className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="bg-surface-container text-left text-xs uppercase"><th className="px-4 py-2.5">Booking</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Commission</th><th className="px-4 py-2.5">Method</th><th className="px-4 py-2.5">Settlement</th><th className="px-4 py-2.5">Actions</th></tr></thead>
              <tbody>
                {ledger.map((b) => (
                  <tr key={b.booking_no} className="border-t border-outline">
                    <td className="px-4 py-2.5 font-semibold"><Link to={`/track/${b.booking_no}`} className="hover:text-primary">{b.booking_no}</Link></td>
                    <td className="px-4 py-2.5 text-right">{formatNPR(Number(b.total_paisa))}</td>
                    <td className="px-4 py-2.5 text-right">{formatNPR(Number(b.commission_paisa))}</td>
                    <td className="px-4 py-2.5">{b.payment_method}</td>
                    <td className="px-4 py-2.5">
                      {b.payment_method === "cash"
                        ? b.is_settled
                          ? <Badge tone="success">Settled</Badge>
                          : <Badge tone="warning">Owed</Badge>
                        : <Badge tone="success">Auto-settled</Badge>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        {b.payment_method === "cash" && !b.is_settled && b.worker_id && (
                          <Button
                            variant="outline"
                            onClick={async () => {
                              await post("/api/admin/settlements", {
                                workerId: b.worker_id,
                                amountPaisa: Number(b.commission_paisa),
                                kind: "collection",
                                note: `Cash commission for ${b.booking_no}`,
                              });
                              await load();
                            }}
                          >
                            Record settlement
                          </Button>
                        )}
                        {b.payment_state === "verified" && b.payment_id && (
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              if (!window.confirm(`Refund ${formatNPR(Number(b.total_paisa))} for ${b.booking_no}?`)) return;
                              await post("/api/admin/refunds", {
                                paymentId: b.payment_id,
                                amountPaisa: Number(b.total_paisa),
                                reason: "Admin refund",
                              });
                              await load();
                            }}
                          >
                            Refund
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs text-on-surface-variant">
            Cash settlements and refunds run through audited endpoints — use the booking page or worker records. Ledger math: commission = ⌊total × bps / 10000⌋ in integer paisa.
          </p>
        </div>
      )}

      {tab === "rewards" && (
        <Card className="mt-4 p-5">
          <h3 className="font-bold">Reward ledger ({rewardTxs.length})</h3>
          <ul className="mt-2 max-h-96 space-y-1.5 overflow-auto text-sm">
            {[...rewardTxs].reverse().map((t) => (
              <li key={t.id} className="flex justify-between gap-2 border-t border-outline pt-1.5 first:border-0">
                <span>{t.reason}</span>
                <strong className={t.points < 0 ? "text-error" : "text-success"}>{t.points > 0 ? `+${t.points}` : t.points}</strong>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-on-surface-variant">Rules live in platform settings; refunds reverse the points they issued.</p>
        </Card>
      )}

      {tab === "support" && (
        <Card className="mt-4 p-5">
          <h3 className="font-bold">Tickets ({tickets.length})</h3>
          {tickets.map((t) => (
            <div key={t.id} className="mt-3 border-t border-outline pt-3 first:border-0">
              <p className="text-sm font-bold">{t.subject} <Badge tone={t.status === "resolved" ? "success" : "warning"}>{t.status}</Badge></p>
              {(t.messages ?? []).map((m, i) => (
                <p key={i} className="mt-1 text-sm"><strong>{m.from}:</strong> {m.text}</p>
              ))}
              <div className="mt-2 flex gap-2">
                <input
                  value={replies[t.id] ?? ""}
                  onChange={(e) => setReplies((p) => ({ ...p, [t.id]: e.target.value }))}
                  placeholder="Write a reply…"
                  aria-label={`Reply to ${t.subject}`}
                  className="w-full rounded-md border border-outline px-3 py-1.5 text-sm"
                />
                <Button
                  variant="outline"
                  disabled={!(replies[t.id] ?? "").trim()}
                  onClick={async () => {
                    await post(`/api/admin/tickets/${t.id}/reply`, { body: replies[t.id].trim() });
                    setReplies((p) => ({ ...p, [t.id]: "" }));
                    await load();
                  }}
                >
                  Reply
                </Button>
                {t.status !== "resolved" && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await post(`/api/admin/tickets/${t.id}/status`, { status: "resolved" });
                      await load();
                    }}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          ))}
          {tickets.length === 0 && <p className="mt-2 text-sm text-on-surface-variant">No tickets.</p>}
        </Card>
      )}

      {tab === "audit" && (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-surface-container text-left text-xs uppercase"><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Actor</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Detail</th></tr></thead>
            <tbody>
              {audit.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant">No admin actions recorded yet.</td></tr>}
              {audit.map((a, i) => (
                <tr key={i} className="border-t border-outline">
                  <td className="px-4 py-2.5 text-on-surface-variant">{formatSlot(a.created_at ?? a.at ?? "")}</td>
                  <td className="px-4 py-2.5">{a.actor_name ?? a.actor}</td>
                  <td className="px-4 py-2.5 font-semibold">{a.action}</td>
                  <td className="px-4 py-2.5">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      </div>
    </div>
  );
}
