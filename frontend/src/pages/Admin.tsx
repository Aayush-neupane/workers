import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, BadgeCheck, Ban, Megaphone, Search,
  Star, Trash2, UserCheck, UserX, X,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, PageHero, Price, Select, TextArea, TextField } from "../components/ui";
import { LiveMap } from "../components/LiveMap";
import { MiniMap } from "../components/MiniMap";
import { api, post } from "../lib/api";
import { formatSlot, formatNPR } from "../lib/format";
import { useAuth } from "../lib/auth";

type Tab =
  | "overview" | "dispatch" | "workers" | "customers" | "quotes" | "catalog"
  | "finance" | "rewards" | "reviews" | "support" | "broadcast" | "reports" | "audit" | "settings" | "staff";

const TABS: { id: Tab; label: string; section: string }[] = [
  { id: "overview", label: "Overview", section: "Operations" },
  { id: "dispatch", label: "Dispatch", section: "Operations" },
  { id: "workers", label: "Workers", section: "Operations" },
  { id: "customers", label: "Customers", section: "Operations" },
  { id: "quotes", label: "Quotes", section: "Operations" },
  { id: "finance", label: "Finance", section: "Money" },
  { id: "rewards", label: "Rewards", section: "Money" },
  { id: "reviews", label: "Reviews", section: "Money" },
  { id: "support", label: "Support", section: "Customers" },
  { id: "broadcast", label: "Broadcast", section: "Customers" },
  { id: "catalog", label: "Catalog", section: "System" },
  { id: "reports", label: "Reports", section: "System" },
  { id: "audit", label: "Audit", section: "System" },
  { id: "settings", label: "Settings", section: "System" },
  { id: "staff", label: "Staff", section: "System" },
];

/** Tab → capabilities (any-of). Super-admins bypass and see everything. */
const TAB_PERMS: Record<Tab, string[]> = {
  overview: ["overview.view"],
  dispatch: ["bookings.view"],
  workers: ["workers.view", "worker.verify", "worker.invite", "worker.activate", "bookings.assign", "bookings.view"],
  customers: ["customers.view"],
  quotes: ["quotes.view", "quotes.approve"],
  catalog: ["catalog.view", "catalog.edit"],
  finance: ["finance.view"],
  rewards: ["rewards.view", "settings.edit"],
  reviews: ["reviews.view"],
  support: ["support.reply"],
  broadcast: ["broadcast.send"],
  reports: ["reports.view"],
  audit: ["audit.read"],
  settings: ["settings.view", "settings.edit", "coverage.edit"],
  staff: ["staff.manage"],
};

function useMsg(): [string, (m: string) => void] {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 6000);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg];
}

