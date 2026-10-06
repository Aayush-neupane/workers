import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, ShieldCheck, MapPin } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, PageHero, Price, Select, TextArea, TextField } from "../components/ui";
import { MapPicker } from "../components/MapPicker";
import { MiniMap } from "../components/MiniMap";
import { api, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatSlot } from "../lib/format";
import { DAMAK_CENTER, geocodeArea, suggestStreet } from "../lib/geo";
import type { Pin } from "../lib/geo";
import type { Address, Service } from "../lib/types";

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

export default function Book() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [providers, setProviders] = useState({ esewa: false, khalti: false });
  const [rewardBalance, setRewardBalance] = useState(0);
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [service, setService] = useState<Service | null>(null);
  const [missing, setMissing] = useState(false);
  const [line, setLine] = useState("");
  const [phone, setPhone] = useState("");
  const [addrError, setAddrError] = useState("");
  const [bookingPin, setBookingPin] = useState<Pin | null>(null);
  const [bookingMapOpen, setBookingMapOpen] = useState(false);
  const [approx, setApprox] = useState<Pin | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const slots = useMemo(buildSlots, []);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of slots) {
      const day = new Date(s).toDateString();
      const list = map.get(day);
      if (list) list.push(s);
      else map.set(day, [s]);
    }
    return [...map.entries()];
  }, [slots]);
  const visibleDays = showAllSlots ? groupedSlots : groupedSlots.slice(0, 3);

  useEffect(() => {
    api<{ service: Service }>(`/api/services/${id}`)
      .then((d) => setService(d.service))
      .catch(() => setMissing(true));
    reloadAddresses();
    api<{ cash: boolean; esewa: boolean; khalti: boolean }>("/api/payments/providers")
      .then((d) => setProviders({ esewa: d.esewa, khalti: d.khalti })).catch(() => {});
    api<{ balance: number }>("/api/rewards/mine").then((d) => setRewardBalance(d.balance)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { register, trigger, watch, setValue, getValues, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { addressId: "", slot: "", instructions: "", paymentMethod: "cash", useRewards: false },
  });

  function reloadAddresses() {
    api<{ addresses: Address[] }>("/api/addresses").then((d) => {
      setAddresses(d.addresses);
      if (d.addresses.length > 0 && !getValues("addressId")) setValue("addressId", d.addresses[0].id);
    }).catch(() => {});
  }

  const addressId = watch("addressId");

  // Approximate map area from the address text when nobody pinned it yet,
  // so checkout shows YOUR area instead of a generic Damak view.
  useEffect(() => {
    setApprox(null);
    const addr = addresses.find((a) => a.id === addressId);
    if (!addr || addr.lat != null || bookingPin) {
      setLocating(false);
      return;
    }
    setLocating(true);
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setApprox(await geocodeArea(addr.line, ctrl.signal));
      } catch {
        /* offline — Damak overview stays */
      } finally {
        setLocating(false);
      }
    }, 600);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [addresses, addressId, bookingPin]);

  async function saveQuickAddress() {
    setAddrError("");
    if (line.trim().length < 5) { setAddrError("Enter ward, street and house (e.g. Damak-5, Himal Chowk)."); return; }
    if (phone.trim().length < 10) { setAddrError("Enter a valid phone number."); return; }
    try {
      const out = await post<{ address: Address }>("/api/addresses", {
        label: "Home", line: line.trim(), city: "Damak", phone: phone.trim(),
        lat: bookingPin?.lat ?? null, lng: bookingPin?.lng ?? null,
      });
      setAddresses((a) => [...a, out.address]);
      setValue("addressId", out.address.id);
      setStep(1);
    } catch (e) {
      setAddrError(e instanceof Error ? e.message : "Could not save address");
    }
  }

  if (missing) {
    return <div className="wrap py-12"><EmptyState title="Service not found" body="Pick a service from the directory to start a booking." /></div>;
  }
  // Ordering is for customer accounts — staff and pros use their own portals.
  if (role && role !== "customer") {
    return (
      <div className="wrap py-12">
        <EmptyState
          title="Customers order here"
          body="Staff and professional accounts can't place orders. Sign in with a customer account to book this service."
        />
      </div>
    );
  }
  if (!service) return <p role="status" className="wrap py-12 text-center text-on-surface-variant">Loading…</p>;

  const paymentMethod = watch("paymentMethod");
  const useRewards = watch("useRewards");
  const canRedeem = rewardBalance >= 100;
  const discount = useRewards && canRedeem ? 5000 : 0;
  const estimate = service.base_price_paisa;
  const total = Math.max(0, estimate - discount);
  const address = addresses.find((a) => a.id === watch("addressId"));
  const slot = watch("slot");

  const stepFields: (keyof Form)[][] = [["addressId"], ["slot"], ["instructions", "paymentMethod"], []];
  async function next() {
    if (await trigger(stepFields[step])) setStep((s) => Math.min(s + 1, 3));
  }

  const submit = handleSubmit(async (f) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const out = await post<{ bookingNo: string }>("/api/bookings", {
        serviceId: service.id, addressId: f.addressId || undefined, slot: f.slot,
        instructions: f.instructions, paymentMethod: f.paymentMethod, useRewards: f.useRewards && canRedeem,
        lat: bookingPin?.lat ?? null, lng: bookingPin?.lng ?? null,
      });
      navigate(`/track/${out.bookingNo}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="fade-up">
      <PageHero eyebrow="Booking" title={`Book: ${service.name}`}
        body="Four quick steps. Damak wards 1–10 only — addresses outside our boundary are declined with an explanation." />
      <div className="wrap py-8">
        <Link to={`/services/${service.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-primary">
          <ArrowLeft size={15} aria-hidden="true" /> Back to {service.name}
        </Link>
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <Card className="p-6 md:p-7">
            {step === 0 && addresses.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-on-surface-variant">No saved addresses yet — add your Damak address to continue.</p>
                <Field label="Ward, street & house">
                  <TextField value={line} onChange={(e) => setLine(e.target.value)} placeholder="Damak-5, Himal Chowk, House 12" />
                </Field>
                <Field label="Phone">
                  <TextField value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="9852600000" />
                </Field>
                {addrError && <p role="alert" className="text-sm font-medium text-error">{addrError}</p>}
                <Button onClick={saveQuickAddress}>Save & continue</Button>
              </div>
            ) : step === 0 ? (
              <>
                <Field label="Service address (Damak only)" error={errors.addressId?.message}>
                  <Select {...register("addressId")}>
                    {addresses.map((a) => (
                      <option key={a.id} value={a.id}>{a.label} — {a.line}, {a.city}{a.ward ? ` (Ward ${a.ward})` : ""}</option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}
            {step === 0 && (
              <div className="mt-5 rounded-lg border border-outline/60 bg-surface-container/40 p-4">
                <p className="flex items-center gap-1.5 text-sm font-extrabold">
                  <MapPin size={15} aria-hidden="true" /> Job location on map
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {bookingPin
                    ? "Pinned for this booking — the pro navigates here."
                    : addresses.length === 0
                      ? "Drop a pin now — it saves with your address and guides the pro."
                      : address?.lat != null
                        ? "Using your saved address pin — adjust it for this job if needed."
                        : approx
                          ? "Approximate area from your address — drop a pin to pinpoint it."
                          : locating
                            ? "Locating your area…"
                            : "Showing Damak — drop a pin to pinpoint your exact spot."}
                </p>
                {bookingPin && (
                  <p className="mt-2 rounded-md bg-success-container/60 p-2.5 text-xs font-semibold text-on-primary-container">
                    Pinned — address box filled from the map. Edit it freely above.
                  </p>
                )}
                <div className="mt-2.5">
                  <MiniMap
                    pin={bookingPin ?? (address?.lat != null && address?.lng != null
                      ? { lat: address.lat, lng: address.lng }
                      : approx ?? DAMAK_CENTER)}
                    center={bookingPin ?? (address?.lat != null && address?.lng != null
                      ? undefined
                      : (approx ?? DAMAK_CENTER))}
                    zoom={bookingPin != null || address?.lat != null ? 16 : 14}
                    marker={bookingPin != null || address?.lat != null}
                    height={170}
                  />
                </div>
                <div className="mt-2.5 flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setBookingMapOpen(true)}>
                    {bookingPin ? "Move pin" : "Drop a pin"}
                  </Button>
                  {bookingPin && (
                    <Button type="button" variant="ghost" onClick={() => setBookingPin(null)}>Use address pin</Button>
                  )}
                </div>
              </div>
            )}
            {bookingMapOpen && (
              <MapPicker
                initial={bookingPin ?? (address?.lat != null && address?.lng != null
                  ? { lat: address.lat, lng: address.lng }
                  : DAMAK_CENTER)}
                onClose={() => setBookingMapOpen(false)}
                onConfirm={(p, label) => {
                  setBookingPin(p);
                  setBookingMapOpen(false);
                  // Autofill the quick address box from the pin — editable after.
                  if (addresses.length === 0) {
                    const street = suggestStreet(label);
                    if (street) setLine(street);
                  }
                }}
              />
            )}
            {step === 1 && (
              <fieldset>
                <legend className="mb-2.5 text-sm font-semibold">Available slots (next 7 days)</legend>
                <div className="space-y-4">
                  {visibleDays.map(([day, daySlots]) => (
                    <div key={day}>
                      <p className="mb-1.5 text-xs font-extrabold tracking-wide text-on-surface-variant uppercase">
                        {new Date(daySlots[0]).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Time slots">
                        {daySlots.map((s) => (
                          <label key={s} className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm font-bold transition active:scale-95 ${slot === s ? "border-pine-950 bg-pine-950 text-white" : "border-outline hover:border-pine-800"}`}>
                            <input type="radio" value={s} {...register("slot")} className="sr-only" />
                            {formatSlot(s)}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {groupedSlots.length > visibleDays.length && (
                  <Button type="button" variant="ghost" className="mt-3" onClick={() => setShowAllSlots(true)}>
                    Show all ({slots.length} slots)
                  </Button>
                )}
                {showAllSlots && (
                  <Button type="button" variant="ghost" className="mt-3" onClick={() => setShowAllSlots(false)}>
                    Show fewer
                  </Button>
                )}
                {errors.slot && <p role="alert" className="mt-2 text-sm font-medium text-error">{errors.slot.message}</p>}
              </fieldset>
            )}
            {step === 2 && (
              <div className="space-y-5">
                <Field label="Job details" error={errors.instructions?.message} hint="Symptoms, access notes, parking — anything the pro should know.">
                  <TextArea {...register("instructions")} placeholder="e.g. Kitchen mixer drips constantly, need washer replaced…" />
                </Field>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Payment method</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["cash", "esewa", "khalti"] as const).map((m) => {
                      const available = m === "cash" || providers[m];
                      return (
                        <label key={m} className={`rounded-lg border p-3.5 text-sm transition ${available ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${paymentMethod === m ? "border-pine-950 bg-primary-container" : "border-outline hover:border-pine-800"}`}>
                          <input type="radio" value={m} {...register("paymentMethod")} className="sr-only" disabled={!available} />
                          <span className="block font-bold capitalize">{m === "cash" ? "Cash" : m}</span>
                          <span className="text-xs text-on-surface-variant">{m === "cash" ? "Pay the pro directly" : available ? "Online — verified server-side" : "Not configured yet"}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-outline p-3.5 text-sm">
                  <input type="checkbox" {...register("useRewards")} disabled={!canRedeem} className="mt-0.5 size-4 accent-[#0f6b44]" />
                  <span><span className="font-bold">Redeem 100 points for Rs 50 off</span>
                  <span className="block text-xs text-on-surface-variant">{canRedeem ? `Balance: ${rewardBalance} points.` : `You have ${rewardBalance} points — 100 needed.`}</span></span>
                </label>
              </div>
            )}
            {step === 3 && (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Address</dt><dd className="text-right font-semibold">{address ? `${address.line}, ${address.city}` : "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Slot</dt><dd className="font-semibold">{slot ? formatSlot(slot) : "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-on-surface-variant">Payment</dt><dd className="font-semibold capitalize">{paymentMethod}</dd></div>
                <div className="flex justify-between gap-4 border-t border-outline pt-3"><dt className="text-on-surface-variant">Estimate</dt><dd><Price paisa={estimate} /></dd></div>
                {discount > 0 && <div className="flex justify-between gap-4 font-semibold text-success"><dt>Rewards discount</dt><dd>−Rs {discount / 100}</dd></div>}
                <div className="flex justify-between gap-4 border-t border-outline pt-3 text-base"><dt className="font-bold">Total due</dt><dd className="font-bold"><Price paisa={total} /></dd></div>
                <div className="pt-1">
                  <MiniMap
                    pin={bookingPin ?? (address?.lat != null && address?.lng != null
                      ? { lat: address.lat, lng: address.lng }
                      : DAMAK_CENTER)}
                    marker={bookingPin != null || address?.lat != null}
                    height={150}
                  />
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {bookingPin ? "Booking pin set — the pro navigates here." : "Address location preview."}
                  </p>
                </div>
              </dl>
            )}
            {submitError && <p role="alert" className="mt-4 rounded-md bg-error-container p-3 text-sm font-medium text-error">{submitError}</p>}
            <div className="mt-7 flex justify-between gap-3 border-t border-outline pt-5">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
                <ArrowLeft size={15} aria-hidden="true" /> Back
              </Button>
              {step < 3 ? (
                <Button onClick={next} disabled={submitting} aria-busy={submitting}>Continue <ArrowRight size={15} aria-hidden="true" /></Button>
              ) : (
                <Button onClick={submit} disabled={submitting} aria-busy={submitting}>{submitting ? "Booking…" : "Confirm booking"}</Button>
              )}
            </div>
          </Card>
          <aside className="lg:sticky lg:top-32">
            <Card className="elev-2 overflow-hidden">
              <div className="bg-pine-950 px-5 py-4">
                <p className="text-xs font-extrabold tracking-[0.14em] text-marigold-300 uppercase">Order summary</p>
                <p className="font-display mt-1 text-xl font-semibold text-white">{service.name}</p>
              </div>
              <dl className="space-y-2.5 p-5 text-sm">
                <div className="flex justify-between"><dt className="text-on-surface-variant">Estimate</dt><dd><Price paisa={estimate} /></dd></div>
                <div className="flex justify-between border-t border-outline pt-2.5 text-base"><dt className="font-bold">Total</dt><dd className="font-bold"><Price paisa={total} /></dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Slot</dt><dd className="font-semibold">{slot ? formatSlot(slot) : "—"}</dd></div>
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
