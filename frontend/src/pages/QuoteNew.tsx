import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin } from "lucide-react";
import { Button, Card, Field, PageHero, Select, TextArea, TextField } from "../components/ui";
import { MapPicker } from "../components/MapPicker";
import { api, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { suggestStreet, type Pin } from "../lib/geo";
import type { Category } from "../lib/types";

const schema = z.object({
  categoryId: z.string().optional(),
  title: z.string().trim().min(8, "Give the job a clear title"),
  description: z.string().trim().min(20, "Describe the job in detail (20+ characters)"),
  landmark: z.string().trim().min(5, "Enter ward and landmark"),
  windowStart: z.string().min(1, "Pick a start"),
  windowEnd: z.string().min(1, "Pick an end"),
}).superRefine((d, ctx) => {
  const start = new Date(d.windowStart).getTime();
  const end = new Date(d.windowEnd).getTime();
  const now = Date.now();
  if (d.windowStart && Number.isFinite(start) && start <= now) {
    ctx.addIssue({ code: "custom", message: "Start must be in the future", path: ["windowStart"] });
  }
  if (d.windowEnd && Number.isFinite(end) && end <= now) {
    ctx.addIssue({ code: "custom", message: "End must be in the future", path: ["windowEnd"] });
  }
  if (d.windowStart && d.windowEnd && Number.isFinite(start) && Number.isFinite(end) && end <= start) {
    ctx.addIssue({ code: "custom", message: "End must be after start", path: ["windowEnd"] });
  }
});

export default function QuoteNew() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [pin, setPin] = useState<Pin | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", landmark: "", windowStart: "", windowEnd: "" },
  });

  useEffect(() => {
    api<{ categories: Category[] }>("/api/categories").then((d) => setCats(d.categories)).catch(() => {});
  }, []);

  async function submit(f: z.infer<typeof schema>) {
    setError("");
    try {
      await post("/api/quotes/requests", {
        ...f,
        categoryId: f.categoryId || undefined,
        windowStart: new Date(f.windowStart).toISOString(),
        windowEnd: new Date(f.windowEnd).toISOString(),
        photos: [],
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
      });
      navigate("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit request");
    }
  }

  return (
    <div className="fade-up">
      <PageHero eyebrow="Mode B · Complex jobs" title="Request a quote"
        body="Describe the job, verified pros propose fixed prices, you compare and pick. Your exact address stays hidden until you accept." />
      {role && role !== "customer" ? (
        <div className="wrap py-8">
          <Card className="mx-auto max-w-2xl p-6 text-center md:p-8">
            <p className="font-display text-xl font-semibold">Customers request here</p>
            <p className="mt-1.5 text-sm text-on-surface-variant">Staff and professional accounts can't request quotes. Sign in with a customer account to continue.</p>
          </Card>
        </div>
      ) : (
      <div className="wrap py-8">
        <Card className="mx-auto max-w-2xl p-6 md:p-8">
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <Field label="Category" hint="Pick the closest trade.">
              <Select {...form.register("categoryId")}>
                <option value="">General / unsure</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Job title" error={form.formState.errors.title?.message}>
              <TextField {...form.register("title")} placeholder="e.g. Repaint two bedrooms and repair ceiling cracks" />
            </Field>
            <Field label="Details" error={form.formState.errors.description?.message} hint="Scope, sizes, materials on site, access constraints.">
              <TextArea {...form.register("description")} placeholder="Room sizes, paint condition, parking for the team…" />
            </Field>
            <Field label="Ward & landmark (Damak only)" error={form.formState.errors.landmark?.message} hint="Pros see the ward, not your exact address, until you accept.">
              <TextField {...form.register("landmark")} placeholder="Damak-5, near Himal Chowk" />
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-semibold">Map pin (optional)</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setMapOpen(true)}>
                  <MapPin size={15} aria-hidden="true" /> {pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "Pin job location"}
                </Button>
                {pin && <Button type="button" variant="ghost" onClick={() => setPin(null)}>Clear</Button>}
              </div>
            </div>
            {mapOpen && (
              <MapPicker initial={pin} onClose={() => setMapOpen(false)}
                onConfirm={(p, label) => {
                  setPin(p);
                  setMapOpen(false);
                  const street = suggestStreet(label);
                  if (street) form.setValue("landmark", street, { shouldValidate: true, shouldDirty: true });
                }} />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred window start" error={form.formState.errors.windowStart?.message}>
                <TextField {...form.register("windowStart")} type="datetime-local" />
              </Field>
              <Field label="Preferred window end" error={form.formState.errors.windowEnd?.message}>
                <TextField {...form.register("windowEnd")} type="datetime-local" />
              </Field>
            </div>
            {error && <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">{error}</p>}
            <Button type="submit" className="w-full">Submit request</Button>
          </form>
        </Card>
      </div>
      )}
    </div>
  );
}
