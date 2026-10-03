import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Camera } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Price, Select, TextArea } from "../components/ui";
import { CATEGORIES, SERVICES } from "../data/mock";
import { nextBookingId, useStore } from "../lib/store";
import { earnPoints, redeemValue } from "../lib/booking";
import { formatNPR, formatSlot } from "../lib/format";
import type { PaymentMethod } from "../lib/types";

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

export default function Book() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addresses, bookings, addBooking, rewardBalance, spendPoints } = useStore();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const slots = useMemo(buildSlots, []);

  const service = SERVICES.find((s) => s.id === id);

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

  if (!service) {
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

  const category = CATEGORIES.find((c) => c.id === service.categoryId);
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

  const submit = handleSubmit((f) => {
    if (f.useRewards && canRedeem) spendPoints(100, "Discount on new booking");
    const bookingId = nextBookingId(bookings);
    addBooking({
      id: bookingId,
      serviceId: service.id,
      status: "pending",
      addressId: f.addressId,
      slot: f.slot,
      instructions: f.instructions,
      estimatePaisa: estimate,
      paymentMethod: f.paymentMethod,
      paymentStatus: f.paymentMethod === "cash" ? "unpaid" : "paid",
      commissionBps: category?.commissionBps ?? 1500,
      history: [{ status: "pending", at: new Date().toISOString(), by: "customer" }],
      createdAt: new Date().toISOString(),
    });
    navigate(`/book/confirm/${bookingId}`);
  });

  const address = addresses.find((a) => a.id === watch("addressId"));

  return (
    <div className="wrap fade-up max-w-3xl py-10">
      <Link to={`/services/${service.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        <ArrowLeft size={15} aria-hidden="true" /> {service.name}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Book: {service.name}</h1>

      <ol className="mt-6 flex gap-2" aria-label="Booking progress">
        {["Address", "Slot", "Details & pay", "Review"].map((label, i) => (
          <li key={label} className="flex-1" aria-current={i === step ? "step" : undefined}>
            <span
              className={`block rounded-md px-2 py-2 text-center text-xs font-semibold sm:text-sm ${
                i < step
                  ? "bg-success-container text-on-primary-container"
                  : i === step
                    ? "bg-primary text-white"
                    : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <Card className="mt-6 p-6">
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
            <legend className="mb-2 text-sm font-medium">Available slots (next 7 days)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Time slots">
              {slots.slice(0, 12).map((s) => (
                <label
                  key={s}
                  className={`cursor-pointer rounded-md border px-3 py-2.5 text-sm font-medium transition has-checked:border-primary has-checked:bg-primary-container ${
                    watch("slot") === s ? "border-primary bg-primary-container" : "border-outline"
                  }`}
                >
                  <input
                    type="radio"
                    value={s}
                    {...register("slot")}
                    className="sr-only"
                  />
                  {formatSlot(s)}
                </label>
              ))}
            </div>
            {errors.slot && (
              <p role="alert" className="mt-2 text-sm text-error">{errors.slot.message}</p>
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
              <span className="mb-1.5 block text-sm font-medium">Photos (optional)</span>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-outline bg-surface-container/50 px-4 py-3 text-sm">
                <Camera size={16} aria-hidden="true" />
                {photos.length === 0 ? "Attach photos of the issue" : `${photos.length} attached`}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) =>
                    setPhotos(Array.from(e.target.files ?? []).map((f) => f.name))
                  }
                />
              </label>
              <p className="mt-1 text-xs text-on-surface-variant">Demo: files stay on this device until the backend connects.</p>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Payment method</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(GATEWAY_LABEL) as PaymentMethod[]).map((m) => (
                  <label
                    key={m}
                    className={`cursor-pointer rounded-md border p-3 text-sm transition has-checked:border-primary has-checked:bg-primary-container ${
                      paymentMethod === m ? "border-primary bg-primary-container" : "border-outline"
                    }`}
                  >
                    <input type="radio" value={m} {...register("paymentMethod")} className="sr-only" />
                    <span className="block font-bold">{GATEWAY_LABEL[m]}</span>
                    <span className="text-xs text-on-surface-variant">
                      {m === "cash" ? "Pay the pro directly" : "Sandbox-verified online"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-outline p-3 text-sm">
              <input
                type="checkbox"
                {...register("useRewards")}
                disabled={!canRedeem}
                className="mt-0.5 size-4 accent-[#166b4d]"
              />
              <span>
                <span className="font-bold">Redeem 100 points for Rs 50 off</span>
                <span className="block text-xs text-on-surface-variant">
                  {canRedeem
                    ? `Balance: ${rewardBalance} points.`
                    : `You have ${rewardBalance} points — 100 needed.`}
                </span>
              </span>
            </label>
          </div>
        )}

        {step === 3 && (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Service</dt><dd className="font-semibold">{service.name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Address</dt><dd className="text-right font-semibold">{address ? `${address.line}, ${address.city}` : "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Slot</dt><dd className="font-semibold">{watch("slot") ? formatSlot(watch("slot")) : "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Payment</dt><dd className="font-semibold">{GATEWAY_LABEL[paymentMethod]}</dd></div>
            <div className="flex justify-between gap-4 border-t border-outline pt-3"><dt className="text-on-surface-variant">Estimate</dt><dd><Price paisa={estimate} /></dd></div>
            {discount > 0 && (
              <div className="flex justify-between gap-4 text-success"><dt>Rewards discount</dt><dd>−{formatNPR(discount)}</dd></div>
            )}
            <div className="flex justify-between gap-4 border-t border-outline pt-3 text-base"><dt className="font-bold">Total due</dt><dd className="font-bold"><Price paisa={total} /></dd></div>
            <p className="rounded-md bg-surface-container p-3 text-xs text-on-surface-variant">
              {paymentMethod === "cash"
                ? "Pay in cash when the job completes. The platform commission is tracked separately for settlement."
                : "Demo checkout: the gateway sandbox verifies instantly and a transaction reference is recorded. Frontend success is never trusted — verification is simulated server-side."}{" "}
              You&apos;ll earn ~{earnPoints(total)} loyalty points on completion.
            </p>
          </dl>
        )}

        <div className="mt-6 flex justify-between gap-3">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
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

      <p className="mt-4 text-center text-xs text-on-surface-variant">
        <Badge tone="info">Estimate, not final</Badge> The pro confirms the final amount with you before closing the job.
      </p>
    </div>
  );
}
