import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Camera, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, PageHero, Price, Select, TextArea } from "../components/ui";
import { api, toService } from "../lib/api";
import { useStore } from "../lib/store";
import { earnPoints, redeemValue } from "../lib/booking";
import { formatNPR, formatSlot } from "../lib/format";
import type { PaymentMethod, Service } from "../lib/types";

const schema = z.object({
  addressId: z.string().min(1, "Choose a service address"),
  slot: z.string().min(1, "Pick a time slot"),
  instructions: z.string().trim().min(10, "Describe the job in at least 10 characters"),
  paymentMethod: z.enum(["cash", "esewa", "khalti"]),
  useRewards: z.boolean(),
});

type Form = z.infer<typeof schema>;

const WINDOWS = ["09:00", "11:00", "14:00", "16:00"];

function buildSlots(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let d = 1; d <= 7; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    for (const w of WINDOWS) {
      const [h, m] = w.split(":").map(Number);
      const s = new Date(day);
      s.setHours(h, m, 0, 0);
      out.push(s.toISOString());
    }
  }
  return out;
}

const GATEWAY_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  esewa: "eSewa",
  khalti: "Khalti",
};

const STEP_NAMES = ["Address", "Slot", "Details & pay", "Review"];

export default function Book() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addresses, providers, addBooking, rewardBalance } = useStore();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [missing, setMissing] = useState(false);
  const slots = useMemo(buildSlots, []);

  useEffect(() => {
    let live = true;
    api<{ service: unknown }>(`/api/services/${id}`)
      .then((d) => {
        if (live) setService(toService(d.service as Parameters<typeof toService>[0]));
      })
      .catch(() => {
        if (live) setMissing(true);
      });
    return () => {
      live = false;
    };
  }, [id]);

  const {
    register,
    trigger,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      addressId: addresses[0]?.id ?? "",
      slot: "",
      instructions: "",
      paymentMethod: "cash",
      useRewards: false,
    },
  });

  if (missing) {
    return (
      <div className="wrap py-12">
        <EmptyState
          title="Service not found"
          body="Pick a service from the directory to start a booking."
          action={<Link to="/services"><Button>Browse services</Button></Link>}
        />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="wrap py-12" role="status">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-1/2 rounded bg-surface-container-high" />
          <div className="h-4 w-full rounded bg-surface-container" />
        </div>
      </div>
    );
  }

  const paymentMethod = watch("paymentMethod");
  const useRewards = watch("useRewards");
  const canRedeem = rewardBalance >= 100;
  const discount = useRewards && canRedeem ? redeemValue(100) : 0;
  const estimate = service.basePricePaisa;
  const total = Math.max(0, estimate - discount);

  const stepFields: (keyof Form)[][] = [
    ["addressId"],
    ["slot"],
    ["instructions", "paymentMethod"],
    [],
  ];

  async function next() {
    const ok = await trigger(stepFields[step]);
    if (ok) setStep((s) => Math.min(s + 1, 3));
  }

  const submit = handleSubmit(async (f) => {
    setSubmitError("");
    try {
      const out = await addBooking({
        serviceId: service.id,
        addressId: f.addressId || undefined,
        slot: f.slot,
        instructions: f.instructions,
        paymentMethod: f.paymentMethod,
        useRewards: f.useRewards && canRedeem,
      });
      navigate(`/book/confirm/${out.bookingNo}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Booking failed");
    }
  });

  const address = addresses.find((a) => a.id === watch("addressId"));
  const slot = watch("slot");

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Booking"
        title={`Book: ${service.name}`}
        body="Four quick steps. The price you see is an estimate — the final amount is confirmed with you before the job closes."
      />

      <div className="wrap py-8">
        <Link to={`/services/${service.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-primary">
          <ArrowLeft size={15} aria-hidden="true" /> Back to {service.name}
        </Link>

        <ol className="mt-5 flex gap-1.5 sm:gap-2" aria-label="Booking progress">
          {STEP_NAMES.map((label, i) => (
            <li key={label} className="flex-1" aria-current={i === step ? "step" : undefined}>
              <span
                className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-bold sm:text-sm ${
                  i < step
                    ? "bg-success-container text-on-primary-container"
                    : i === step
                      ? "bg-pine-950 text-white"
                      : "bg-surface-container text-on-surface-variant"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-5 place-items-center rounded-full text-[11px] ${
                    i <= step ? "bg-marigold-300 text-pine-950" : "bg-white/60 text-on-surface-variant"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <Card className="p-6 md:p-7">
            {step === 0 && (
              <Field label="Service address" error={errors.addressId?.message}>
                <Select {...register("addressId")}>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.line}, {a.city}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {step === 1 && (
              <fieldset>
                <legend className="mb-2.5 text-sm font-semibold">Available slots (next 7 days)</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Time slots">
                  {slots.slice(0, 12).map((s) => (
                    <label
                      key={s}
                      className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm font-bold transition active:scale-95 ${
                        slot === s ? "border-pine-950 bg-pine-950 text-white" : "border-outline hover:border-pine-800"
                      }`}
                    >
                      <input type="radio" value={s} {...register("slot")} className="sr-only" />
                      {formatSlot(s)}
                    </label>
                  ))}
                </div>
                {errors.slot && (
                  <p role="alert" className="mt-2 text-sm font-medium text-error">{errors.slot.message}</p>
                )}
                <p className="mt-2 text-xs text-on-surface-variant">Showing first 12 of {slots.length} open windows.</p>
              </fieldset>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <Field label="Job details" error={errors.instructions?.message} hint="Access notes, symptoms, parking — anything the pro should know.">
                  <TextArea {...register("instructions")} placeholder="e.g. Kitchen mixer drips constantly, need washer replaced…" />
                </Field>
                <div>
                  <span className="mb-1.5 block text-sm font-semibold">Photos (optional)</span>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-outline bg-surface-container/50 px-4 py-3.5 text-sm font-medium transition hover:border-primary">
                    <Camera size={16} aria-hidden="true" />
                    {photos.length === 0 ? "Attach photos of the issue" : `${photos.length} attached`}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => setPhotos(Array.from(e.target.files ?? []).map((f) => f.name))}
                    />
                  </label>
                  <p className="mt-1 text-xs text-on-surface-variant">Demo: files stay on this device until the backend connects.</p>
                </div>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Payment method</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(Object.keys(GATEWAY_LABEL) as PaymentMethod[]).map((m) => {
                      const available = m === "cash" || providers[m as "esewa" | "khalti"];
                      return (
                        <label
                          key={m}
                          className={`rounded-lg border p-3.5 text-sm transition active:scale-[0.98] ${
                            available ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                          } ${
                            paymentMethod === m ? "border-pine-950 bg-primary-container" : "border-outline hover:border-pine-800"
                          }`}
                        >
                          <input type="radio" value={m} {...register("paymentMethod")} className="sr-only" disabled={!available} />
                          <span className="block font-bold">{GATEWAY_LABEL[m]}</span>
                          <span className="text-xs text-on-surface-variant">
                            {m === "cash"
                              ? "Pay the pro directly"
                              : available
                                ? "Online — verified server-side"
                                : "Not configured yet"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-outline p-3.5 text-sm transition hover:border-primary">
                  <input
                    type="checkbox"
                    {...register("useRewards")}
                    disabled={!canRedeem}
                    className="mt-0.5 size-4 accent-[#0f6b44]"
                  />
                  <span>
                    <span className="font-bold">Redeem 100 points for Rs 50 off</span>
                    <span className="block text-xs text-on-surface-variant">
                      {canRedeem ? `Balance: ${rewardBalance} points.` : `You have ${rewardBalance} points — 100 needed.`}
                    </span>
                  </span>
                </label>
              </div>
            )}

            {step === 3 && (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Address</dt><dd className="text-right font-semibold">{address ? `${address.line}, ${address.city}` : "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Slot</dt><dd className="font-semibold">{slot ? formatSlot(slot) : "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Payment</dt><dd className="font-semibold">{GATEWAY_LABEL[paymentMethod]}</dd></div>
                <div className="flex justify-between gap-4 border-t border-outline pt-3"><dt className="text-on-surface-variant">Estimate</dt><dd><Price paisa={estimate} /></dd></div>
                {discount > 0 && (
                  <div className="flex justify-between gap-4 font-semibold text-success"><dt>Rewards discount</dt><dd>−{formatNPR(discount)}</dd></div>
                )}
                <div className="flex justify-between gap-4 border-t border-outline pt-3 text-base"><dt className="font-bold">Total due</dt><dd className="font-bold"><Price paisa={total} /></dd></div>
                <p className="rounded-md bg-surface-container p-3.5 text-xs leading-relaxed text-on-surface-variant">
                  {paymentMethod === "cash"
                    ? "Pay in cash when the job completes. The platform commission is tracked separately for settlement."
                    : "Demo checkout: the gateway sandbox verifies instantly and a transaction reference is recorded. Frontend success is never trusted — verification is simulated server-side."}{" "}
                  You&apos;ll earn ~{earnPoints(total)} loyalty points on completion.
                </p>
              </dl>
            )}

            {submitError && (
              <p role="alert" className="mt-4 rounded-md bg-error-container p-3 text-sm font-medium text-error">
                {submitError}
              </p>
            )}
            <div className="mt-7 flex justify-between gap-3 border-t border-outline pt-5">              <Button variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
                <ArrowLeft size={15} aria-hidden="true" /> Back
              </Button>
              {step < 3 ? (
                <Button onClick={next}>
                  Continue <ArrowRight size={15} aria-hidden="true" />
                </Button>
              ) : (
                <Button onClick={submit}>Confirm booking</Button>
              )}
            </div>
          </Card>

          <aside className="lg:sticky lg:top-32">
            <Card className="elev-2 overflow-hidden">
              <div className="bg-pine-950 px-5 py-4">
                <p className="text-xs font-extrabold tracking-[0.14em] text-marigold-300 uppercase">Order summary</p>
                <p className="font-display mt-1 text-xl leading-snug font-semibold text-white">{service.name}</p>
              </div>
              <dl className="space-y-2.5 p-5 text-sm">
                <div className="flex justify-between"><dt className="text-on-surface-variant">Estimate</dt><dd><Price paisa={estimate} /></dd></div>
                {discount > 0 && <div className="flex justify-between font-semibold text-success"><dt>Rewards</dt><dd>−{formatNPR(discount)}</dd></div>}
                <div className="flex justify-between border-t border-outline pt-2.5 text-base"><dt className="font-bold">Total</dt><dd className="font-bold"><Price paisa={total} /></dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Slot</dt><dd className="font-semibold">{slot ? formatSlot(slot) : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Pay via</dt><dd className="font-semibold">{GATEWAY_LABEL[paymentMethod]}</dd></div>
              </dl>
              <p className="mx-5 mb-5 flex items-start gap-1.5 rounded-md bg-success-container p-3 text-xs leading-relaxed text-on-primary-container">
                <ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                Estimate, not final — the pro confirms the amount with you before closing.
              </p>
            </Card>
          </aside>
        </div>

        <p className="mt-5 text-center text-xs text-on-surface-variant">
          <Badge tone="info">Free cancellation</Badge> before worker confirmation, always.
        </p>
      </div>
    </div>
  );
}