function Stat({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  if (!onClick) {
    return (
      <div className="rounded-lg border border-outline/60 bg-white p-4 text-left">
        <p className="text-[11px] font-extrabold tracking-[0.12em] text-on-surface-variant uppercase">{label}</p>
        <p className="font-display mt-1 text-2xl font-semibold">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-on-surface-variant">{sub}</p>}
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className="elev-lift cursor-pointer rounded-lg border border-outline/60 bg-white p-4 text-left transition"
    >
      <p className="text-[11px] font-extrabold tracking-[0.12em] text-on-surface-variant uppercase">{label}</p>
      <p className="font-display mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-on-surface-variant">{sub}</p>}
    </button>
  );
}

function Table({ head, children, min = 640 }: { head: string[]; children: React.ReactNode; min?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-outline/60 bg-white">
      <table className="w-full text-sm" style={{ minWidth: min }}>
        <thead>
          <tr className="text-left text-xs text-on-surface-variant">
            {head.map((h) => <th key={h} className="px-4 py-2.5 font-bold">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label={title} aria-modal="true">
      <div className="absolute inset-0 bg-pine-950/60" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline bg-white px-5 py-4">
          <p className="font-bold">{title}</p>
          <button ref={closeRef} onClick={onClose} aria-label="Close panel" className="rounded-md p-1.5 hover:bg-surface-container">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [msg, setMsg] = useMsg();
  const { permissions, isSuperAdmin } = useAuth();

  const visible = TABS.filter((t) =>
    isSuperAdmin || TAB_PERMS[t.id].some((p) => permissions.includes(p)),
  );
  const canSee = (id: Tab) => visible.some((t) => t.id === id);

  useEffect(() => {
    if (!visible.some((t) => t.id === tab) && visible[0]) setTab(visible[0].id);
  }, [permissions, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (visible.length === 0) {
    return (
      <div className="fade-up">
        <PageHero
          eyebrow="Administration portal"
          title="Control centre"
          body="Your staff account has no panel access yet — ask a super-admin to grant permissions."
        />
      </div>
    );
  }

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Administration portal"
        title="Control centre"
        body="Verify pros, dispatch bookings, control money — every sensitive action is audit-logged with actor, action and timestamp."
      />
      <div className="wrap grid items-start gap-5 py-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:pb-0">
          {visible.map((t, i) => {
            const showHeading = t.section !== visible[i - 1]?.section;
            return (
              <div key={t.id} className="contents">
                {showHeading && (
                  <p aria-hidden="true" className="hidden shrink-0 px-4 pt-2 text-[11px] font-extrabold tracking-[0.12em] text-on-surface-variant uppercase lg:block">
                    {t.section}
                  </p>
                )}
                <button
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`shrink-0 rounded-md px-4 py-2.5 text-left text-sm font-bold transition active:scale-[0.98] ${
                    tab === t.id ? "bg-pine-950 text-white" : "bg-white border border-outline/60 hover:border-pine-800"
                  }`}
                >
                  {t.label}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="min-w-0">
          {msg && <p role="status" className="mb-4 rounded-md bg-info-container p-3 text-sm font-medium text-info">{msg}</p>}
          {tab === "overview" && <Overview go={setTab} canSee={canSee} />}
          {tab === "dispatch" && <Dispatch onMsg={setMsg} />}
          {tab === "workers" && <Workers onMsg={setMsg} />}
          {tab === "customers" && <Customers onMsg={setMsg} />}
          {tab === "quotes" && <Quotes onMsg={setMsg} />}
          {tab === "catalog" && <Catalog onMsg={setMsg} />}
          {tab === "finance" && <Finance onMsg={setMsg} />}
          {tab === "rewards" && <RewardsAdmin onMsg={setMsg} />}
          {tab === "reviews" && <ReviewsAdmin onMsg={setMsg} />}
          {tab === "support" && <SupportAdmin onMsg={setMsg} />}
          {tab === "broadcast" && <Broadcast onMsg={setMsg} />}
          {tab === "reports" && <Reports />}
          {tab === "audit" && <Audit />}
          {tab === "settings" && <Settings onMsg={setMsg} />}
          {tab === "staff" && <Staff onMsg={setMsg} />}
        </div>
      </div>
    </div>
  );
}

/* ================= OVERVIEW ================= */

function Overview({ go, canSee }: { go: (t: Tab) => void; canSee: (t: Tab) => boolean }) {
  const [d, setD] = useState<Record<string, number | string>>({});
  const [unassigned, setUnassigned] = useState<Record<string, string>[]>([]);
  const [verifs, setVerifs] = useState<Record<string, string>[]>([]);
  const [disputes, setDisputes] = useState<Record<string, string>[]>([]);
  const [recent, setRecent] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function recordError(key: string, e: unknown) {
    setErrors((prev) => ({ ...prev, [key]: e instanceof Error ? e.message : String(e) }));
  }
  function isRestricted(key: string) {
    return /missing permission|403|forbidden/i.test(errors[key] ?? "");
  }

  useEffect(() => {
    api<Record<string, number | string>>("/api/admin/overview").then(setD).catch((e) => recordError("overview", e));
    api<{ bookings: Record<string, string>[] }>("/api/admin/bookings?status=awaiting-worker").then((r) => setUnassigned(r.bookings)).catch((e) => recordError("unassigned", e));
    api<{ workers: Record<string, string>[] }>("/api/admin/workers?state=under-review").then((r) => setVerifs(r.workers)).catch((e) => recordError("verifs", e));
    api<{ bookings: Record<string, string>[] }>("/api/admin/bookings?status=disputed").then((r) => setDisputes(r.bookings)).catch((e) => recordError("disputes", e));
    api<{ bookings: Record<string, string>[] }>("/api/admin/bookings").then((r) => setRecent(r.bookings.slice(0, 8))).catch((e) => recordError("recent", e));
  }, []);

  const rs = (v: unknown) => (v == null ? "—" : formatNPR(Number(v)));
  const restrictedMsg = "Restricted — ask a super-admin for access";
  const overviewRestricted = isRestricted("overview");

  const statValue = (v: unknown, fallback = "—") =>
    overviewRestricted ? "Restricted" : (v == null ? fallback : String(v));
  const statSub = (s?: string) => (overviewRestricted ? "ask a super-admin for access" : s);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Unassigned bookings" value={statValue(d.unassigned)} sub={statSub("Need dispatch now")} onClick={canSee("dispatch") ? () => go("dispatch") : undefined} />
        <Stat label="Pending verifications" value={statValue(d.pendingVerifications)} sub={statSub("Pros in review queue")} onClick={canSee("workers") ? () => go("workers") : undefined} />
        <Stat label="Open disputes" value={statValue(d.openDisputes)} sub={statSub("Paused settlements")} onClick={canSee("dispatch") ? () => go("dispatch") : undefined} />
        <Stat label="Gross service value" value={overviewRestricted ? "Restricted" : rs(d.grossPaisa === undefined ? undefined : d.grossPaisa)} sub={statSub("Ledger-backed totals")} onClick={canSee("finance") ? () => go("finance") : undefined} />
        <Stat label="Earned commission" value={overviewRestricted ? "Restricted" : rs(d.commissionPaisa === undefined ? undefined : d.commissionPaisa)} onClick={canSee("finance") ? () => go("finance") : undefined} />
        <Stat label="Cash collected" value={overviewRestricted ? "Restricted" : rs(d.cashCollectedPaisa === undefined ? undefined : d.cashCollectedPaisa)} sub={statSub("Awaiting reconciliation")} onClick={canSee("finance") ? () => go("finance") : undefined} />
        <Stat label="Refunds" value={overviewRestricted ? "Restricted" : rs(d.refundsPaisa === undefined ? undefined : d.refundsPaisa)} onClick={canSee("finance") ? () => go("finance") : undefined} />
        <Stat label="Bookings by status" value={overviewRestricted ? restrictedMsg : ((d.bookings as unknown as { status: string; n: string }[] | undefined)?.map((b) => `${b.status.split("-")[0]}:${b.n}`).join(" · ") ?? "—")} />
      </div>

      {isRestricted("unassigned") ? (
        <Card className="p-4">
          <p className="text-sm text-on-surface-variant">{restrictedMsg} (unassigned bookings).</p>
        </Card>
      ) : unassigned.length > 0 && (
        <Card className="border-l-4 border-l-warning p-4">
          <p className="flex items-center gap-1.5 font-bold"><AlertTriangle size={16} aria-hidden="true" /> {unassigned.length} unassigned booking(s)</p>
          <ul className="mt-2 space-y-1 text-sm">
            {unassigned.slice(0, 5).map((b) => (
              <li key={b.id}><span className="font-mono">{b.booking_no}</span> · {b.service_name} · {b.address_text}</li>
            ))}
          </ul>
          {canSee("dispatch") && <Button variant="outline" className="mt-3" onClick={() => go("dispatch")}>Open dispatch <ArrowRight size={14} /></Button>}
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="font-bold">Verification queue ({isRestricted("verifs") ? "—" : verifs.length})</p>
          {isRestricted("verifs") ? <p className="mt-1 text-sm text-on-surface-variant">{restrictedMsg}.</p>
            : verifs.length === 0 ? <p className="mt-1 text-sm text-on-surface-variant">Queue clear.</p> : (
            <ul className="mt-2 space-y-1 text-sm">
              {verifs.slice(0, 5).map((w) => <li key={w.id}>{w.name} · {w.email}</li>)}
            </ul>
          )}
          {canSee("workers") && !isRestricted("verifs") && <Button variant="ghost" className="mt-2" onClick={() => go("workers")}>Review pros <ArrowRight size={14} /></Button>}
        </Card>
        <Card className="p-4">
          <p className="font-bold">Open disputes ({isRestricted("disputes") ? "—" : disputes.length})</p>
          {isRestricted("disputes") ? <p className="mt-1 text-sm text-on-surface-variant">{restrictedMsg}.</p>
            : disputes.length === 0 ? <p className="mt-1 text-sm text-on-surface-variant">No disputes.</p> : (
            <ul className="mt-2 space-y-1 text-sm">
              {disputes.slice(0, 5).map((b) => <li key={b.id}><span className="font-mono">{b.booking_no}</span> · {b.service_name}</li>)}
            </ul>
          )}
        </Card>
      </div>
      <div>
        <p className="mb-2 font-bold">Latest bookings</p>
        {isRestricted("recent") ? (
          <p className="text-sm text-on-surface-variant">{restrictedMsg}.</p>
        ) : (
        <Table head={["Booking", "Service", "Customer", "Pro", "Status"]}>
          {recent.map((b) => (
            <tr key={b.id} className="border-t border-outline/60">
              <td className="px-4 py-2.5 font-mono text-xs">{b.booking_no}</td>
              <td className="px-4 py-2.5">{b.service_name}</td>
              <td className="px-4 py-2.5">{b.customer_name}</td>
              <td className="px-4 py-2.5">{b.worker_name ?? "—"}</td>
              <td className="px-4 py-2.5"><Badge tone="info">{b.status}</Badge></td>
            </tr>
          ))}
        </Table>
        )}
      </div>
    </div>
  );
}

/* ================= DISPATCH ================= */

const STATUSES = ["", "pending", "awaiting-worker", "confirmed", "en-route", "in-progress", "awaiting-confirmation", "disputed", "completed", "cancelled"];

/** How long an unassigned booking has waited — aging work gets flagged. */
function AgeBadge({ createdAt, status, assigned }: { createdAt: string; status: string; assigned: boolean }) {
  const raw = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (Number.isNaN(raw)) return <span className="text-on-surface-variant">—</span>;
  const mins = Math.max(0, raw);
  const label = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  const aging = !assigned && ["pending", "awaiting-worker"].includes(status) && mins >= 120;
  const stale = !assigned && ["pending", "awaiting-worker"].includes(status) && mins >= 30;
  return (
    <span title={new Date(createdAt).toLocaleString()}>
      {aging ? <Badge tone="error">Aging · {label}</Badge>
        : stale ? <Badge tone="warning">{label}</Badge>
        : <span className="text-on-surface-variant">{label}</span>}
    </span>
  );
}

function Dispatch({ onMsg }: { onMsg: (m: string) => void }) {
  const [status, setStatus] = useState("");
  const [list, setList] = useState<Record<string, string>[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const seqRef = useRef(0);

  function load(s: string) {
    const my = ++seqRef.current;
    api<{ bookings: Record<string, string>[] }>(`/api/admin/bookings${s ? `?status=${s}` : ""}`)
      .then((r) => { if (seqRef.current === my) setList(r.bookings); }).catch(() => {});
  }
  useEffect(() => { load(status); }, [status]);

  const stops = list
    .filter((b) => typeof b.lat === "number" && typeof b.lng === "number")
    .slice(0, 50)
    .map((b) => ({
      id: String(b.id),
      label: String(b.booking_no),
      sub: `${String(b.service_name)} · ${String(b.status)}`,
      pin: { lat: Number(b.lat), lng: Number(b.lng) },
    }));

  return (
    <div className="space-y-4">
      {stops.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold">Live job map ({stops.length} pinned)</p>
          <LiveMap stops={stops} height={280} />
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Booking status filter">
        {STATUSES.map((s) => (
          <button key={s || "all"} onClick={() => setStatus(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${status === s ? "bg-pine-950 text-white" : "bg-white border border-outline/60"}`}>
            {s || "All"}
          </button>
        ))}
      </div>
      <Table head={["Booking", "Waiting", "Slot", "Service", "Customer", "Pro", "Status", ""]}>
        {list.map((b) => (
          <tr key={b.id} className="border-t border-outline/60">
            <td className="px-4 py-2.5 font-mono text-xs">{b.booking_no}</td>
            <td className="px-4 py-2.5 text-xs">
              <AgeBadge createdAt={b.created_at} status={b.status} assigned={Boolean(b.worker_id)} />
            </td>
            <td className="px-4 py-2.5 text-xs">{formatSlot(b.slot)}</td>
            <td className="px-4 py-2.5">{b.service_name}</td>
            <td className="px-4 py-2.5">{b.customer_name}</td>
            <td className="px-4 py-2.5">{b.worker_name ?? <span className="font-bold text-warning">Unassigned</span>}</td>
            <td className="px-4 py-2.5"><Badge tone={b.status === "disputed" ? "error" : b.status === "completed" ? "success" : "info"}>{b.status}</Badge></td>
            <td className="px-4 py-2.5"><Button variant="outline" onClick={() => setSelected(b.booking_no)}>Manage</Button></td>
          </tr>
        ))}
      </Table>
      {list.length === 0 && <EmptyState title="No bookings here" body="Try another status filter." />}
      {selected && <BookingDrawer bookingNo={selected} onClose={() => { setSelected(null); load(status); }} onMsg={onMsg} />}
    </div>
  );
}

function BookingDrawer({ bookingNo, onClose, onMsg }: { bookingNo: string; onClose: () => void; onMsg: (m: string) => void }) {
  const [b, setB] = useState<Record<string, string | number | null> | null>(null);
  const [history, setHistory] = useState<{ status: string; by_role: string; note: string; at: string }[]>([]);
  const [assigns, setAssigns] = useState<{ worker_name: string; reason: string; created_at: string }[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string; active_jobs: number }[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [reason, setReason] = useState("");
  const [eligibleFailed, setEligibleFailed] = useState(false);
  const seqRef = useRef(0);

  function reload() {
    const my = ++seqRef.current;
    api<{ booking: Record<string, string | number | null>; history: typeof history; assignments: typeof assigns }>(`/api/bookings/${bookingNo}`)
      .then((d) => { if (seqRef.current !== my) return; setB(d.booking); setHistory(d.history); setAssigns(d.assignments); }).catch(() => {});
    // Only pros who can actually take THIS job — verified, active, skilled.
    api<{ workers: typeof workers }>(`/api/bookings/${bookingNo}/eligible-workers`)
      .then((d) => { if (seqRef.current !== my) return; setWorkers(d.workers); setEligibleFailed(false); })
      .catch(() => { if (seqRef.current !== my) return; setWorkers([]); setEligibleFailed(true); });
  }
  useEffect(reload, [bookingNo]);

  async function assign() {
    if (!workerId) return;
    try {
      const out = await post<{ reassigned: boolean }>(`/api/bookings/${bookingNo}/assign`, { workerId, reason });
      onMsg(out.reassigned ? "Booking reassigned." : "Booking assigned.");
      reload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Assign failed");
    }
  }

  async function move(to: string) {
    try {
      await post(`/api/bookings/${bookingNo}/transition`, { to, note: "admin correction" });
      onMsg(`Moved to ${to}.`);
      reload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Transition failed");
    }
  }

  return (
    <Drawer title={`Booking ${bookingNo}`} onClose={onClose}>
      {!b ? <p className="text-sm text-on-surface-variant">Loading…</p> : (
        <>
          <Card className="p-4 text-sm">
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt className="text-on-surface-variant">Service</dt><dd className="font-bold">{String(b.service_name)}</dd></div>
              <div className="flex justify-between"><dt className="text-on-surface-variant">Status</dt><dd><Badge tone="info">{String(b.status)}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-on-surface-variant">Slot</dt><dd className="font-semibold">{formatSlot(String(b.slot))}</dd></div>
              <div className="flex justify-between"><dt className="text-on-surface-variant">Pro</dt><dd className="font-semibold">{String(b.worker_name ?? "Unassigned")}</dd></div>
              <div className="flex justify-between"><dt className="text-on-surface-variant">Customer phone</dt><dd className="font-semibold">{String(b.customer_phone ?? "—")}</dd></div>
              <div className="flex justify-between"><dt className="text-on-surface-variant">Address</dt><dd className="text-right font-semibold">{String(b.address_text)}</dd></div>
              <div className="flex justify-between"><dt className="text-on-surface-variant">Payment</dt><dd className="font-semibold">{String(b.payment_method)} · {String(b.payment_status)}</dd></div>
            </dl>
            <p className="mt-2 rounded-md bg-surface-container p-2.5 text-xs">{String(b.instructions || "No instructions")}</p>
            {typeof b.lat === "number" && typeof b.lng === "number" && (
              <div className="mt-2 space-y-1.5">
                <MiniMap pin={{ lat: b.lat as number, lng: b.lng as number }} height={160} />
                <a href={`https://www.openstreetmap.org/directions?to=${b.lat}%2C${b.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-block text-sm font-bold text-primary hover:underline">
                  Get directions <span aria-hidden="true">↗</span>
                </a>
              </div>
            )}
          </Card>

          {["pending", "awaiting-worker", "confirmed", "en-route", "in-progress"].includes(String(b.status)) ? (
          <div className="rounded-lg border border-outline/60 bg-white p-4">
            <p className="font-bold">Assign / reassign pro</p>
            <p className="text-xs text-on-surface-variant">Only verified, active pros skilled in {String(b.service_name)} are listed.</p>
            <div className="mt-2 space-y-2">
              {eligibleFailed ? (
                <p role="alert" className="text-sm font-medium text-error">Couldn't load eligible pros — check your dispatch permission and retry.</p>
              ) : workers.length === 0 ? (
                <p className="rounded-md bg-warning-container p-3 text-sm font-medium">
                  No eligible pro right now. Verify and activate a pro with this skill in the Workers tab first.
                </p>
              ) : (
                <Select value={workerId} onChange={(e) => setWorkerId(e.target.value)} aria-label="Professional">
                  <option value="">Choose a pro…</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.active_jobs > 0 ? ` (${w.active_jobs} active)` : ""}
                    </option>
                  ))}
                </Select>
              )}
              <TextField value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (recorded in audit)" />
              <Button onClick={assign} disabled={!workerId}>Assign</Button>
            </div>
          </div>
          ) : (
          <div className="rounded-lg border border-outline/60 bg-white p-4">
            <p className="font-bold">Assign / reassign pro</p>
            <p className="mt-1 rounded-md bg-surface-container p-3 text-sm text-on-surface-variant">
              This booking is {String(b.status)} — assignment is closed and can't be reopened from here.
            </p>
          </div>
          )}

          <div className="rounded-lg border border-outline/60 bg-white p-4">
            <p className="font-bold">Status correction</p>
            <p className="text-xs text-on-surface-variant">Controlled exception path — every move is logged.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(b.status === "pending" || b.status === "awaiting-worker"
                ? ["awaiting-worker", "cancelled"]
                : b.status === "disputed" ? ["completed", "cancelled"] : ["cancelled", "disputed"]
              ).map((to) => (
                <Button key={to} variant="outline" onClick={() => move(to)}>→ {to}</Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-outline/60 bg-white p-4">
            <p className="font-bold">Assignment history</p>
            {assigns.length === 0 ? <p className="text-sm text-on-surface-variant">No assignments yet.</p> : (
              <ul className="mt-1 space-y-1 text-sm">
                {assigns.map((a, i) => <li key={i}>{a.worker_name ?? "—"} · {a.reason} · {new Date(a.created_at).toLocaleString()}</li>)}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-outline/60 bg-white p-4">
            <p className="font-bold">Timeline</p>
            <ol className="mt-2 space-y-2">
              {history.map((h, i) => (
                <li key={i} className="border-l-2 border-outline pl-3 text-sm">
                  <strong>{h.status}</strong> <span className="text-xs text-on-surface-variant">by {h.by_role} · {new Date(h.at).toLocaleString()}{h.note ? ` — ${h.note}` : ""}</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </Drawer>
  );
}

/* ================= WORKERS ================= */

function Workers({ onMsg }: { onMsg: (m: string) => void }) {
  const [state, setState] = useState("");
  const [list, setList] = useState<Record<string, string | number>[]>(
    [],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [custQ, setCustQ] = useState("");
  const [custResults, setCustResults] = useState<{ id: string; name: string; email: string }[]>([]);

  function load() {
    api<{ workers: Record<string, string | number>[] }>(`/api/admin/workers${state ? `?state=${state}` : ""}`)
      .then((r) => setList(r.workers)).catch(() => {});
  }
  useEffect(load, [state]);

  async function searchCustomers() {
    try {
      const d = await api<{ customers: typeof custResults }>(`/api/admin/customers?q=${encodeURIComponent(custQ)}`);
      setCustResults(d.customers);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Search failed");
    }
  }

  async function inviteUser(userId: string, name: string) {
    try {
      await post("/api/admin/workers/invite-user", { userId });
      onMsg(`Invitation sent to ${name}'s profile — they accept from their dashboard.`);
      setCustResults([]);
      setCustQ("");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Invite failed");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="font-bold">Invite a professional</p>
        <p className="text-xs text-on-surface-variant">Pros enter only from existing customer accounts — search one below and send the invite to their dashboard. No links, no public signup.</p>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); searchCustomers(); }}>
          <TextField value={custQ} onChange={(e) => setCustQ(e.target.value)} placeholder="Search name or email…" aria-label="Search customers to invite" />
          <Button type="submit"><Search size={15} /> Find</Button>
        </form>
        {custResults.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {custResults.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-container px-3 py-2 text-sm">
                <span><strong>{c.name}</strong> · <span className="text-on-surface-variant">{c.email}</span></span>
                <Button variant="outline" onClick={() => inviteUser(c.id, c.name)}>Send invite</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="flex flex-wrap gap-2">
        {["", "under-review", "verified", "rejected", "suspended", "awaiting-documents", "draft"].map((s) => (
          <button key={s || "all"} onClick={() => setState(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${state === s ? "bg-pine-950 text-white" : "bg-white border border-outline/60"}`}>
            {s || "All"}
          </button>
        ))}
      </div>
      <Table head={["Pro", "State", "Jobs", "Joined", ""]}>
        {list.map((w) => (
          <tr key={String(w.id)} className="border-t border-outline/60">
            <td className="px-4 py-2.5"><strong>{String(w.name)}</strong><br /><span className="text-xs text-on-surface-variant">{String(w.email)}</span></td>
            <td className="px-4 py-2.5">
              <Badge tone={w.verification_state === "verified" ? "success" : w.verification_state === "suspended" || w.verification_state === "rejected" ? "error" : "warning"}>
                {String(w.verification_state)}
              </Badge>
            </td>
            <td className="px-4 py-2.5">{String(w.jobs_done)}</td>
            <td className="px-4 py-2.5 text-xs">{w.joined_at ? new Date(String(w.joined_at)).toLocaleDateString() : "—"}</td>
            <td className="px-4 py-2.5"><Button variant="outline" onClick={() => setSelected(String(w.id))}>Review</Button></td>
          </tr>
        ))}
      </Table>
      {list.length === 0 && <EmptyState title="No workers here" body="Invite your first pro above." />}
      {selected && <WorkerDrawer id={selected} onClose={() => { setSelected(null); load(); }} onMsg={onMsg} />}
    </div>
  );
}

function WorkerDrawer({ id, onClose, onMsg }: { id: string; onClose: () => void; onMsg: (m: string) => void }) {
  const [docs, setDocs] = useState<{ id: string; kind: string; uploaded_at: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Record<string, string>[]>([]);
  const [file, setFile] = useState<{
    name: string; email: string; phone: string;
    verification_state: string | null; profile_active: boolean | null;
  } | null>(null);

  useEffect(() => {
    api<{ documents: typeof docs }>(`/api/admin/workers/${id}/documents`).then((d) => setDocs(d.documents)).catch(() => {});
    api<{ services: typeof services }>("/api/admin/services-all").then((d) => setServices(d.services)).catch(() => {});
    api<{ bookings: typeof jobs }>("/api/admin/bookings").then((d) => setJobs(d.bookings.filter((b) => b.worker_id === id).slice(0, 10))).catch(() => {});
    api<{ worker: typeof file; skillIds: string[] }>(`/api/admin/workers/${id}`)
      .then((d) => { setFile(d.worker); setPicked(d.skillIds); }).catch(() => {});
  }, [id]);

  async function verify(state: string) {
    if (state === "suspended" && !window.confirm("Suspend this worker? They will stop receiving new jobs.")) return;
    try {
      await post(`/api/admin/workers/${id}/verify`, { state, notes: `Set to ${state} from control centre` });
      onMsg(`Worker ${state}. Verification history preserved.`);
      const d = await api<{ worker: typeof file; skillIds: string[] }>(`/api/admin/workers/${id}`);
      setFile(d.worker);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function activate(active: boolean) {
    if (!active && !window.confirm("Deactivate this worker? They will stop receiving new jobs.")) return;
    try {
      await post(`/api/admin/workers/${id}/activate`, { active, serviceIds: picked });
      onMsg(active ? "Activated with selected skills." : "Deactivated.");
      onClose();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Action failed");
    }
  }

  function toggle(sid: string) {
    setPicked((p) => p.includes(sid) ? p.filter((x) => x !== sid) : [...p, sid]);
  }

  return (
    <Drawer title="Worker review" onClose={onClose}>
      {file && (
        <Card className="p-4 text-sm">
          <p className="font-bold">{file.name}</p>
          <p className="text-on-surface-variant">{file.email} · {file.phone}</p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={file.verification_state === "verified" ? "success" : "warning"}>
              {file.verification_state ?? "no profile"}
            </Badge>
            {file.profile_active
              ? <Badge tone="success">Active</Badge>
              : <Badge tone="warning">Inactive</Badge>}
          </p>
        </Card>
      )}
      <Card className="p-4">
        <p className="font-bold">Verification documents ({docs.length})</p>
        {docs.length === 0 ? <p className="text-sm text-on-surface-variant">Checked physically at the office — nothing filed digitally.</p> : (
          <ul className="mt-1 space-y-1 text-sm">
            {docs.map((d) => <li key={d.id}>{d.kind} · {new Date(d.uploaded_at).toLocaleDateString()}</li>)}
          </ul>
        )}
      </Card>
      <Card className="p-4">
        <p className="font-bold">Decision</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={() => verify("verified")}><BadgeCheck size={15} /> Verify</Button>
          <Button variant="outline" onClick={() => verify("under-review")}>Needs review</Button>
          <Button variant="outline" onClick={() => verify("rejected")}><X size={15} /> Reject</Button>
          <Button variant="danger" onClick={() => verify("suspended")}><Ban size={15} /> Suspend</Button>
        </div>
      </Card>
      <Card className="p-4">
        <p className="font-bold">Skills & activation</p>
        <p className="text-xs text-on-surface-variant">
          Activation requires verified state plus at least one ticked specialty — unticked skills stay as they are.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          {services.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-outline p-2.5 text-sm">
              <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-[#0f6b44]" />
              {s.name}
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => activate(true)}><UserCheck size={15} /> Activate</Button>
          <Button variant="outline" onClick={() => activate(false)}><UserX size={15} /> Deactivate</Button>
        </div>
      </Card>
      <Card className="p-4">
        <p className="font-bold">Recent jobs ({jobs.length})</p>
        {jobs.length === 0 ? <p className="text-sm text-on-surface-variant">No jobs yet.</p> : (
          <ul className="mt-1 space-y-1 text-sm">
            {jobs.map((j) => <li key={j.id}><span className="font-mono text-xs">{j.booking_no}</span> · {j.service_name} · {j.status}</li>)}
          </ul>
        )}
      </Card>
    </Drawer>
  );
}

/* ================= CUSTOMERS ================= */

function Customers({ onMsg }: { onMsg: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Record<string, string | number | boolean>[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  function load() {
    api<{ customers: typeof list }>(`/api/admin/customers?q=${encodeURIComponent(q)}`).then((r) => setList(r.customers)).catch(() => {});
  }
  useEffect(load, []);

  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <TextField value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" aria-label="Search customers" />
        <Button type="submit"><Search size={15} /> Search</Button>
      </form>
      <Table head={["Customer", "Bookings", "Completed", "Status", ""]}>
        {list.map((c) => (
          <tr key={String(c.id)} className="border-t border-outline/60">
            <td className="px-4 py-2.5"><strong>{String(c.name)}</strong><br /><span className="text-xs text-on-surface-variant">{String(c.email)}</span></td>
            <td className="px-4 py-2.5">{String(c.bookings)}</td>
            <td className="px-4 py-2.5">{String(c.completed)}</td>
            <td className="px-4 py-2.5">{c.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="error">Restricted</Badge>}</td>
            <td className="px-4 py-2.5"><Button variant="outline" onClick={() => setSelected(String(c.id))}>Open</Button></td>
          </tr>
        ))}
      </Table>
      {selected && <CustomerDrawer id={selected} onClose={() => { setSelected(null); load(); }} onMsg={onMsg} />}
    </div>
  );
}

function CustomerDrawer({ id, onClose, onMsg }: { id: string; onClose: () => void; onMsg: (m: string) => void }) {
  const [d, setD] = useState<{
    customer: Record<string, string | boolean>;
    bookings: Record<string, string>[];
    rewardBalance: number;
    tickets: Record<string, string>[];
    addresses: Record<string, string | number | null>[];
  } | null>(null);

  function reload() {
    api<typeof d>(`/api/admin/customers/${id}`).then(setD).catch(() => {});
  }
  useEffect(reload, [id]);

  async function restrict(active: boolean) {
    if (!active && !window.confirm("Restrict this customer? They will not be able to book.")) return;
    try {
      await post(`/api/admin/customers/${id}/restrict`, { active });
      onMsg(active ? "Restriction lifted." : "Account restricted.");
      reload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <Drawer title="Customer file" onClose={onClose}>
      {!d ? <p className="text-sm text-on-surface-variant">Loading…</p> : (
        <>
          <Card className="p-4 text-sm">
            <p className="font-bold">{String(d.customer.name)}</p>
            <p className="text-on-surface-variant">{String(d.customer.email)} · {String(d.customer.phone)}</p>
            <p className="mt-1">Reward balance: <strong>{d.rewardBalance} pts</strong></p>
            <div className="mt-2">
              {d.customer.is_active
                ? <Button variant="danger" onClick={() => restrict(false)}>Restrict account</Button>
                : <Button onClick={() => restrict(true)}>Lift restriction</Button>}
            </div>
          </Card>
          <Card className="p-4">
            <p className="font-bold">Addresses</p>
            <ul className="mt-1 space-y-1 text-sm">
              {d.addresses.map((a) => <li key={String(a.id)}>{String(a.label)} — {String(a.line)}, {String(a.city)}</li>)}
            </ul>
          </Card>
          <Card className="p-4">
            <p className="font-bold">Bookings ({d.bookings.length})</p>
            <ul className="mt-1 space-y-1 text-sm">
              {d.bookings.map((b) => <li key={String(b.id)}><span className="font-mono text-xs">{String(b.booking_no)}</span> · {String(b.service_name)} · {String(b.status)}</li>)}
            </ul>
          </Card>
          <Card className="p-4">
            <p className="font-bold">Support tickets ({d.tickets.length})</p>
            <ul className="mt-1 space-y-1 text-sm">
              {d.tickets.map((t) => <li key={String(t.id)}>{String(t.subject)} · {String(t.status)}</li>)}
            </ul>
          </Card>
        </>
      )}
    </Drawer>
  );
}

/* ================= QUOTES ================= */

function Quotes({ onMsg }: { onMsg: (m: string) => void }) {
  const [list, setList] = useState<Record<string, string | null | { id: string; price_paisa: number; scope: string; availability: string; approved: boolean }[] | null>[]>([]);

  function load() {
    api<{ requests: typeof list }>("/api/admin/quotes").then((r) => setList(r.requests)).catch(() => {});
  }
  useEffect(load, []);

  async function approve(pid: string) {
    try {
      await post(`/api/quotes/proposals/${pid}/approve`, {});
      onMsg("Proposal approved — customer can now accept.");
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Approval failed");
    }
  }

  return (
    <div className="space-y-3">
      {list.length === 0 && <EmptyState title="No quote requests" body="Complex Damak jobs appear here for routing." />}
      {list.map((q) => (
        <Card key={String(q.id)} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">{String(q.title)}</p>
            <Badge tone={q.status === "accepted" ? "success" : "info"}>{String(q.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">{String(q.description)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {String(q.customer_name)} · Ward {q.ward == null ? "—" : String(q.ward)} · {String(q.landmark)}
          </p>
          <div className="mt-3 space-y-2">
            {((q.proposals ?? []) as { id: string; price_paisa: number; scope: string; availability: string; approved: boolean }[]).map((p) => (
              <div key={p.id} className="rounded-md bg-surface-container p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Price paisa={p.price_paisa} />
                  {p.approved ? <Badge tone="success">Approved</Badge> : <Badge tone="warning">Needs approval</Badge>}
                </div>
                <p className="mt-1">{p.scope}</p>
                <p className="text-xs text-on-surface-variant">Available: {p.availability}</p>
                {!p.approved && <Button variant="outline" className="mt-2" onClick={() => approve(p.id)}>Approve proposal</Button>}
              </div>
            ))}
            {((q.proposals ?? []) as unknown[]).length === 0 && (
              <p className="text-sm text-on-surface-variant">No proposals yet — routed to eligible verified pros.</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ================= CATALOG ================= */

function Catalog({ onMsg }: { onMsg: (m: string) => void }) {
  const [services, setServices] = useState<Record<string, string | number | boolean>[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [dur, setDur] = useState("");
  const [active, setActive] = useState(true);
  const [nName, setNName] = useState("");
  const [nDesc, setNDesc] = useState("");
  const [nCat, setNCat] = useState("");
  const [nPrice, setNPrice] = useState("");
  const [nModel, setNModel] = useState("fixed");
  const [cName, setCName] = useState("");
  const [cSlug, setCSlug] = useState("");
  const [cBps, setCBps] = useState("1500");

  function load() {
    api<{ services: typeof services; categories: typeof cats }>("/api/admin/services-all")
      .then((d) => { setServices(d.services); setCats(d.categories); if (!nCat && d.categories[0]) setNCat(d.categories[0].id); })
      .catch(() => {});
  }
  useEffect(load, []);

  const priceNum = Number(price);
  const priceError = price.trim() === "" ? "Enter a price." : Number.isNaN(priceNum) ? "Price must be a number." : priceNum < 0 ? "Price can't be negative." : "";
  const durNum = Number(dur);
  const durError = dur.trim() === "" ? "Enter minutes." : Number.isNaN(durNum) ? "Minutes must be a number." : durNum <= 0 ? "Minutes must be greater than 0." : "";
  const editError = priceError || durError;
  const nPriceNum = Number(nPrice);
  const nPriceError = nPrice.trim() === "" ? "Enter a base price." : Number.isNaN(nPriceNum) ? "Price must be a number." : nPriceNum < 0 ? "Price can't be negative." : "";

  function normalizeSlug(raw: string): string {
    return raw.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-");
  }

  function startEdit(s: Record<string, string | number | boolean>) {
    setEditing(String(s.id));
    setPrice(String(Math.round(Number(s.base_price_paisa) / 100)));
    setDur(String(s.duration_min));
    setActive(Boolean(s.is_active));
  }

  async function saveEdit(id: string) {
    if (editError) return;
    if (!active && !window.confirm("Deactivate this service? It will stop appearing for new bookings.")) return;
    try {
      await api(`/api/admin/services/${id}`, {
        method: "PUT",
        body: JSON.stringify({ basePricePaisa: Math.round(Number(price) * 100), durationMin: Number(dur), isActive: active }),
      });
      onMsg("Service updated. Existing bookings keep their snapshots.");
      setEditing(null);
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function createService() {
    if (nPriceError) return;
    try {
      await post("/api/admin/services", {
        categoryId: nCat, name: nName, description: nDesc,
        pricingModel: nModel, basePricePaisa: Math.round(Number(nPrice) * 100), durationMin: 60,
      });
      onMsg("Service created.");
      setNName(""); setNDesc(""); setNPrice("");
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function createCategory() {
    try {
      const slug = normalizeSlug(cSlug);
      await post("/api/admin/categories", { name: cName, slug, commissionBps: Number(cBps) });
      onMsg("Category created.");
      setCName(""); setCSlug("");
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Create failed");
    }
  }

  return (
    <div className="space-y-5">
      <Table head={["Service", "Category", "Price", "Jobs", "Active", ""]}>
        {services.map((s) => (
          <tr key={String(s.id)} className="border-t border-outline/60">
            <td className="px-4 py-2.5"><strong>{String(s.name)}</strong></td>
            <td className="px-4 py-2.5">{String(s.category_name ?? "—")}</td>
            <td className="px-4 py-2.5">
              {editing === String(s.id) ? (
                <span className="block">
                  <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" aria-label="Price in rupees"
                    className="w-24 rounded-md border border-outline px-2 py-1 text-sm" />
                  {priceError && <span role="alert" className="mt-1 block text-xs font-medium text-error">{priceError}</span>}
                </span>
              ) : <Price paisa={Number(s.base_price_paisa)} />}
            </td>
            <td className="px-4 py-2.5">{String(s.jobs_done)}</td>
            <td className="px-4 py-2.5">
              {editing === String(s.id) ? (
                <input type="checkbox" checked={active} onChange={() => setActive(!active)} aria-label="Active" className="size-4 accent-[#0f6b44]" />
              ) : s.is_active ? <Badge tone="success">Live</Badge> : <Badge tone="warning">Retired</Badge>}
            </td>
            <td className="px-4 py-2.5">
              {editing === String(s.id) ? (
                <span className="block">
                  <span className="flex gap-1.5">
                    <input value={dur} onChange={(e) => setDur(e.target.value)} inputMode="numeric" aria-label="Minutes"
                      className="w-16 rounded-md border border-outline px-2 py-1 text-sm" />
                    <Button onClick={() => saveEdit(String(s.id))} disabled={Boolean(editError)}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </span>
                  {durError && <span role="alert" className="mt-1 block text-xs font-medium text-error">{durError}</span>}
                </span>
              ) : (
                <Button variant="outline" onClick={() => startEdit(s)}>Edit</Button>
              )}
            </td>
          </tr>
        ))}
      </Table>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="font-bold">New service</p>
          <div className="mt-2 space-y-2">
            <Select value={nCat} onChange={(e) => setNCat(e.target.value)} aria-label="Category">
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <TextField value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Service name" aria-label="Service name" />
            <TextArea value={nDesc} onChange={(e) => setNDesc(e.target.value)} placeholder="Description" aria-label="Description" />
            <div className="flex gap-2">
              <Select value={nModel} onChange={(e) => setNModel(e.target.value)} aria-label="Pricing model">
                <option value="fixed">Fixed</option>
                <option value="starting">Starting at</option>
                <option value="hourly">Hourly</option>
                <option value="inspection-quote">Inspection quote</option>
                <option value="custom-quote">Custom quote</option>
              </Select>
              <TextField value={nPrice} onChange={(e) => setNPrice(e.target.value)} placeholder="Base Rs" inputMode="decimal" aria-label="Base price in rupees" />
            </div>
            {nPriceError && <p role="alert" className="text-xs font-medium text-error">{nPriceError}</p>}
            <Button onClick={createService} disabled={!nName || !nCat || Boolean(nPriceError)}>Add service</Button>
          </div>
        </Card>
        <Card className="p-4">
          <p className="font-bold">New category</p>
          <div className="mt-2 space-y-2">
            <TextField value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Category name" aria-label="Category name" />
            <TextField value={cSlug} onChange={(e) => setCSlug(e.target.value)} placeholder="slug" aria-label="Slug" />
            <p className="text-xs text-on-surface-variant">Lowercase letters, numbers and dashes only — auto-formatted on save (e.g. “Home Cleaning” → “home-cleaning”).</p>
            <TextField value={cBps} onChange={(e) => setCBps(e.target.value)} placeholder="Commission bps (1500 = 15%)" inputMode="numeric" aria-label="Commission bps" />
            <Button onClick={createCategory} disabled={!cName || !cSlug}>Add category</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================= FINANCE ================= */

function Finance({ onMsg }: { onMsg: (m: string) => void }) {
  const { can } = useAuth();
  const canSettle = can("finance.settle");
  const canRefund = can("finance.refund");
  const [filter, setFilter] = useState("");
  const [ledger, setLedger] = useState<Record<string, string | boolean>[]>([]);
  const [cash, setCash] = useState<Record<string, string>[]>([]);
  const [settlements, setSettlements] = useState<Record<string, string | number>[]>([]);
  const [sWorker, setSWorker] = useState("");
  const [sAmount, setSAmount] = useState("");
  const [sKind, setSKind] = useState("payout");
  const [sNote, setSNote] = useState("");
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [bookingQ, setBookingQ] = useState("");
  const [payments, setPayments] = useState<Record<string, string>[]>([]);
  const [rAmount, setRAmount] = useState("");
  const [rReason, setRReason] = useState("");
  const [rPayment, setRPayment] = useState("");
  const [sError, setSError] = useState("");
  const [rError, setRError] = useState("");

  function parsePositive(raw: string): number | null {
    const n = Number(raw);
    if (raw.trim() === "" || Number.isNaN(n) || n <= 0) return null;
    return n;
  }

  function load() {
    api<{ ledger: typeof ledger; cash: typeof cash; settlements: typeof settlements }>(
      `/api/admin/ledger${filter ? `?settled=${filter}` : ""}`)
      .then((d) => { setLedger(d.ledger); setCash(d.cash); setSettlements(d.settlements); }).catch(() => {});
    api<{ workers: typeof workers }>("/api/admin/workers").then((d) => setWorkers(d.workers)).catch(() => {});
  }
  useEffect(load, [filter]);

  async function settle() {
    const amt = parsePositive(sAmount);
    if (amt === null) {
      setSError("Enter an amount greater than 0.");
      return;
    }
    setSError("");
    if (!window.confirm(`Record ${sKind} of Rs ${amt} for this pro?`)) return;
    try {
      await post("/api/admin/settlements", {
        workerId: sWorker, amountPaisa: Math.round(amt * 100), kind: sKind, note: sNote,
      });
      onMsg("Settlement recorded. Nothing was silently deducted — it's all in the ledger.");
      setSAmount(""); setSNote("");
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Settlement failed");
    }
  }

  async function lookupPayments() {
    try {
      const d = await api<{ payments: typeof payments }>(`/api/admin/payments?booking=${encodeURIComponent(bookingQ)}`);
      setPayments(d.payments);
      if (d.payments[0]) setRPayment(String(d.payments[0].id));
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lookup failed");
    }
  }

  async function refund() {
    const amt = parsePositive(rAmount);
    if (amt === null) {
      setRError("Enter an amount greater than 0.");
      return;
    }
    setRError("");
    if (!window.confirm(`Issue a refund of Rs ${amt}?`)) return;
    try {
      const out = await post<{ partial: boolean }>("/api/admin/refunds", {
        paymentId: rPayment, amountPaisa: Math.round(amt * 100), reason: rReason,
      });
      onMsg(out.partial ? "Partial refund recorded." : "Full refund recorded. Reward points reversed.");
      setRAmount(""); setRReason("");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Refund failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[["", "All entries"], ["open", "Unsettled"], ["settled", "Settled"]].map(([v, l]) => (
          <button key={v || "all"} onClick={() => setFilter(v)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${filter === v ? "bg-pine-950 text-white" : "bg-white border border-outline/60"}`}>
            {l}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-2 font-bold">Commission ledger</p>
        <Table head={["Booking", "Pro", "Total", "Commission", "Pro keeps", "Settled"]}>
          {ledger.map((l) => (
            <tr key={String(l.id)} className="border-t border-outline/60">
              <td className="px-4 py-2.5 font-mono text-xs">{String(l.booking_no)}</td>
              <td className="px-4 py-2.5">{String(l.worker_name ?? "—")}</td>
              <td className="px-4 py-2.5">{formatNPR(Number(l.total_paisa))}</td>
              <td className="px-4 py-2.5 text-error">−{formatNPR(Number(l.commission_paisa))}</td>
              <td className="px-4 py-2.5 font-bold">{formatNPR(Number(l.worker_paisa))}</td>
              <td className="px-4 py-2.5">{l.is_settled ? <Badge tone="success">Settled</Badge> : <Badge tone="warning">Open</Badge>}</td>
            </tr>
          ))}
        </Table>
      </div>
      <div>
        <p className="mb-2 font-bold">Cash collected by pros</p>
        <Table head={["Booking", "Amount", "Collector", "When"]}>
          {cash.map((c) => (
            <tr key={String(c.id)} className="border-t border-outline/60">
              <td className="px-4 py-2.5 font-mono text-xs">{String(c.booking_no)}</td>
              <td className="px-4 py-2.5 font-bold">{formatNPR(Number(c.amount_paisa))}</td>
              <td className="px-4 py-2.5">{String(c.collector ?? "—")}</td>
              <td className="px-4 py-2.5 text-xs">{new Date(String(c.created_at)).toLocaleString()}</td>
            </tr>
          ))}
        </Table>
        {cash.length === 0 && <p className="mt-1 text-sm text-on-surface-variant">No cash collections recorded.</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="font-bold">Record settlement</p>
          <div className="mt-2 space-y-2">
            <Select value={sWorker} onChange={(e) => setSWorker(e.target.value)} aria-label="Professional">
              <option value="">Choose pro…</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
            <div className="flex gap-2">
              <Select value={sKind} onChange={(e) => setSKind(e.target.value)} aria-label="Kind">
                <option value="payout">Payout (we pay pro)</option>
                <option value="collection">Collection (pro owes us)</option>
              </Select>
              <TextField value={sAmount} onChange={(e) => setSAmount(e.target.value)} placeholder="Rs" inputMode="decimal" aria-label="Amount in rupees" />
            </div>
            <TextField value={sNote} onChange={(e) => setSNote(e.target.value)} placeholder="Reference / note" aria-label="Note" />
            {sError && <p role="alert" className="text-xs font-medium text-error">{sError}</p>}
            <Button onClick={settle} disabled={!sWorker || !sAmount || !canSettle}>Record</Button>
            {!canSettle && <p className="text-xs text-on-surface-variant">Needs finance.settle permission.</p>}
          </div>
          {settlements.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {settlements.slice(0, 5).map((s) => (
                <li key={String(s.id)}>{String(s.worker_name)} · {s.kind} {formatNPR(Number(s.amount_paisa))} · {String(s.note)}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <p className="font-bold">Issue refund</p>
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <TextField value={bookingQ} onChange={(e) => setBookingQ(e.target.value)} placeholder="Booking no or ID" aria-label="Booking lookup" />
              <Button variant="outline" onClick={lookupPayments}>Find payments</Button>
            </div>
            {payments.length > 0 && (
              <Select value={rPayment} onChange={(e) => setRPayment(e.target.value)} aria-label="Payment">
                {payments.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.provider)} · {formatNPR(Number(p.amount_paisa))} · {String(p.status)}</option>)}
              </Select>
            )}
            <TextField value={rAmount} onChange={(e) => setRAmount(e.target.value)} placeholder="Refund Rs" inputMode="decimal" aria-label="Refund amount" />
            <TextField value={rReason} onChange={(e) => setRReason(e.target.value)} placeholder="Reason (audit-logged)" aria-label="Reason" />
            {rError && <p role="alert" className="text-xs font-medium text-error">{rError}</p>}
            <Button onClick={refund} disabled={!rPayment || !rAmount || !canRefund}>Refund</Button>
            {!canRefund && <p className="text-xs text-on-surface-variant">Needs finance.refund permission.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================= REWARDS ADMIN ================= */

function RewardsAdmin({ onMsg }: { onMsg: (m: string) => void }) {
  const { can } = useAuth();
  const canEdit = can("settings.edit");
  const [settings, setSettings] = useState<Record<string, number | boolean | string>>({});
  const [draft, setDraft] = useState("");

  useEffect(() => {
    api<Record<string, number | boolean | string>>("/api/admin/settings").then((s) => { setSettings(s); setDraft(JSON.stringify(s, null, 2)); }).catch(() => {});
  }, []);

  async function save() {
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>;
      const KEYS = ["zone", "rewardPerNpr100", "redeemPoints", "redeemDiscountPaisa", "milestoneBookings", "milestoneBonus", "referralBonus", "quotesRequireAdminApproval", "quotesApprovalThresholdPaisa", "cookiePolicyVersion", "consentVersion"] as const;
      const value: Record<string, unknown> = {};
      for (const k of KEYS) {
        if (parsed[k] !== undefined) value[k] = parsed[k];
      }
      await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ value }) });
      onMsg("Reward rules updated. Historical awards are untouched.");
    } catch {
      onMsg("Invalid JSON or save failed.");
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4">
        <p className="font-bold">Current rules</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-on-surface-variant">Earn rate</dt><dd className="font-bold">{String(settings.rewardPerNpr100 ?? "—")} pt / Rs 100</dd></div>
          <div className="flex justify-between"><dt className="text-on-surface-variant">Redemption</dt><dd className="font-bold">{String(settings.redeemPoints ?? "—")} pts = Rs {Number(settings.redeemDiscountPaisa ?? 0) / 100}</dd></div>
          <div className="flex justify-between"><dt className="text-on-surface-variant">Milestone</dt><dd className="font-bold">+{String(settings.milestoneBonus ?? "—")} pts every {String(settings.milestoneBookings ?? "—")} jobs</dd></div>
        </dl>
        <p className="mt-2 text-xs text-on-surface-variant">Adjustments here never rewrite history — the ledger is append-only with admin audit entries.</p>
      </Card>
      <Card className="p-4">
        <p className="font-bold">Edit platform settings</p>
        <TextArea value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} aria-label="Platform settings JSON" />
        <Button className="mt-2" onClick={save} disabled={!canEdit}>Save settings</Button>
        {!canEdit && <p className="mt-1 text-xs text-on-surface-variant">Needs settings.edit permission.</p>}
      </Card>
    </div>
  );
}

/* ================= REVIEWS / SUPPORT / BROADCAST ================= */

function ReviewsAdmin({ onMsg }: { onMsg: (m: string) => void }) {
  const { can } = useAuth();
  const canModerate = can("reviews.moderate");
  const [list, setList] = useState<Record<string, string | number>[]>([]);

  function load() {
    api<{ reviews: typeof list }>("/api/admin/reviews").then((r) => setList(r.reviews)).catch(() => {});
  }
  useEffect(load, []);

  async function remove(id: string) {
    if (!window.confirm("Delete this review? Genuine reviews should stay.")) return;
    try {
      await api(`/api/admin/reviews/${id}`, { method: "DELETE" });
      onMsg("Review removed (audit-logged).");
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-2">
      {!canModerate && <p className="text-xs text-on-surface-variant">Delete needs reviews.moderate permission.</p>}
      <Table head={["Booking", "Pro", "Customer", "Rating", "Text", ""]}>
        {list.map((r) => (
          <tr key={String(r.id)} className="border-t border-outline/60">
            <td className="px-4 py-2.5 font-mono text-xs">{String(r.booking_no)}</td>
            <td className="px-4 py-2.5">{String(r.worker_name)}</td>
            <td className="px-4 py-2.5">{String(r.customer_name)}</td>
            <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1 font-bold"><Star size={13} /> {String(r.rating)}</span></td>
            <td className="px-4 py-2.5 max-w-xs truncate">{String(r.text || "—")}</td>
            <td className="px-4 py-2.5">{canModerate ? <Button variant="ghost" onClick={() => remove(String(r.id))} aria-label="Delete review"><Trash2 size={15} /></Button> : null}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function SupportAdmin({ onMsg }: { onMsg: (m: string) => void }) {
  const [list, setList] = useState<Record<string, string>[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  function load() {
    api<{ tickets: typeof list }>("/api/admin/tickets").then((r) => setList(r.tickets)).catch(() => {});
  }
  useEffect(load, []);

  async function sendReply(id: string) {
    try {
      await post(`/api/admin/tickets/${id}/reply`, { body: reply });
      onMsg("Reply sent.");
      setReply("");
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Reply failed");
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await post(`/api/admin/tickets/${id}/status`, { status });
      onMsg(`Ticket ${status}.`);
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <div className="space-y-3">
      {list.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">{t.subject}</p>
            <Badge tone={t.status === "resolved" ? "success" : t.status === "in-progress" ? "info" : "warning"}>{t.status}</Badge>
          </div>
          <p className="text-xs text-on-surface-variant">{t.user_name} · updated {new Date(t.updated_at).toLocaleString()}</p>
          {openId === t.id ? (
            <div className="mt-3 space-y-2">
              <TextArea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Internal reply to customer…" aria-label="Reply" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => sendReply(t.id)}>Send reply</Button>
                <Button variant="outline" onClick={() => setStatus(t.id, "resolved")}>Resolve</Button>
                <Button variant="ghost" onClick={() => setStatus(t.id, "open")}>Reopen</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="mt-2" onClick={() => setOpenId(t.id)}>Respond</Button>
          )}
        </Card>
      ))}
      {list.length === 0 && <EmptyState title="No tickets" body="Customer and pro issues land here." />}
    </div>
  );
}

function Broadcast({ onMsg }: { onMsg: (m: string) => void }) {
  const [audience, setAudience] = useState("CUSTOMER");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [ackAll, setAckAll] = useState(false);

  async function send() {
    try {
      const out = await post<{ recipients: number }>("/api/admin/notifications/broadcast", { audience, title, body });
      onMsg(`Broadcast sent to ${out.recipients} user(s).`);
      setTitle(""); setBody(""); setConfirming(false); setAckAll(false);
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Broadcast failed");
    }
  }

  const needsAck = audience === "ALL";

  return (
    <Card className="max-w-xl p-5">
      <p className="flex items-center gap-1.5 font-bold"><Megaphone size={16} aria-hidden="true" /> Notify an audience</p>
      <p className="text-xs text-on-surface-variant">In-app notifications. External channels attach at the notify service later.</p>
      {!confirming ? (
        <div className="mt-3 space-y-3">
          <Field label="Audience">
            <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="CUSTOMER">All customers</option>
              <option value="WORKER">All pros</option>
              <option value="ADMIN">Admins</option>
              <option value="ALL">Everyone</option>
            </Select>
          </Field>
          <Field label="Title"><TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ward 7 reopened" /></Field>
          <Field label="Message"><TextArea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Short, useful, no spam." /></Field>
          <Button onClick={() => setConfirming(true)} disabled={!title || !body}>Send broadcast</Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3 rounded-md border border-outline bg-surface-container/50 p-4">
          <p className="font-bold">Confirm broadcast</p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Audience</dt><dd className="font-bold">{audience}</dd></div>
            <div><dt className="text-on-surface-variant">Title</dt><dd className="font-bold">{title}</dd></div>
            <div><dt className="text-on-surface-variant">Message</dt><dd className="mt-0.5 rounded bg-white p-2">{body}</dd></div>
          </dl>
          {needsAck && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-outline bg-white p-3 text-sm">
              <input type="checkbox" checked={ackAll} onChange={(e) => setAckAll(e.target.checked)} className="mt-0.5 size-4 accent-[#0f6b44]" />
              <span className="font-semibold">I understand this notifies everyone</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={send} disabled={needsAck && !ackAll}>Confirm send</Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>Edit</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ================= REPORTS / AUDIT / SETTINGS ================= */

function Reports() {
  const toLocalDate = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const today = toLocalDate(new Date());
  const weekAgo = toLocalDate(new Date(Date.now() - 6 * 864e5));
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [d, setD] = useState<{
    totals: Record<string, number>; grossPaisa: string; commissionPaisa: string; cashPaisa: string; refundsPaisa: string;
    byDay: { day: string; bookings: number; completed: number }[];
    topServices: { name: string; jobs: number }[];
    payments: { provider: string; status: string; n: number; total: string }[];
    leaderboard: { name: string; completed: number; rating: number }[];
  } | null>(null);

  function load() {
    api<typeof d>(`/api/admin/reports/summary?from=${from}&to=${to}`).then(setD).catch(() => {});
  }
  useEffect(load, []);

  const maxDay = Math.max(1, ...(d?.byDay.map((x) => x.bookings) ?? [1]));

  return (
    <div className="space-y-5">
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-outline/60 bg-white p-4"
        onSubmit={(e) => { e.preventDefault(); load(); }}>
        <Field label="From"><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-outline px-3 py-2 text-sm" /></Field>
        <Field label="To"><input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-outline px-3 py-2 text-sm" /></Field>
        <Button type="submit">Apply</Button>
      </form>
      {!d ? <p className="text-sm text-on-surface-variant">Loading…</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Bookings" value={String(d.totals.bookings)} />
            <Stat label="Completed" value={String(d.totals.completed)} sub={`${d.totals.cancelled} cancelled · ${d.totals.disputed} disputed`} />
            <Stat label="Gross value" value={formatNPR(Number(d.grossPaisa))} />
            <Stat label="Commission" value={formatNPR(Number(d.commissionPaisa))} sub={`Cash ${formatNPR(Number(d.cashPaisa))} · Refunds ${formatNPR(Number(d.refundsPaisa))}`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <p className="font-bold">Bookings by day</p>
              <div className="mt-3 flex h-28 items-end gap-1.5" role="img" aria-label="Bookings per day bar chart">
                {d.byDay.map((x) => (
                  <div key={x.day} className="flex-1 rounded-t bg-primary/80" title={`${x.day}: ${x.bookings}`}
                    style={{ height: `${Math.max(4, (x.bookings / maxDay) * 100)}%` }} />
                ))}
                {d.byDay.length === 0 && <p className="text-sm text-on-surface-variant">No data in range.</p>}
              </div>
              <table className="sr-only">
                <caption>Bookings per day</caption>
                <tbody>
                  {d.byDay.map((x) => (
                    <tr key={x.day}><th scope="row">{x.day}</th><td>{x.bookings} bookings</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className="p-4">
              <p className="font-bold">Top services</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {d.topServices.map((s) => <li key={s.name} className="flex justify-between"><span>{s.name}</span><strong>{s.jobs} jobs</strong></li>)}
                {d.topServices.length === 0 && <li className="text-on-surface-variant">No completions in range.</li>}
              </ul>
            </Card>
            <Card className="p-4">
              <p className="font-bold">Payments</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {d.payments.map((p, i) => <li key={i} className="flex justify-between"><span>{p.provider} · {p.status}</span><strong>{p.n} · {formatNPR(Number(p.total))}</strong></li>)}
              </ul>
            </Card>
            <Card className="p-4">
              <p className="font-bold">Pro leaderboard</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {d.leaderboard.map((w) => <li key={w.name} className="flex justify-between"><span>{w.name}</span><strong>{w.completed} jobs · ★ {w.rating.toFixed(1)}</strong></li>)}
                {d.leaderboard.length === 0 && <li className="text-on-surface-variant">No pro activity in range.</li>}
              </ul>
            </Card>
          </div>
          <p className="text-xs text-on-surface-variant">Cancelled and failed bookings are excluded from revenue. Gross ≠ collected ≠ commission — always.</p>
        </>
      )}
    </div>
  );
}

function Audit() {
  const [entries, setEntries] = useState<Record<string, string>[]>([]);
  useEffect(() => {
    api<{ entries: typeof entries }>("/api/admin/audit").then((r) => setEntries(r.entries)).catch(() => {});
  }, []);
  return (
    <Table head={["When", "Actor", "Action", "Detail"]}>
      {entries.map((a) => (
        <tr key={a.id} className="border-t border-outline/60">
          <td className="px-4 py-2.5 text-xs">{formatSlot(a.created_at)}</td>
          <td className="px-4 py-2.5">{a.actor_name ?? a.actor_role}</td>
          <td className="px-4 py-2.5 font-mono text-xs">{a.action}</td>
          <td className="px-4 py-2.5">{a.detail}</td>
        </tr>
      ))}
    </Table>
  );
}

function Settings({ onMsg }: { onMsg: (m: string) => void }) {
  const [wards, setWards] = useState<{ ward: number; is_open: boolean }[]>([]);
  const [wardsLoading, setWardsLoading] = useState(true);
  const [wardsFailed, setWardsFailed] = useState(false);

  useEffect(() => {
    api<{ wards: typeof wards }>("/api/wards")
      .then((d) => { setWards(d.wards); setWardsFailed(false); })
      .catch(() => setWardsFailed(true))
      .finally(() => setWardsLoading(false));
  }, []);

  async function save() {
    if (!window.confirm("Closing wards blocks new bookings there. Continue?")) return;
    try {
      await api("/api/admin/wards", {
        method: "PUT",
        body: JSON.stringify({
          wards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => wards.find((x) => x.ward === w)?.is_open ?? true),
        }),
      });
      onMsg("Coverage updated — effective immediately for new addresses and bookings.");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="font-bold">Damak coverage — wards 1–10</p>
        <p className="text-sm text-on-surface-variant">Closing a ward immediately blocks new addresses and bookings there. Future towns arrive as new zone rows, not code changes.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {wards.map((w) => (
            <label key={w.ward} className="flex cursor-pointer items-center gap-2 rounded-md border border-outline p-3 text-sm font-bold">
              <input type="checkbox" checked={w.is_open}
                onChange={() => setWards((ws) => ws.map((x) => x.ward === w.ward ? { ...x, is_open: !x.is_open } : x))}
                className="size-4 accent-[#0f6b44]" />
              Ward {w.ward}
            </label>
          ))}
        </div>
        <Button className="mt-4" onClick={save} disabled={wardsLoading || wardsFailed}>Save coverage</Button>
        {wardsLoading && <p className="mt-2 text-xs text-on-surface-variant">Loading wards…</p>}
        {wardsFailed && <p className="mt-2 text-xs text-error">Wards failed to load — coverage editing is disabled.</p>}
      </Card>
      <Card className="p-5">
        <p className="font-bold">Reward & platform rules</p>
        <p className="text-sm text-on-surface-variant">Edit earn rates, redemption, milestones and quote-approval policy in the Rewards tab.</p>
        <p className="mt-2 text-sm">Admin roles & permissions live in the database (<code className="rounded bg-surface-container px-1 font-mono text-xs">roles / permissions / role_permissions</code>) — grant capabilities, not blanket admin.</p>
      </Card>
    </div>
  );
}

/* ================= STAFF / SUB-ADMINS (super-admin only) ================= */

const STAFF_PRESETS: { label: string; perms: string[]; hint: string }[] = [
  { label: "Dispatcher", hint: "Dispatch + workers + customers view", perms: ["overview.view", "bookings.view", "bookings.assign", "workers.view", "customers.view"] },
  { label: "Support agent", hint: "Customers + tickets + quotes view", perms: ["overview.view", "customers.view", "customers.manage", "support.reply", "quotes.view", "bookings.view"] },
  { label: "Catalog manager", hint: "Services + coverage", perms: ["catalog.view", "catalog.edit", "coverage.edit", "overview.view"] },
  { label: "Finance officer", hint: "Money + reports (no refunds)", perms: ["finance.view", "finance.settle", "reports.view", "overview.view"] },
  { label: "Finance + refunds", hint: "Full money powers", perms: ["finance.view", "finance.settle", "finance.refund", "reports.view", "overview.view"] },
  { label: "Auditor (read-only)", hint: "See everything, change nothing", perms: ["overview.view", "bookings.view", "customers.view", "finance.view", "reports.view", "audit.read", "reviews.view", "quotes.view"] },
  { label: "Marketing", hint: "Broadcasts + rewards", perms: ["broadcast.send", "rewards.view", "rewards.edit", "overview.view"] },
];

interface StaffRow {
  id: string; name: string; email: string; phone: string;
  is_active: boolean; created_at: string; permissions: string[];
}

function Staff({ onMsg }: { onMsg: (m: string) => void }) {
  const [list, setList] = useState<StaffRow[]>([]);
  const [groups, setGroups] = useState<{ group: string; perms: string[] }[]>([]);
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPhone, setNPhone] = useState("");
  const [nPass, setNPass] = useState("");
  const [picked, setPicked] = useState<string[]>(["overview.view", "bookings.view"]);
  const [editing, setEditing] = useState<string | null>(null);
  const [ePerms, setEPerms] = useState<string[]>([]);
  const [ePass, setEPass] = useState("");

  function load() {
    api<{ staff: StaffRow[] }>("/api/admin/staff").then((r) => setList(r.staff)).catch((e) => onMsg(e instanceof Error ? e.message : "Load failed"));
    api<{ permissions: string[]; groups: typeof groups }>("/api/admin/permissions").then((r) => setGroups(r.groups)).catch(() => {});
  }
  useEffect(load, []);

  function toggle(set: React.Dispatch<React.SetStateAction<string[]>>, p: string) {
    set((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  }

  async function create() {
    try {
      const perms = picked.filter((p) => p !== "staff.manage");
      await post("/api/admin/staff", { name: nName, email: nEmail, phone: nPhone, password: nPass, permissions: perms });
      onMsg(`Sub-admin ${nEmail} created with ${perms.length} permission(s).`);
      setNName(""); setNEmail(""); setNPhone(""); setNPass("");
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Create failed");
    }
  }

  function startEdit(s: StaffRow) {
    setEditing(s.id);
    setEPerms(s.permissions.filter((p) => p !== "staff.manage"));
    setEPass("");
    if (groups.length === 0) {
      api<{ permissions: string[]; groups: typeof groups }>("/api/admin/permissions")
        .then((r) => setGroups(r.groups))
        .catch(() => {});
    }
  }

  async function saveEdit(id: string) {
    try {
      await api(`/api/admin/staff/${id}`, { method: "PATCH", body: JSON.stringify({ permissions: ePerms.filter((p) => p !== "staff.manage") }) });
      onMsg("Permissions updated — takes effect on their next request.");
      setEditing(null);
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function setActive(id: string, active: boolean) {
    try {
      await api(`/api/admin/staff/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: active }) });
      onMsg(active ? "Access restored." : "Access suspended — sessions invalidated on next request.");
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function resetPass(id: string) {
    if (!ePass || ePass.length < 8) {
      onMsg("New password must be at least 8 characters.");
      return;
    }
    try {
      await api(`/api/admin/staff/${id}`, { method: "PATCH", body: JSON.stringify({ password: ePass }) });
      onMsg("Password reset.");
      setEPass("");
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Reset failed");
    }
  }

  async function revoke(id: string, email: string) {
    if (!window.confirm(`Revoke ${email}'s staff access? They go back to having no admin powers.`)) return;
    try {
      await api(`/api/admin/staff/${id}`, { method: "DELETE" });
      onMsg("Access revoked.");
      setEditing(null);
      load();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Revoke failed");
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <p className="font-bold">Create sub-admin</p>
        <p className="text-xs text-on-surface-variant">Only super-admins see this tab. New staff get the SUB_ADMIN role plus exactly the permissions you tick — nothing more. They can never grant staff.manage or touch this tab.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <TextField value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Full name" aria-label="Full name" />
          <TextField value={nEmail} onChange={(e) => setNEmail(e.target.value)} placeholder="staff@example.com" aria-label="Email" />
          <TextField value={nPhone} onChange={(e) => setNPhone(e.target.value)} placeholder="Phone (10+ digits)" aria-label="Phone" />
          <TextField value={nPass} onChange={(e) => setNPass(e.target.value)} type="password" placeholder="Temp password (min 8)" aria-label="Temporary password" autoComplete="new-password" />
        </div>
        <p className="mt-3 text-xs font-extrabold tracking-wider text-on-surface-variant uppercase">Quick presets</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {STAFF_PRESETS.map((p) => (
            <button key={p.label} onClick={() => setPicked(p.perms)} title={p.hint}
              className="rounded-full border border-outline bg-surface-container/60 px-3.5 py-1.5 text-xs font-bold hover:border-primary">
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-3">
          {(groups.length > 0 ? groups : [{ group: "Permissions", perms: picked }]).map((g) => (
            <div key={g.group}>
              <p className="text-xs font-extrabold tracking-wider text-on-surface-variant uppercase">{g.group}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {g.perms.filter((p) => p !== "staff.manage").map((p) => (
                  <label key={p} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold ${picked.includes(p) ? "border-primary bg-primary-container/60" : "border-outline bg-white"}`}>
                    <input type="checkbox" checked={picked.includes(p)} onChange={() => toggle(setPicked, p)} className="size-3.5 accent-[#0f6b44]" />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-on-surface-variant">staff.manage can&apos;t be granted — super-admin only.</p>
        </div>
        <Button className="mt-4" onClick={create} disabled={!nName || !nEmail || !nPhone || nPass.length < 8 || picked.length === 0}>
          Create sub-admin ({picked.length})
        </Button>
      </Card>

      <div>
        <p className="mb-2 font-bold">Staff ({list.length})</p>
        <Table head={["Staff", "Permissions", "Status", ""]}>
          {list.map((s) => (
            <tr key={s.id} className="border-t border-outline/60">
              <td className="px-4 py-2.5"><strong>{s.name}</strong><br /><span className="text-xs text-on-surface-variant">{s.email} · {s.phone}</span></td>
              <td className="px-4 py-2.5 text-xs">{s.permissions.length === 0 ? "—" : s.permissions.join(", ")}</td>
              <td className="px-4 py-2.5">{s.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="error">Suspended</Badge>}</td>
              <td className="px-4 py-2.5">
                <span className="flex gap-1.5">
                  <Button variant="outline" onClick={() => (editing === s.id ? setEditing(null) : startEdit(s))}>
                    {editing === s.id ? "Close" : "Manage"}
                  </Button>
                  {s.is_active
                    ? <Button variant="ghost" onClick={() => setActive(s.id, false)}>Suspend</Button>
                    : <Button variant="outline" onClick={() => setActive(s.id, true)}>Restore</Button>}
                </span>
              </td>
            </tr>
          ))}
        </Table>
        {list.length === 0 && <EmptyState title="No sub-admins yet" body="Create your first dispatcher or support agent above." />}
      </div>

      {editing && (() => {
        const s = list.find((x) => x.id === editing);
        if (!s) return null;
        return (
          <Drawer title={`Manage ${s.name}`} onClose={() => setEditing(null)}>
            <Card className="p-4">
              <p className="font-bold">Permissions ({ePerms.length})</p>
              <p className="text-xs text-on-surface-variant">Unticking removes panel tabs immediately on their next request. staff.manage can&apos;t be granted — super-admin only.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(groups.flatMap((g) => g.perms).length > 0 ? [...new Set(groups.flatMap((g) => g.perms))].filter((p) => p !== "staff.manage") : ePerms.filter((p) => p !== "staff.manage")).map((p) => (
                  <label key={p} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold ${ePerms.includes(p) ? "border-primary bg-primary-container/60" : "border-outline bg-white"}`}>
                    <input type="checkbox" checked={ePerms.includes(p)} onChange={() => toggle(setEPerms, p)} className="size-3.5 accent-[#0f6b44]" />
                    {p}
                  </label>
                ))}
              </div>
              <Button className="mt-3" onClick={() => saveEdit(s.id)} disabled={ePerms.length === 0}>Save permissions</Button>
            </Card>
            <Card className="p-4">
              <p className="font-bold">Reset password</p>
              <div className="mt-2 flex gap-2">
                <TextField value={ePass} onChange={(e) => setEPass(e.target.value)} type="password" placeholder="New password (min 8)" aria-label="New password" autoComplete="new-password" />
                <Button variant="outline" onClick={() => resetPass(s.id)}>Reset</Button>
              </div>
            </Card>
            <Card className="border-l-4 border-l-error p-4">
              <p className="font-bold text-error">Revoke access</p>
              <p className="text-xs text-on-surface-variant">Suspends the account and strips all staff permissions. Audit-logged.</p>
              <Button variant="danger" className="mt-2" onClick={() => revoke(s.id, s.email)}>Revoke {s.email}</Button>
            </Card>
          </Drawer>
        );
      })()}
    </div>
  );
}
