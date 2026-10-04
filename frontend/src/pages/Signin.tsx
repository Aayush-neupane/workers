import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, BadgeCheck, CreditCard, Gift, ShieldCheck, Star, Wrench } from "lucide-react";
import { Button, Card, Field, TextField } from "../components/ui";
import { useAuth, homeFor } from "../lib/auth";

const schema = z.object({
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

function BrandPanel({ mode }: { mode: "signin" | "signup" }) {
  return (
    <div className="ring-band dotgrid-light flex h-full flex-col justify-between p-8 md:p-10">
      <p className="flex items-center gap-2 font-bold text-white">
        <span className="grid size-9 place-items-center rounded-lg bg-marigold-300 text-pine-950">
          <Wrench size={18} aria-hidden="true" />
        </span>
        <span className="font-display text-xl font-semibold">Sajilo Damak</span>
      </p>
      <div key={mode} className="fade-up">
        <p className="font-display text-3xl leading-tight font-semibold text-white md:text-4xl">
          {mode === "signin" ? "New to Damak's verified pros?" : "One of us already?"}
        </p>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/75">
          {mode === "signin"
            ? "Create a free account to book verified electricians, plumbers, cleaners and more — and earn rewards on every job."
            : "Sign back in to track bookings, manage addresses and spend your loyalty points."}
        </p>
        <Link
          to={mode === "signin" ? "/signup" : "/signin"}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
        >
          {mode === "signin" ? (
            <>Create account <ArrowRight size={15} aria-hidden="true" /></>
          ) : (
            <>Sign in <ArrowRight size={15} aria-hidden="true" /></>
          )}
        </Link>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-white/60">
        <ShieldCheck size={13} className="text-marigold-300" aria-hidden="true" />
        Invite-only pros · Damak wards 1–10 · Cash + online pay
      </p>
    </div>
  );
}

const TRUST = [
  { icon: ShieldCheck, t: "Verified pros", b: "Invite-only onboarding" },
  { icon: CreditCard, t: "Easy pay", b: "Cash · eSewa · Khalti" },
  { icon: Gift, t: "Rewards", b: "Points on every job" },
];

export default function Signin({ mode }: { mode: "signin" | "signup" }) {
  const { signIn, signUp, authError } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", password: "" },
  });

  async function submit(f: z.infer<typeof schema>) {
    if (signup) {
      if (!f.name || f.name.trim().length < 2) {
        form.setError("name", { message: "Enter your full name" });
        return;
      }
      if (!f.phone || f.phone.trim().length < 10) {
        form.setError("phone", { message: "Enter a valid phone number" });
        return;
      }
      if (!f.password || f.password.length < 8) {
        form.setError("password", { message: "Minimum 8 characters" });
        return;
      }
    }
    setBusy(true);
    const role =
      signup
        ? await signUp(f.name!.trim(), f.phone!.trim(), f.email, f.password)
        : await signIn(f.email, f.password);
    setBusy(false);
    if (role) navigate(homeFor(role), { replace: true });
  }

  return (
    <div className="wrap fade-up py-10 md:py-14">
      {/* Mobile brand strip */}
      <div className="ring-band mb-4 rounded-lg p-5 md:hidden">
        <p className="flex items-center gap-2 font-bold text-white">
          <span className="grid size-8 place-items-center rounded-md bg-marigold-300 text-pine-950">
            <Wrench size={16} aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-semibold">Sajilo Damak</span>
        </p>
        <p className="mt-2 text-sm text-white/75">
          {signup ? "Create your free account." : "Welcome back."}{" "}
          <Link to={signup ? "/signin" : "/signup"} className="font-bold text-marigold-300">
            {signup ? "Sign in instead" : "Create an account"}
          </Link>
        </p>
      </div>

      <Card className="elev-2 mx-auto grid max-w-4xl overflow-hidden md:grid-cols-2">
        <div className="flex flex-col p-7 md:p-10">
          <h1 className="font-display text-3xl font-semibold">{signup ? "Create account" : "Sign in"}</h1>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            {signup ? "Free forever. Book in under a minute." : "Track bookings, rewards and receipts."}
          </p>
          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(submit)}>
            {signup && (
              <>
                <Field label="Full name" error={form.formState.errors.name?.message}>
                  <TextField {...form.register("name")} placeholder="e.g. Gita Sharma" autoComplete="name" />
                </Field>
                <Field label="Phone" error={form.formState.errors.phone?.message}>
                  <TextField {...form.register("phone")} placeholder="9852600000" inputMode="tel" autoComplete="tel" />
                </Field>
              </>
            )}
            <Field label="Email" error={form.formState.errors.email?.message}>
              <TextField {...form.register("email")} type="email" placeholder="you@example.com" autoComplete="email" />
            </Field>
            <Field label="Password" error={form.formState.errors.password?.message}>
              <TextField {...form.register("password")} type="password"
                placeholder={signup ? "Minimum 8 characters" : "Your password"}
                autoComplete={signup ? "new-password" : "current-password"} />
            </Field>
            {signup && (
              <p className="text-xs leading-relaxed text-on-surface-variant">
                By creating an account you agree to the{" "}
                <Link to="/terms" className="font-semibold text-primary">Terms</Link> and{" "}
                <Link to="/privacy" className="font-semibold text-primary">Privacy Policy</Link>.
                Customer accounts only — pros join by admin invitation.
              </p>
            )}
            {authError && <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">{authError}</p>}
            <Button type="submit" className="w-full py-3" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </Button>
          </form>
          {!signup && (
            <p className="mt-4 text-center text-sm text-on-surface-variant">
              Just looking?{" "}
              <Link to="/services" className="font-bold text-primary">Browse services as guest</Link>
            </p>
          )}
          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-outline pt-5">
            {TRUST.map((f) => (
              <div key={f.t} className="text-center">
                <f.icon size={18} aria-hidden="true" className="mx-auto text-primary" />
                <p className="mt-1.5 text-xs font-bold">{f.t}</p>
                <p className="text-[11px] leading-snug text-on-surface-variant">{f.b}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-on-surface-variant">
            <Star size={13} aria-hidden="true" className="text-marigold-500" />
            Every review here comes from a completed job — no exceptions.
          </p>
        </div>
        <div className="hidden md:block">
          <BrandPanel mode={mode} />
        </div>
      </Card>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-on-surface-variant">
        <BadgeCheck size={13} aria-hidden="true" />
        Customers register freely · Worker accounts are created by admins and activated by invitation
      </p>
    </div>
  );
}
