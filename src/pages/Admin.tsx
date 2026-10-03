import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, PageHero, Price, Rating, StatusBadge, Tabs, VerifyBadge } from "../components/ui";
import { CATEGORIES, PLATFORM, REVIEWS, SERVICES, TICKETS, WORKERS } from "../data/mock";
import { useStore } from "../lib/store";
import { calcCommission, isEligibleWorker } from "../lib/booking";
import { formatDate, formatNPR, formatSlot } from "../lib/format";
import { loadAudit, logAudit } from "../lib/audit";
import type { VerificationState } from "../lib/types";

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

function loadMap<T>(key: string, fallback: Record<string, T>): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, T>) : fallback;
  } catch {
    return fallback;
  }
}

function saveMap(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

const CHECKS = ["Identity document verified", "References checked", "Background check clear", "Skill assessed"];

export default function Admin() {
  const { bookings, addresses, advanceBooking, rewardTxs } = useStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [verify, setVerify] = useState<Record<string, VerificationState>>(() => loadMap("wk-verify", {}));
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>(() => loadMap("wk-active", {}));
  const [commMap, setCommMap] = useState<Record<string, number>>(() => loadMap("wk-comm", {}));
  const [settled, setSettled] = useState<Record<string, string>>(() => loadMap("wk-settled", {}));
  const [refunded, setRefunded] = useState<Record<string, boolean>>(() => loadMap("wk-refund", {}));
  const [checks, setChecks] = useState<Record<string, string[]>>({});
  const [assignSel, setAssignSel] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [wards, setWards] = useState<boolean[]>(() => {
    try {
      const raw = localStorage.getItem("wk-wards");
      if (raw) return JSON.parse(raw) as boolean[];
    } catch {
      /* default below */
    }
    return Array(10).fill(true) as boolean[];
  });
  const [ticketExtra, setTicketExtra] = useState<Record<string, { from: string; text: string; at: string }[]>>({});
  const [audit, setAudit] = useState(loadAudit);

  const workers = useMemo(
    () =>
      WORKERS.map((w) => ({
        ...w,
        verification: verify[w.id] ?? w.verification,
        active: activeMap[w.id] ?? w.active,
      })),
    [verify, activeMap],
  );

  const bpsFor = (categoryId: string) =>
    commMap[categoryId] ?? CATEGORIES.find((c) => c.id === categoryId)?.commissionBps ?? PLATFORM.globalCommissionBps;

  const completed = bookings.filter((b) => b.status === "completed");
  const revenue = completed.reduce((n, b) => n + (b.finalPaisa ?? b.estimatePaisa), 0);
  const commissionEarned = completed.reduce(
    (n, b) => n + (b.commissionPaisa ?? calcCommission(b.finalPaisa ?? b.estimatePaisa, b.commissionBps)),
    0,
  );
  const cashOwed = completed
    .filter((b) => b.paymentMethod === "cash" && !settled[b.id] && !refunded[b.id])
    .reduce((n, b) => n + (b.commissionPaisa ?? calcCommission(b.finalPaisa ?? b.estimatePaisa, b.commissionBps)), 0);
  const pendingVerify = workers.filter((w) =>
    ["draft", "awaiting-documents", "under-review"].includes(w.verification),
  ).length;
  const disputes = bookings.filter((b) => b.status === "disputed").length;

  const byCategory = useMemo(() => {
    const m = new Map<string, { jobs: number; revenue: number; commission: number }>();
    for (const b of completed) {
      const s = SERVICES.find((x) => x.id === b.serviceId);
      if (!s) continue;
      const e = m.get(s.categoryId) ?? { jobs: 0, revenue: 0, commission: 0 };
      const f = b.finalPaisa ?? b.estimatePaisa;
      e.jobs += 1;
      e.revenue += f;
      e.commission += b.commissionPaisa ?? calcCommission(f, b.commissionBps);
      m.set(s.categoryId, e);
    }
    return [...m.entries()];
  }, [completed, bookings]);

  const auditIt = (action: string, detail: string) => setAudit(logAudit(action, detail));

  const toggleWard = (i: number) => {
    setWards((prev) => {
      const next = prev.map((v, j) => (j === i ? !v : v));
      saveMap("wk-wards", next);
      return next;
    });
  };

  const openWards = wards.filter(Boolean).length;

  const setVerification = (id: string, v: VerificationState) => {
    setVerify((p) => {
      const n = { ...p, [id]: v };
      saveMap("wk-verify", n);
      return n;
    });
    if (v === "verified") {
      setActiveMap((p) => {
        const n = { ...p, [id]: true };
        saveMap("wk-active", n);
        return n;
      });
    }
  };

  const toggleActive = (id: string, v: boolean) => {
    setActiveMap((p) => {
      const n = { ...p, [id]: v };
      saveMap("wk-active", n);
      return n;
    });
    auditIt(v ? "worker-activated" : "worker-suspended", `${id} active=${v}`);
  };

  const assign = (bookingId: string) => {
    const wid = assignSel[bookingId];
    if (!wid) return;
    if (advanceBooking(bookingId, "awaiting-worker", "admin", `Assigned to ${wid}`, { workerId: wid })) {
      auditIt("assign", `${bookingId} → ${wid}`);
    }
  };

  const exportLedger = () => {
    const rows = ["booking,service,total_paisa,commission_paisa,method,settlement"];
    for (const b of completed) {
      const f = b.finalPaisa ?? b.estimatePaisa;
      const c = b.commissionPaisa ?? calcCommission(f, b.commissionBps);
      const st = refunded[b.id] ? "refunded" : b.paymentMethod === "cash" ? (settled[b.id] ? `settled-${settled[b.id]}` : "owed") : "auto-settled";
      rows.push(`${b.id},${b.serviceId},${f},${c},${b.paymentMethod},${st}`);
    }
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "commission-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const eligibleFor = (serviceId: string) => {
    const s = SERVICES.find((x) => x.id === serviceId);
    if (!s) return [];
    return workers.filter((w) => isEligibleWorker(w) && w.categoryIds.includes(s.categoryId));
  };

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Administration"
        title="Control center"
        body="Verification, assignments, money and audit — least-privilege actions, all logged."
      />
      <div className="wrap py-8">

      <div className="mt-6">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "assign", label: "Assignments" },
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

      {tab === "overview" && (
        <div className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [`${bookings.length}`, "total bookings"],
              [formatNPR(revenue), "completed revenue"],
              [formatNPR(commissionEarned), "commission earned"],
              [formatNPR(cashOwed), "cash commission owed"],
              [`${disputes}`, "open disputes"],
              [`Damak · ${openWards}/10 wards`, "coverage zone"],
            ].map(([v, l]) => (
              <Card key={l} className="p-4">
                <p className="text-xl font-bold text-primary">{v}</p>
                <p className="text-xs text-on-surface-variant">{l}</p>
              </Card>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-bold">Revenue by category</h3>
              <table className="mt-2 w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-on-surface-variant"><th className="py-1.5">Category</th><th className="text-right">Jobs</th><th className="text-right">Revenue</th><th className="text-right">Commission</th></tr></thead>
                <tbody>
                  {byCategory.map(([cid, e]) => (
                    <tr key={cid} className="border-t border-outline">
                      <td className="py-1.5 font-semibold">{CATEGORIES.find((c) => c.id === cid)?.name}</td>
                      <td className="text-right">{e.jobs}</td>
                      <td className="text-right">{formatNPR(e.revenue)}</td>
                      <td className="text-right">{formatNPR(e.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="p-5">
              <h3 className="font-bold">Recent bookings</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {bookings.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 border-t border-outline pt-2 first:border-0 first:pt-0">
                    <Link to={`/track/${b.id}`} className="font-semibold hover:text-primary">{b.id}</Link>
                    <StatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === "assign" && (
        <div className="mt-4 space-y-3">
          {bookings.filter((b) => b.status === "pending").map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="text-sm">
                <Link to={`/track/${b.id}`} className="font-bold hover:text-primary">{b.id}</Link>
                <p className="text-on-surface-variant">{SERVICES.find((s) => s.id === b.serviceId)?.name} · {formatSlot(b.slot)}</p>
                <p className="mt-0.5 flex items-center gap-1.5">
                  <Badge tone="success">Damak</Badge>
                  <span className="text-on-surface-variant">{addresses.find((a) => a.id === b.addressId)?.line ?? "Address on file"}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <label className="sr-only" htmlFor={`assign-${b.id}`}>Assign worker</label>
                <select
                  id={`assign-${b.id}`}
                  value={assignSel[b.id] ?? ""}
                  onChange={(e) => setAssignSel((p) => ({ ...p, [b.id]: e.target.value }))}
                  className="rounded-md border border-outline bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select verified pro…</option>
                  {eligibleFor(b.serviceId).map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.rating.toFixed(1)})</option>
                  ))}
                </select>
                <Button onClick={() => assign(b.id)} disabled={!assignSel[b.id]}>Assign</Button>
              </div>
            </Card>
          ))}
          {bookings.every((b) => b.status !== "pending") && (
            <Card className="p-6 text-center text-sm text-on-surface-variant">Assignment queue is clear.</Card>
          )}
        </div>
      )}

      {tab === "verify" && (
        <div className="mt-4 space-y-4">
          {workers.filter((w) => ["draft", "awaiting-documents", "under-review", "rejected"].includes(w.verification)).map((w) => {
            const done = checks[w.id] ?? [];
            const ready = CHECKS.every((c) => done.includes(c));
            return (
              <Card key={w.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{w.name} <span className="text-sm font-normal text-on-surface-variant">· {w.yearsExp}y exp · {w.areas.join(", ") || "no areas"}</span></p>
                    <p className="mt-1 text-sm text-on-surface-variant">{w.bio}</p>
                  </div>
                  <VerifyBadge state={w.verification} />
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
                  <Button disabled={!ready} onClick={() => { setVerification(w.id, "verified"); auditIt("verify-approve", w.id); }}>
                    Approve & activate
                  </Button>
                  <Button variant="danger" onClick={() => { setVerification(w.id, "rejected"); auditIt("verify-reject", w.id); }}>
                    Reject
                  </Button>
                </div>
                {!ready && <p className="mt-2 text-xs text-on-surface-variant">All four checks must pass — a worker is never “background-checked” by account creation alone.</p>}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "people" && (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-surface-container text-left text-xs uppercase"><th className="px-4 py-2.5">Worker</th><th className="px-4 py-2.5">Verification</th><th className="px-4 py-2.5">Jobs</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Action</th></tr></thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} className="border-t border-outline">
                  <td className="px-4 py-2.5 font-semibold"><Link to={`/workers/${w.id}`} className="hover:text-primary">{w.name}</Link></td>
                  <td className="px-4 py-2.5"><VerifyBadge state={w.verification} /></td>
                  <td className="px-4 py-2.5">{w.jobsDone}</td>
                  <td className="px-4 py-2.5">{w.active ? <Badge tone="success">Active</Badge> : <Badge>Suspended</Badge>}</td>
                  <td className="px-4 py-2.5">
                    {w.active ? (
                      <Button variant="outline" onClick={() => toggleActive(w.id, false)}>Suspend</Button>
                    ) : (
                      <Button variant="outline" onClick={() => toggleActive(w.id, true)}>Activate</Button>
                    )}
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
                <p className="mt-0.5 text-sm text-white/70">Single-city policy — every service inherits this zone. New cities need platform expansion approval.</p>
              </div>
              <Badge tone="marigold">{openWards}/10 wards open</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Open wards">
              {wards.map((open, i) => (
                <button
                  key={i}
                  onClick={() => {
                    toggleWard(i);
                    auditIt("coverage-ward", `Damak-${i + 1} ${open ? "closed" : "opened"}`);
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
              {CATEGORIES.map((c) => (
                <label key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{c.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    value={bpsFor(c.id)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCommMap((p) => {
                        const n = { ...p, [c.id]: v };
                        saveMap("wk-comm", n);
                        return n;
                      });
                    }}
                    onBlur={() => auditIt("commission-rule", `${c.id}=${bpsFor(c.id)}bps`)}
                    className="w-24 rounded-md border border-outline px-2 py-1.5"
                    aria-label={`${c.name} commission basis points`}
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-on-surface-variant">Applies to future bookings only — completed jobs keep their snapshots.</p>
          </Card>
          <Card className="p-5">
            <h3 className="font-bold">Services ({SERVICES.length})</h3>
            <ul className="mt-2 max-h-96 space-y-2 overflow-auto text-sm">
              {SERVICES.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 border-t border-outline pt-2 first:border-0 first:pt-0">
                  <Link to={`/services/${s.id}`} className="font-semibold hover:text-primary">{s.name}</Link>
                  <span className="text-on-surface-variant"><Price paisa={s.basePricePaisa} /> · <Rating value={s.rating} /> · Damak</span>
                </li>
              ))}
            </ul>
          </Card>
          </div>
        </div>
      )}

      {tab === "finance" && (
        <div className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4"><p className="text-xl font-bold">{formatNPR(revenue)}</p><p className="text-xs text-on-surface-variant">gross completed volume</p></Card>
            <Card className="p-4"><p className="text-xl font-bold text-success">{formatNPR(commissionEarned)}</p><p className="text-xs text-on-surface-variant">commission earned</p></Card>
            <Card className="p-4"><p className="text-xl font-bold text-error">{formatNPR(cashOwed)}</p><p className="text-xs text-on-surface-variant">cash commission outstanding</p></Card>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={exportLedger}>Export ledger CSV</Button>
          </div>
          <Card className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="bg-surface-container text-left text-xs uppercase"><th className="px-4 py-2.5">Booking</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Commission</th><th className="px-4 py-2.5">Method</th><th className="px-4 py-2.5">Settlement</th><th className="px-4 py-2.5">Actions</th></tr></thead>
              <tbody>
                {completed.map((b) => {
                  const f = b.finalPaisa ?? b.estimatePaisa;
                  const c = b.commissionPaisa ?? calcCommission(f, b.commissionBps);
                  return (
                    <tr key={b.id} className="border-t border-outline">
                      <td className="px-4 py-2.5 font-semibold"><Link to={`/track/${b.id}`} className="hover:text-primary">{b.id}</Link></td>
                      <td className="px-4 py-2.5 text-right">{formatNPR(f)}</td>
                      <td className="px-4 py-2.5 text-right">{formatNPR(c)}</td>
                      <td className="px-4 py-2.5">{b.paymentMethod}</td>
                      <td className="px-4 py-2.5">
                        {refunded[b.id] ? <Badge tone="error">Refunded</Badge>
                          : b.paymentMethod === "cash"
                            ? settled[b.id] ? <Badge tone="success">Settled {formatDate(settled[b.id])}</Badge> : <Badge tone="warning">Owed</Badge>
                            : <Badge tone="success">Auto-settled</Badge>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          {b.paymentMethod === "cash" && !settled[b.id] && !refunded[b.id] && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSettled((p) => { const n = { ...p, [b.id]: new Date().toISOString() }; saveMap("wk-settled", n); return n; });
                                auditIt("settlement", `${b.id} cash commission ${formatNPR(c)} settled`);
                              }}
                            >
                              Record settlement
                            </Button>
                          )}
                          {!refunded[b.id] && (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setRefunded((p) => { const n = { ...p, [b.id]: true }; saveMap("wk-refund", n); return n; });
                                auditIt("refund", `${b.id} ${formatNPR(f)} refunded, rewards reversed`);
                              }}
                            >
                              Refund
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "rewards" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-bold">Rules (configurable)</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-on-surface-variant">
              <li>Earn {PLATFORM.rewardPerNpr100} point per Rs 100 eligible spend</li>
              <li>+{PLATFORM.milestoneBonus} point bonus every {PLATFORM.milestoneBookings} completed bookings</li>
              <li>Redeem {PLATFORM.redeemPoints} points for Rs 50 off at checkout</li>
              <li>Refunds reverse the points they issued — balances can never go negative</li>
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="font-bold">Ledger ({rewardTxs.length})</h3>
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-auto text-sm">
              {[...rewardTxs].reverse().map((t) => (
                <li key={t.id} className="flex justify-between gap-2 border-t border-outline pt-1.5 first:border-0">
                  <span>{t.reason}</span>
                  <strong className={t.points < 0 ? "text-error" : "text-success"}>{t.points > 0 ? `+${t.points}` : t.points}</strong>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === "support" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-bold">Tickets</h3>
            {TICKETS.map((t) => (
              <div key={t.id} className="mt-3 border-t border-outline pt-3 first:border-0">
                <p className="text-sm font-bold">{t.id} · {t.subject} <Badge tone={t.status === "resolved" ? "success" : "warning"}>{t.status}</Badge></p>
                {(ticketExtra[t.id] ?? []).concat(t.messages).map((m, i) => (
                  <p key={i} className="mt-1 text-sm"><strong>{m.from}:</strong> {m.text}</p>
                ))}
                <div className="mt-2 flex gap-2">
                  <label className="sr-only" htmlFor={`reply-${t.id}`}>Reply to {t.id}</label>
                  <input
                    id={`reply-${t.id}`}
                    value={replies[t.id] ?? ""}
                    onChange={(e) => setReplies((p) => ({ ...p, [t.id]: e.target.value }))}
                    placeholder="Write a reply…"
                    className="w-full rounded-md border border-outline px-3 py-1.5 text-sm"
                  />
                  <Button
                    variant="outline"
                    disabled={!(replies[t.id] ?? "").trim()}
                    onClick={() => {
                      const text = replies[t.id].trim();
                      setTicketExtra((p) => ({ ...p, [t.id]: [...(p[t.id] ?? []), { from: "Support", text, at: new Date().toISOString() }] }));
                      setReplies((p) => ({ ...p, [t.id]: "" }));
                      auditIt("support-reply", `${t.id}: ${text.slice(0, 60)}`);
                    }}
                  >
                    Reply
                  </Button>
                </div>
              </div>
            ))}
          </Card>
          <Card className="p-5">
            <h3 className="font-bold">Reviews</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {REVIEWS.map((r) => (
                <li key={r.id} className="border-t border-outline pt-2 first:border-0">
                  <Rating value={r.rating} /> <span className="text-on-surface-variant">· {r.bookingId}</span>
                  <p>“{r.text}”</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-on-surface-variant">Reviews are tied to completed bookings — duplicates and unverified reviews are rejected at write time.</p>
          </Card>
        </div>
      )}

      {tab === "audit" && (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-surface-container text-left text-xs uppercase"><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Actor</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Detail</th></tr></thead>
            <tbody>
              {audit.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant">No admin actions yet this session.</td></tr>}
              {audit.map((a, i) => (
                <tr key={i} className="border-t border-outline">
                  <td className="px-4 py-2.5 text-on-surface-variant">{formatSlot(a.at)}</td>
                  <td className="px-4 py-2.5">{a.actor}</td>
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
