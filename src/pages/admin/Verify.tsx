import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Field, TextArea, TextField, VerifyBadge } from "../../components/ui";
import { SkeletonRows } from "../../components/ops";
import { Pager } from "../../components/AdminNav";
import { api, del, post } from "../../lib/api";
import {
  CHECKS,
  copyText,
  getPage,
  inviteLink,
  type AdminWorker,
  type Category,
  type Invite,
} from "../../lib/admin";

const LIMIT = 10;

function AddWorkerForm({
  categories,
  onCreated,
}: {
  categories: Category[];
  onCreated: (r: { inviteToken: string; expiresAt: string; email: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState("3");
  const [cats, setCats] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) {
      setError("Enter the worker's name.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Enter a valid email — the invite goes there.");
      return;
    }
    if (cats.length === 0) {
      setError("Pick at least one trade — it decides which jobs they can receive.");
      return;
    }
    setBusy(true);
    try {
      const r = await post<{ inviteToken: string; expiresAt: string }>("/api/admin/workers", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        bio: bio.trim(),
        yearsExp: Number(years) || 0,
        categoryIds: cats,
      });
      onCreated({ inviteToken: r.inviteToken, expiresAt: r.expiresAt, email: email.trim().toLowerCase() });
      setName("");
      setEmail("");
      setPhone("");
      setBio("");
      setYears("3");
      setCats([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create worker");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name">
        <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="Hari Prasad" autoComplete="off" />
      </Field>
      <Field label="Email (invite goes here)">
        <TextField value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hari@example.com" inputMode="email" autoComplete="off" />
      </Field>
      <Field label="Phone">
        <TextField value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9852600000" inputMode="tel" />
      </Field>
      <Field label="Experience (years)">
        <TextField value={years} onChange={(e) => setYears(e.target.value)} inputMode="numeric" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Short bio">
          <TextArea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="Trade background, strengths…" />
        </Field>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 block text-sm font-semibold">Trades (job eligibility)</legend>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cats.includes(c.id)}
              onClick={() => setCats((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                cats.includes(c.id)
                  ? "border-pine-950 bg-pine-950 text-white"
                  : "border-outline bg-white hover:border-pine-800"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm font-medium text-error sm:col-span-2">{error}</p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create worker & issue invite"}</Button>
      </div>
    </form>
  );
}

export default function VerifyPage() {
  const [workers, setWorkers] = useState<AdminWorker[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteTotal, setInviteTotal] = useState(0);
  const [invitePage, setInvitePage] = useState(1);
  const [checks, setChecks] = useState<Record<string, string[]>>({});
  const [newInvite, setNewInvite] = useState<{ inviteToken: string; expiresAt: string; email: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [docs, setDocs] = useState<Record<string, { id: string; kind: string; uploaded_at: string }[]>>({});
  const [docsOpen, setDocsOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [w, cat, inv] = await Promise.all([
        api<{ workers: AdminWorker[] }>("/api/admin/workers?page=1&limit=50"),
        api<{ categories: Category[] }>("/api/categories"),
        getPage<Invite>("/api/admin/invites", "invites", { page: invitePage, limit: LIMIT }),
      ]);
      setWorkers(w.workers);
      setCategories(cat.categories);
      setInvites(inv.rows);
      setInviteTotal(inv.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load verification data");
    } finally {
      setLoading(false);
    }
  }, [invitePage]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const toggleDocs = async (workerId: string) => {
    const open = !docsOpen[workerId];
    setDocsOpen((p) => ({ ...p, [workerId]: open }));
    if (open && docs[workerId] === undefined) {
      try {
        const d = await api<{ documents: { id: string; kind: string; uploaded_at: string }[] }>(
          `/api/admin/workers/${workerId}/documents`,
        );
        setDocs((p) => ({ ...p, [workerId]: d.documents }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load documents");
      }
    }
  };

  const downloadDoc = async (docId: string, kind: string) => {
    try {
      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4001";
      const res = await fetch(`${base}/api/admin/documents/${docId}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = kind;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  };

  const queue = workers.filter((w) =>
    ["draft", "awaiting-documents", "under-review", "rejected"].includes(w.verification_state),
  );

  if (loading) return <SkeletonRows rows={4} />;

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">{error}</p>
      )}
      <Card className="p-5 md:p-6">
        <h3 className="font-display text-lg font-semibold">Add a worker</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          Creates the account as <strong>draft</strong>, assigns the chosen trades, and issues a one-time
          invitation link. The worker activates with a password, then submits documents.
        </p>
        <div className="mt-4">
          <AddWorkerForm
            categories={categories}
            onCreated={(r) => {
              setNewInvite(r);
              setCopied("");
              void load();
            }}
          />
        </div>
        {newInvite && (
          <div className="mt-4 rounded-md border border-success bg-success-container/40 p-4" role="status">
            <p className="text-sm font-bold text-on-primary-container">
              Invite issued for {newInvite.email} — expires {new Date(newInvite.expiresAt).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">Share this one-time link out-of-band (SMS, call, in person):</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="max-w-full overflow-x-auto rounded bg-white px-2.5 py-1.5 text-xs">
                {inviteLink(newInvite.inviteToken)}
              </code>
              <Button
                variant="outline"
                onClick={() => {
                  void copyText(inviteLink(newInvite.inviteToken)).then((ok) =>
                    setCopied(ok ? "Copied!" : "Copy failed — select the link manually."),
                  );
                }}
              >
                Copy link
              </Button>
              {copied && <span className="text-xs font-bold text-success">{copied}</span>}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold">Invitations ({inviteTotal})</h3>
        {invites.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">No invitations issued yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {invites.map((inv) => {
              const expired = !inv.accepted_at && new Date(inv.expires_at).getTime() < Date.now();
              return (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline p-3 text-sm">
                  <span>
                    <span className="font-bold">{inv.name}</span>
                    <span className="text-on-surface-variant"> · {inv.email}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {inv.accepted_at ? (
                      <Badge tone="success">Accepted</Badge>
                    ) : expired ? (
                      <Badge tone="error">Expired</Badge>
                    ) : (
                      <Badge tone="warning">Pending</Badge>
                    )}
                    {!inv.accepted_at && !expired && (
                      <Button
                        variant="ghost"
                        onClick={() => void run(async () => {
                          await del(`/api/admin/invites/${inv.id}`);
                        })}
                      >
                        Revoke
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={invitePage} limit={LIMIT} total={inviteTotal} onPage={setInvitePage} />
      </Card>

      <div className="space-y-4">
        {queue.map((w) => {
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
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void toggleDocs(w.id)}
                >
                  {docsOpen[w.id] ? "Hide documents" : `Documents (${(docs[w.id] ?? []).length || "…"})`}
                </Button>
                <Button
                  disabled={!ready}
                  onClick={() => void run(() => post(`/api/admin/workers/${w.id}/verify`, { state: "verified", notes: "All checks passed" }))}
                >
                  Approve & activate
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void run(() => post(`/api/admin/workers/${w.id}/verify`, { state: "rejected", notes: "Rejected by admin" }))}
                >
                  Reject
                </Button>
              </div>
              {!ready && <p className="mt-2 text-xs text-on-surface-variant">All four checks must pass — a worker is never “background-checked” by account creation alone.</p>}
              {docsOpen[w.id] && (
                <div className="mt-3 rounded-md bg-surface-container p-3">
                  {(docs[w.id] ?? []).length === 0 ? (
                    <p className="text-sm text-on-surface-variant">No documents submitted yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {(docs[w.id] ?? []).map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                          <span><strong>{d.kind}</strong> · {new Date(d.uploaded_at).toLocaleString()}</span>
                          <Button variant="ghost" onClick={() => void downloadDoc(d.id, d.kind)}>
                            Download
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {queue.length === 0 && (
          <Card className="p-6 text-center text-sm text-on-surface-variant">Verification queue is clear.</Card>
        )}
      </div>
    </div>
  );
}
