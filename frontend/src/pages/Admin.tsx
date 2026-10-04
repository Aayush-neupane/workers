import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, PageHero, Price } from "../components/ui";
import { api, post } from "../lib/api";
import { formatSlot } from "../lib/format";

type Tab = "overview" | "bookings" | "workers" | "quotes" | "finance" | "audit" | "wards";

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteToken, setInviteToken] = useState("");

  function load(t: Tab) {
    setMsg("");
    const routes: Record<Tab, string> = {
      overview: "/api/admin/overview",
      bookings: "/api/admin/bookings",
      workers: "/api/admin/workers",
      quotes: "/api/quotes/requests/open",
      finance: "/api/admin/bookings?status=completed",
      audit: "/api/admin/audit",
      wards: "/api/wards",
    };
    api<Record<string, unknown>>(routes[t]).then((d) => setData(d)).catch((e: unknown) =>
      setMsg(e instanceof Error ? e.message : "Load failed"));
  }

  useEffect(() => { load(tab); }, [tab]);

  async function invite() {
    setMsg("");
    try {
      const out = await post<{ token: string }>("/api/admin/workers/invite", { email: inviteEmail, name: inviteName });
      setInviteToken(out.token);
      setMsg("Invite created — share the link securely. It expires in 7 days.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Invite failed");
    }
  }

  async function verify(id: string, state: string) {
    try {
      await post(`/api/admin/workers/${id}/verify`, { state, notes: `Set to ${state} from admin portal` });
      setMsg(`Worker ${state}.`);
      load("workers");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function activate(id: string, active: boolean) {
    try {
      await post(`/api/admin/workers/${id}/activate`, { active, serviceIds: [] });
      setMsg(active ? "Activated." : "Deactivated.");
      load("workers");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function approveProposal(id: string) {
    try {
      await post(`/api/quotes/proposals/${id}/approve`, {});
      setMsg("Proposal approved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Approval failed");
    }
  }

  return (
    <div className="fade-up">
      <PageHero eyebrow="Administration portal" title="Operations" body="Verify pros, dispatch bookings, control money — every sensitive action is audit-logged." />
      <div className="wrap py-8">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
          {(["overview", "bookings", "workers", "quotes", "finance", "audit", "wards"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-bold capitalize ${tab === t ? "bg-pine-950 text-white" : "bg-surface-container"}`}>
              {t}
            </button>
          ))}
        </div>
        {msg && <p role="status" className="mt-4 rounded-md bg-info-container p-3 text-sm font-medium text-info">{msg}</p>}

        {tab === "overview" && <Overview data={data} />}

        {tab === "bookings" && (
          <Card className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-xs text-on-surface-variant">
                <th className="px-4 py-2.5">Booking</th><th className="px-4 py-2.5">Service</th>
                <th className="px-4 py-2.5">Customer</th><th className="px-4 py-2.5">Pro</th><th className="px-4 py-2.5">Status</th>
              </tr></thead>
              <tbody>
                {((data.bookings ?? []) as Record<string, string>[]).map((b) => (
                  <tr key={b.id} className="border-t border-outline/60">
                    <td className="px-4 py-2.5 font-mono">{b.booking_no}</td>
                    <td className="px-4 py-2.5">{b.service_name}</td>
                    <td className="px-4 py-2.5">{b.customer_name}</td>
                    <td className="px-4 py-2.5">{b.worker_name ?? "—"}</td>
                    <td className="px-4 py-2.5"><Badge tone="info">{b.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "workers" && (
          <div className="mt-4 space-y-4">
            <Card className="p-5">
              <p className="font-bold">Invite a worker</p>
              <p className="text-xs text-on-surface-variant">Pros enter only through invitation — no public signup exists.</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name"
                  className="rounded-md border border-outline px-3 py-2 text-sm outline-none focus:border-primary" aria-label="Worker name" />
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email"
                  className="rounded-md border border-outline px-3 py-2 text-sm outline-none focus:border-primary" aria-label="Worker email" />
                <Button onClick={invite}>Create invite</Button>
              </div>
              {inviteToken && (
                <p className="mt-2 rounded-md bg-warning-container p-3 font-mono text-xs break-all">
                  Invite link: {window.location.origin}/invite?token={inviteToken} — shown once, share securely.
                </p>
              )}
              <p className="mt-2 text-xs text-on-surface-variant">Note: the public invite-accept page is a next task; the API accept flow is live.</p>
            </Card>
            {((data.workers ?? []) as Record<string, string | number>[]).map((w) => (
              <Card key={String(w.id)} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold">{w.name} <span className="text-xs font-normal text-on-surface-variant">{w.email}</span></p>
                  <p className="text-sm text-on-surface-variant">{w.jobs_done} jobs · {w.areas as string}</p>
                  <Badge tone={w.verification_state === "verified" ? "success" : "warning"}>{w.verification_state as string}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => verify(String(w.id), "verified")}>Verify</Button>
                  <Button variant="outline" onClick={() => verify(String(w.id), "rejected")}>Reject</Button>
                  <Button variant="outline" onClick={() => verify(String(w.id), "suspended")}>Suspend</Button>
                  <Button onClick={() => activate(String(w.id), true)}>Activate</Button>
                  <Button variant="ghost" onClick={() => activate(String(w.id), false)}>Deactivate</Button>
                </div>
              </Card>
            ))}
            {((data.workers ?? []) as unknown[]).length === 0 && <EmptyState title="No workers yet" body="Invite your first pro to start verification." />}
          </div>
        )}

        {tab === "quotes" && (
          <div className="mt-4 space-y-3">
            {((data.requests ?? []) as Record<string, string>[]).map((q) => (
              <Card key={q.id} className="p-4">
                <p className="font-bold">{q.title}</p>
                <p className="text-sm text-on-surface-variant">{q.description}</p>
                <Button variant="outline" className="mt-2" onClick={() => approveProposal(String(q.id))}>
                  Review proposals in detail via API — approve from the quote thread
                </Button>
              </Card>
            ))}
            {((data.requests ?? []) as unknown[]).length === 0 && <EmptyState title="No open quote requests" body="Complex Damak jobs appear here for routing." />}
          </div>
        )}

        {tab === "finance" && (
          <div className="mt-4"><EmptyState title="Settlements & refunds" body="Use the API: POST /api/admin/settlements and POST /api/admin/refunds. A full finance ledger UI ships next." /></div>
        )}

        {tab === "audit" && (
          <Card className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-xs text-on-surface-variant">
                <th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Actor</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Detail</th>
              </tr></thead>
              <tbody>
                {((data.entries ?? []) as Record<string, string>[]).map((a) => (
                  <tr key={a.id} className="border-t border-outline/60">
                    <td className="px-4 py-2.5 text-xs">{a.created_at ? formatSlot(a.created_at) : "—"}</td>
                    <td className="px-4 py-2.5">{a.actor_name ?? a.actor_role}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{a.action}</td>
                    <td className="px-4 py-2.5">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "wards" && <Wards data={data} onMsg={setMsg} onReload={() => load("wards")} />}
      </div>
    </div>
  );
}

function Overview({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    bookings?: { status: string; n: string }[];
    unassigned?: number; pendingVerifications?: number; openDisputes?: number;
    grossPaisa?: string; commissionPaisa?: string; cashCollectedPaisa?: string; refundsPaisa?: string;
  };
  const cards: [string, string][] = [
    ["Unassigned bookings", String(d.unassigned ?? "—")],
    ["Pending verifications", String(d.pendingVerifications ?? "—")],
    ["Open disputes", String(d.openDisputes ?? "—")],
    ["Gross service value", d.grossPaisa != null ? `Rs ${(Number(d.grossPaisa) / 100).toLocaleString()}` : "—"],
    ["Earned commission", d.commissionPaisa != null ? `Rs ${(Number(d.commissionPaisa) / 100).toLocaleString()}` : "—"],
    ["Cash collected", d.cashCollectedPaisa != null ? `Rs ${(Number(d.cashCollectedPaisa) / 100).toLocaleString()}` : "—"],
    ["Refunds", d.refundsPaisa != null ? `Rs ${(Number(d.refundsPaisa) / 100).toLocaleString()}` : "—"],
  ];
  return (
    <div className="mt-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-xs font-bold text-on-surface-variant uppercase">{label}</p>
            <p className="font-display mt-1 text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(d.bookings ?? []).map((b) => (
          <Badge key={b.status} tone="info">{b.status}: {b.n}</Badge>
        ))}
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">Gross ≠ collected ≠ commission: ledger-backed, never mixed.</p>
    </div>
  );
}

function Wards({ data, onMsg, onReload }: { data: Record<string, unknown>; onMsg: (m: string) => void; onReload: () => void }) {
  const [wards, setWards] = useState<{ ward: number; is_open: boolean }[]>(
    ((data.wards ?? []) as { ward: number; is_open: boolean }[]),
  );
  useEffect(() => {
    setWards(((data.wards ?? []) as { ward: number; is_open: boolean }[]));
  }, [data]);

  async function save() {
    try {
      await api("/api/admin/wards", {
        method: "PUT",
        body: JSON.stringify({ wards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => wards.find((x) => x.ward === w)?.is_open ?? true) }),
      });
      onMsg("Coverage updated.");
      onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <Card className="mt-4 p-5">
      <p className="font-bold">Damak coverage — wards 1–10</p>
      <p className="text-sm text-on-surface-variant">Closing a ward immediately blocks new addresses and bookings there.</p>
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
      <Button className="mt-4" onClick={save}>Save coverage</Button>
      <p className="mt-3 text-xs text-on-surface-variant">Settled payouts: <Price paisa={0} /> — finance detail ships with the ledger UI.</p>
    </Card>
  );
}
