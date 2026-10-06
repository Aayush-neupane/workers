import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Field, PageHero, TextArea, TextField } from "../components/ui";
import { api, post } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useAuth } from "../lib/auth";

const schema = z.object({
  subject: z.string().trim().min(8, "Subject needs at least 8 characters"),
  message: z.string().trim().min(20, "Describe the issue (20+ characters)"),
});

interface Ticket {
  id: string;
  subject: string;
  status: string;
  messages: { from: string; text: string; at: string }[] | null;
  updated_at: string;
}

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [done, setDone] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "", message: "" },
  });

  function reload() {
    if (!user) return;
    setLoadError("");
    api<{ tickets: Ticket[] }>("/api/tickets").then((d) => setTickets(d.tickets)).catch(() => setLoadError("Couldn't load your tickets."));
  }
  useEffect(reload, [user]);

  async function submit(f: z.infer<typeof schema>) {
    setSubmitError("");
    setDone(false);
    try {
      await post("/api/tickets", f);
      form.reset();
      setDone(true);
      reload();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not open ticket");
    }
  }

  if (!user) {
    return (
      <div className="fade-up">
        <PageHero eyebrow="Help" title="Support" body="Booking-linked complaints, payment disputes and refund requests — answered by our Damak team." />
        <div className="wrap py-8">
          <Card className="mx-auto max-w-md space-y-3 p-6 text-center">
            <p className="font-bold">Sign in to open and track tickets</p>
            <p className="text-sm text-on-surface-variant">Support tickets live on your account so replies reach you here.</p>
            <Link to="/signin"><Button className="w-full">Sign in</Button></Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <PageHero eyebrow="Help" title="Support" body="Booking-linked complaints, payment disputes and refund requests — answered by our Damak team." />
      <div className="wrap grid gap-5 py-8 md:grid-cols-2">
        <Card className="h-fit p-6">
          <h2 className="font-bold">Open a ticket</h2>
          <form className="mt-4 space-y-4" onSubmit={form.handleSubmit(submit)}>
            <Field label="Subject" error={form.formState.errors.subject?.message}>
              <TextField {...form.register("subject")} placeholder="e.g. Pro did not arrive for BK-1042" />
            </Field>
            <Field label="Details" error={form.formState.errors.message?.message}>
              <TextArea {...form.register("message")} placeholder="What happened, booking number, what you need…" />
            </Field>
            {submitError && <p role="alert" className="text-sm font-medium text-error">{submitError}</p>}
            {done && <p role="status" className="text-sm font-medium text-success">Ticket opened — we reply here.</p>}
            <Button type="submit">Submit ticket</Button>
          </form>
          <div className="mt-4 rounded-md bg-surface-container p-3 text-xs leading-relaxed text-on-surface-variant">
            Damak-5, Himal Chowk · Sun–Sat · 023-580000. Missing-worker and safety reports are prioritized.
          </div>
        </Card>
        <div className="space-y-3">
          <h2 className="font-bold">Your tickets ({tickets.length})</h2>
          {loadError && (
            <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-error-container p-3.5 text-sm font-medium text-error">
              {loadError}
              <Button variant="outline" onClick={reload}>Retry</Button>
            </p>
          )}
          {tickets.map((t) => (
            <Card key={t.id} className="p-5">
              <p className="font-bold">{t.subject}</p>
              <p className="text-xs text-on-surface-variant">{t.status} · updated {formatDateTime(t.updated_at)}</p>
              <div className="mt-2 space-y-1.5 text-sm">
                {(t.messages ?? []).map((m, i) => (
                  <p key={i} className="rounded-md bg-surface-container p-2.5">
                    <strong>{m.from}:</strong> {m.text}
                  </p>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
