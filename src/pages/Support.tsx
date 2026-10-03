import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { Badge, Button, Card, Field, PageHero, TextArea, TextField } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useStore } from "../lib/store";
import { formatSlot } from "../lib/format";

const schema = z.object({
  subject: z.string().trim().min(8, "Summarize the issue (8+ characters)"),
  message: z.string().trim().min(20, "Describe what happened (20+ characters)"),
});

const FAQS = [
  { q: "How do I reschedule?", a: "Open the booking in Track, or message support at least 4 hours before the slot. Rescheduling is free up to 4 hours ahead; inside 4 hours a visit charge may apply." },
  { q: "The pro is late. What now?", a: "Track shows live status. If the pro hasn't started travel 30 minutes past the slot, contact support — we'll reassign or refund per policy." },
  { q: "Can I get a refund?", a: "Prepaid online bookings are refunded in full if cancelled before dispatch. After work starts, refunds follow the cancellation table and any completed work is itemized." },
  { q: "How are cash payments receipted?", a: "Every cash collection is recorded against the booking with timestamp and collector. You'll find receipts under Dashboard → History." },
  { q: "Do points expire?", a: "No expiry in the current program. If expiry is ever enabled, 90-day notice applies and existing balances are honored." },
  { q: "How do I become a worker?", a: "Workers can't self-register. Contact us with your trade and experience — our team creates your account and runs verification before activation." },
];

function Thread({ ticketId }: { ticketId: string }) {
  const { tickets, replyTicket } = useStore();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-outline pt-3">
      {ticket.messages.map((m, i) => (
        <div
          key={i}
          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
            m.from === "support"
              ? "bg-primary-container text-on-surface"
              : "ml-auto bg-surface-container text-on-surface"
          }`}
        >
          <p className="text-[11px] font-extrabold tracking-wide uppercase opacity-70">
            {m.from === "support" ? "Support" : "You"} · {formatSlot(m.at)}
          </p>
          <p className="mt-0.5">{m.text}</p>
        </div>
      ))}
      {ticket.status !== "resolved" && (
        <form
          className="flex gap-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim().length < 1) return;
            setSending(true);
            setError("");
            replyTicket(ticket.id, draft.trim())
              .then(() => setDraft(""))
              .catch((err) => setError(err instanceof Error ? err.message : "Reply failed"))
              .finally(() => setSending(false));
          }}
        >
          <label className="sr-only" htmlFor={`thread-${ticket.id}`}>Reply to support</label>
          <input
            id={`thread-${ticket.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a follow-up…"
            className="w-full rounded-md border border-outline bg-white px-3 py-2 text-sm"
          />
          <Button type="submit" variant="outline" disabled={sending || !draft.trim()}>
            {sending ? "…" : "Send"}
          </Button>
        </form>
      )}
      {error && <p role="alert" className="text-xs font-medium text-error">{error}</p>}
    </div>
  );
}

export default function Support() {
  const { user } = useAuth();
  const { tickets, createTicket, reload } = useStore();
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema) as unknown as Resolver<z.infer<typeof schema>>,
    defaultValues: { subject: "", message: "" },
  });

  // Keep threads fresh while the page is open.
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      void reload();
    }, 30000);
    return () => clearInterval(t);
  }, [user, reload]);

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Support"
        title="Help & support"
        body="Real humans, 9 AM – 8 PM NPT, every day. Average first reply under 2 hours."
      />
      <div className="wrap max-w-3xl py-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-t-4 border-t-pine-800 p-5">
          <p className="font-bold">Call us</p>
          <p className="font-display mt-1 text-3xl font-semibold text-primary">023-580000</p>
          <p className="text-sm text-on-surface-variant">Damak-5, Himal Chowk · Sun–Sat</p>
        </Card>
        <Card className="border-t-4 border-t-marigold-500 p-5">
          <p className="font-bold">Emergencies</p>
          <p className="mt-1 text-sm text-on-surface-variant">Gas smell, sparking panels, burst pipes — call immediately. Do not wait for chat replies.</p>
        </Card>
      </div>

      <h2 className="font-display mt-8 text-2xl font-semibold">Frequently asked</h2>
      <div className="mt-3 space-y-2">
        {FAQS.map((f) => (
          <details key={f.q} className="rounded-md border border-outline bg-white px-4 py-3">
            <summary className="cursor-pointer text-sm font-bold">{f.q}</summary>
            <p className="mt-2 text-sm text-on-surface-variant">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Your tickets</h2>
        {user && (
          <Button variant="ghost" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw size={15} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        )}
      </div>
      {!user ? (
        <Card className="mt-3 p-5 text-sm">
          <Link to="/signin" className="font-bold text-primary">Sign in</Link> to view and open tickets.
        </Card>
      ) : tickets.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">No tickets yet — open one below and we&apos;ll pick it up.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="p-4 md:p-5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                {t.subject}
                <Badge tone={t.status === "resolved" ? "success" : t.status === "open" ? "warning" : "info"}>
                  {t.status}
                </Badge>
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">Updated {formatSlot(t.updatedAt)}</p>
              <Thread ticketId={t.id} />
            </Card>
          ))}
        </div>
      )}

      {user && (
        <Card className="mt-4 p-5">
          <h3 className="font-bold">Open a ticket</h3>
          <form
            className="mt-3 space-y-4"
            onSubmit={handleSubmit(async (f) => {
              setSubmitError("");
              try {
                await createTicket(f.subject, f.message);
                reset();
                setSent(true);
              } catch (e) {
                setSubmitError(e instanceof Error ? e.message : "Could not submit ticket");
              }
            })}
          >
            <Field label="Subject" error={errors.subject?.message}>
              <TextField {...register("subject")} placeholder="e.g. Pro hasn't arrived for BK-1059" />
            </Field>
            <Field label="Details" error={errors.message?.message}>
              <TextArea {...register("message")} placeholder="Booking ID, what happened, what you need…" />
            </Field>
            <Button type="submit">Submit ticket</Button>
            {submitError && (
              <p role="alert" className="text-sm font-medium text-error">{submitError}</p>
            )}
            {sent && <p role="status" className="text-sm text-success">Ticket opened — we&apos;ll reply here.</p>}
          </form>
        </Card>
      )}
      </div>
    </div>
  );
}
