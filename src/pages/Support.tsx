import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge, Button, Card, Field, PageHero, TextArea, TextField } from "../components/ui";
import { TICKETS } from "../data/mock";
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

export default function Support() {
  const [mine, setMine] = useState<{ subject: string; message: string; at: string }[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "", message: "" },
  });

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Support"
        title="Help & support"
        body="Real humans, 9 AM – 8 PM NPT, every day. Average first reply under 2 hours."
      />
      <div className="wrap max-w-3xl py-8">

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="font-bold">Call us</p>
          <p className="mt-1 text-2xl font-bold text-primary">01-5900000</p>
          <p className="text-sm text-on-surface-variant">Jawalakhel, Lalitpur · Sun–Sat</p>
        </Card>
        <Card className="p-5">
          <p className="font-bold">Emergencies</p>
          <p className="mt-1 text-sm text-on-surface-variant">Gas smell, sparking panels, burst pipes — call immediately. Do not wait for chat replies.</p>
        </Card>
      </div>

      <h2 className="mt-8 text-xl font-bold">Frequently asked</h2>
      <div className="mt-3 space-y-2">
        {FAQS.map((f) => (
          <details key={f.q} className="rounded-md border border-outline bg-white px-4 py-3">
            <summary className="cursor-pointer text-sm font-bold">{f.q}</summary>
            <p className="mt-2 text-sm text-on-surface-variant">{f.a}</p>
          </details>
        ))}
      </div>

      <h2 className="mt-8 text-xl font-bold">Your tickets</h2>
      <div className="mt-3 space-y-3">
        {TICKETS.map((t) => (
          <Card key={t.id} className="p-4">
            <p className="text-sm font-bold">{t.id} · {t.subject} <Badge tone={t.status === "resolved" ? "success" : "warning"}>{t.status}</Badge></p>
            <p className="mt-1 text-xs text-on-surface-variant">Updated {formatSlot(t.updatedAt)}</p>
          </Card>
        ))}
        {mine.map((t, i) => (
          <Card key={i} className="p-4">
            <p className="text-sm font-bold">T-{300 + i} · {t.subject} <Badge tone="info">open</Badge></p>
            <p className="mt-1 text-sm text-on-surface-variant">{t.message}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <h3 className="font-bold">Open a ticket</h3>
        <form
          className="mt-3 space-y-4"
          onSubmit={handleSubmit((f) => {
            setMine((p) => [...p, { ...f, at: new Date().toISOString() }]);
            reset();
          })}
        >
          <Field label="Subject" error={errors.subject?.message}>
            <TextField {...register("subject")} placeholder="e.g. Pro hasn't arrived for BK-1059" />
          </Field>
          <Field label="Details" error={errors.message?.message}>
            <TextArea {...register("message")} placeholder="Booking ID, what happened, what you need…" />
          </Field>
          <Button type="submit">Submit ticket</Button>
        </form>
      </Card>
      </div>
    </div>
  );
}
