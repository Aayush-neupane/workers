import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, FlaskConical, MapPin } from "lucide-react";
import { Button, Card, Field, TextField } from "../components/ui";
import { useAuth, homeFor } from "../lib/auth";

const signinSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

const signupSchema = signinSchema.extend({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().trim().min(10, "Enter a valid phone number").max(20),
  terms: z.boolean(),
  referralCode: z.string().trim().max(20).optional(),
});

/** Demo logins — local seed data only, never shown in production builds. */
const DEMO_ACCOUNTS = [
  { label: "Client", email: "gita@demo.local", password: "Demo1234!", to: "/dashboard" },
  { label: "Professional", email: "bijay@demo.local", password: "Demo1234!", to: "/worker" },
  { label: "Admin", email: "admin@sajilo.local", password: "ChangeMe123!", to: "/admin" },
];

function CoverContent({ mode }: { mode: "signin" | "signup" }) {
  return (
    <div key={mode} className="fade-up flex h-full flex-col p-8 md:p-10">
      <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold tracking-[0.14em] text-marigold-300 uppercase">
        <MapPin size={12} aria-hidden="true" /> सजिलो दमक · Wards 1–10
      </p>
      <div className="mt-auto mb-auto pt-8">
        <p className="font-display text-3xl leading-tight font-semibold text-white md:text-[2.6rem] md:leading-[1.1]">
          {mode === "signin" ? "First time here?" : "Welcome back."}
        </p>
        <p className="font-display mt-2 text-lg text-marigold-300 italic">Ramro Sewa, Sajilo Jeevan.</p>
        <ul className="mt-6 space-y-3 text-sm text-white/85">
          {[
            "Pros join by invitation only — never self-registered",
            "Every job closes with your one-time code",
            "Loyalty points on each completed booking",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-marigold-300 text-pine-950" aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
              {t}
            </li>
          ))}
        </ul>
        <Link
          to={mode === "signin" ? "/signup" : "/signin"}
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-marigold-300 px-5 py-2.5 text-sm font-extrabold text-pine-950 transition hover:brightness-105 active:scale-[0.98]"
        >
          {mode === "signin" ? (
            <>Create free account <ArrowRight size={15} aria-hidden="true" /></>
          ) : (
            <><ArrowLeft size={15} aria-hidden="true" /> Back to sign in</>
          )}
        </Link>
      </div>
      <p className="text-xs leading-relaxed text-white/70">
        Damak-5, Himal Chowk · Sun–Sat · Cash, eSewa & Khalti where configured
      </p>
    </div>
  );
}

export default function Signin({ mode }: { mode: "signin" | "signup" }) {
  const { signIn, signUp, authError } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  const loginForm = useForm<z.infer<typeof signinSchema>>({
    resolver: zodResolver(signinSchema),
    defaultValues: { email: "", password: "" },
  });
  const joinForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", phone: "", email: "", password: "", terms: false, referralCode: "" },
  });

  async function doLogin(f: z.infer<typeof signinSchema>) {
    setBusy(true);
    const role = await signIn(f.email, f.password);
    setBusy(false);
    if (role) navigate(homeFor(role), { replace: true });
  }

  async function doSignup(f: z.infer<typeof signupSchema>) {
    if (!f.terms) {
      joinForm.setError("terms", { message: "Please accept the Terms and Privacy Policy to continue." });
      return;
    }
    setBusy(true);
    const role = await signUp(f.name.trim(), f.phone.trim(), f.email, f.password, f.referralCode?.trim() || undefined);
    setBusy(false);
    if (role) navigate(homeFor(role), { replace: true });
  }

  function fillDemo(email: string, password: string) {
    loginForm.setValue("email", email);
    loginForm.setValue("password", password);
    joinForm.setValue("email", email);
    joinForm.setValue("password", password);
  }

  return (
    <div className="wrap fade-up py-10 md:py-14">
      {/* Mobile switch strip */}
      <div className="ring-band mb-4 flex items-center justify-between rounded-lg p-5 md:hidden">
        <div>
          <p className="font-display text-lg font-semibold text-white">{signup ? "Create account" : "Welcome back"}</p>
          <p className="text-sm text-white/70">{signup ? "Free forever. Book in minutes." : "Sign in to continue."}</p>
        </div>
        <Link to={signup ? "/signin" : "/signup"} className="rounded-lg bg-marigold-300 px-4 py-2 text-sm font-extrabold text-pine-950">
          {signup ? "Sign in" : "Join"}
        </Link>
      </div>

      <Card className="elev-2 relative mx-auto max-w-4xl overflow-hidden md:min-h-[620px]">
        <div className="grid md:grid-cols-2">
          {/* Left cell — sign in (same size as right) */}
          <div className={`${signup ? "hidden md:flex" : "flex"} flex-col p-7 md:p-10`}>
            <h1 className="font-display text-3xl font-semibold">Sign in</h1>
            <p className="mt-1.5 text-sm text-on-surface-variant">Bookings, rewards and receipts await.</p>
            <form className="mt-6 flex-1 space-y-4" onSubmit={loginForm.handleSubmit(doLogin)}>
              <Field label="Email" error={loginForm.formState.errors.email?.message}>
                <TextField {...loginForm.register("email")} type="email" placeholder="you@example.com" autoComplete="email" />
              </Field>
              <Field label="Password" error={loginForm.formState.errors.password?.message}>
                <TextField {...loginForm.register("password")} type="password" autoComplete="current-password" />
              </Field>
              {!signup && authError && (
                <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">{authError}</p>
              )}
              <Button type="submit" className="w-full py-3" disabled={busy}>
                {busy && !signup ? "Please wait…" : "Sign in"}
              </Button>
            </form>
            <div className="mt-4 rounded-md border border-dashed border-outline bg-surface-container/50 p-3">
              <p className="text-[11px] font-extrabold tracking-widest text-on-surface-variant uppercase">Quick demo access — tap to fill</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {[
                  { label: "Client", email: "gita@demo.local", password: "Demo1234!" },
                  { label: "Pro", email: "bijay@demo.local", password: "Demo1234!" },
                  { label: "Admin", email: "admin@sajilo.local", password: "ChangeMe123!" },
                ].map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => {
                      loginForm.setValue("email", a.email);
                      loginForm.setValue("password", a.password);
                    }}
                    className="rounded-md border border-outline bg-white px-2 py-2 text-xs font-extrabold transition hover:border-primary active:scale-[0.97]"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-4 space-y-2 border-t border-outline pt-4 text-[13px] text-on-surface-variant">
              {[
                "Live tracking from request to completion code",
                "OTP-secured closing — no code, no completion",
                "Loyalty points on every completed job",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-center text-sm text-on-surface-variant md:hidden">
              New here? <Link to="/signup" className="font-bold text-primary">Create an account</Link>
            </p>
            <p className="mt-1 hidden text-center text-sm text-on-surface-variant md:block">
              Just looking? <Link to="/services" className="font-bold text-primary">Browse services as guest</Link>
            </p>
          </div>

          {/* Right cell — create account (same size as left) */}
          <div className="hidden flex-col p-7 md:flex md:p-10">
            <h1 className="font-display text-3xl font-semibold">Create account</h1>
            <p className="mt-1.5 text-sm text-on-surface-variant">Free forever. Book in under a minute.</p>
            <form className="mt-6 flex-1 space-y-4" onSubmit={joinForm.handleSubmit(doSignup)}>
              <Field label="Full name" error={joinForm.formState.errors.name?.message}>
                <TextField {...joinForm.register("name")} placeholder="e.g. Gita Sharma" autoComplete="name" />
              </Field>
              <Field label="Phone" error={joinForm.formState.errors.phone?.message}>
                <TextField {...joinForm.register("phone")} placeholder="9852600000" inputMode="tel" autoComplete="tel" />
              </Field>
              <Field label="Email" error={joinForm.formState.errors.email?.message}>
                <TextField {...joinForm.register("email")} type="email" placeholder="you@example.com" autoComplete="email" />
              </Field>
              <Field label="Password" error={joinForm.formState.errors.password?.message}>
                <TextField {...joinForm.register("password")} type="password" placeholder="Minimum 8 characters" autoComplete="new-password" />
              </Field>
              <Field label="Referral code (optional)" hint="Invited by a friend? You both earn bonus points on your first job.">
                <TextField {...joinForm.register("referralCode")} placeholder="e.g. GITA-4F8K2Q" className="uppercase" />
              </Field>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-outline p-3 text-[13px] leading-relaxed">
                <input type="checkbox" {...joinForm.register("terms")} className="mt-0.5 size-4 shrink-0 accent-[#0f6b44]" />
                <span>
                  I agree to the <Link to="/terms" className="font-bold text-primary hover:underline">Terms of Service</Link>{" "}
                  and <Link to="/privacy" className="font-bold text-primary hover:underline">Privacy Policy</Link>.
                </span>
              </label>
              {joinForm.formState.errors.terms && (
                <p role="alert" className="text-xs font-medium text-error">{joinForm.formState.errors.terms.message}</p>
              )}
              {signup && authError && (
                <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">{authError}</p>
              )}
              <Button type="submit" className="w-full py-3" disabled={busy}>
                {busy && signup ? "Please wait…" : "Create account"}
              </Button>
            </form>
          </div>

          {/* Mobile signup form */}
          {signup && (
            <div className="border-t border-outline p-7 md:hidden">
              <h1 className="font-display text-2xl font-semibold">Create account</h1>
              <form className="mt-5 space-y-4" onSubmit={joinForm.handleSubmit(doSignup)}>
                <Field label="Full name" error={joinForm.formState.errors.name?.message}>
                  <TextField {...joinForm.register("name")} placeholder="e.g. Gita Sharma" autoComplete="name" />
                </Field>
                <Field label="Phone" error={joinForm.formState.errors.phone?.message}>
                  <TextField {...joinForm.register("phone")} placeholder="9852600000" inputMode="tel" autoComplete="tel" />
                </Field>
                <Field label="Email" error={joinForm.formState.errors.email?.message}>
                  <TextField {...joinForm.register("email")} type="email" placeholder="you@example.com" autoComplete="email" />
                </Field>
                <Field label="Password" error={joinForm.formState.errors.password?.message}>
                  <TextField {...joinForm.register("password")} type="password" placeholder="Minimum 8 characters" autoComplete="new-password" />
                </Field>
                <Field label="Referral code (optional)">
                  <TextField {...joinForm.register("referralCode")} placeholder="e.g. GITA-4F8K2Q" className="uppercase" />
                </Field>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-outline p-3 text-[13px] leading-relaxed">
                  <input type="checkbox" {...joinForm.register("terms")} className="mt-0.5 size-4 shrink-0 accent-[#0f6b44]" />
                  <span>
                    I agree to the <Link to="/terms" className="font-bold text-primary hover:underline">Terms</Link>{" "}
                    and <Link to="/privacy" className="font-bold text-primary hover:underline">Privacy Policy</Link>.
                  </span>
                </label>
                {joinForm.formState.errors.terms && (
                  <p role="alert" className="text-xs font-medium text-error">{joinForm.formState.errors.terms.message}</p>
                )}
                {authError && (
                  <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">{authError}</p>
                )}
                <Button type="submit" className="w-full py-3" disabled={busy}>
                  {busy ? "Please wait…" : "Create account"}
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* Sliding cover — reveals the active side */}
        <div
          aria-hidden="true"
          className={`ring-band dotgrid-light absolute inset-y-0 left-0 hidden w-1/2 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none md:block ${
            signup ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <CoverContent mode={mode} />
        </div>
      </Card>

      {/* Demo logins — local seed data only */}
      <Card className="mx-auto mt-4 max-w-4xl border-dashed p-5">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <FlaskConical size={15} aria-hidden="true" /> Try the demo — one tap fills the form
        </p>
        <p className="mt-0.5 text-xs text-on-surface-variant">Local seed accounts. The admin password must be changed before any public launch.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => fillDemo(a.email, a.password)}
              className="rounded-md border border-outline bg-surface-container/60 p-3 text-left transition hover:border-primary active:scale-[0.98]"
            >
              <span className="block text-sm font-extrabold">{a.label}</span>
              <span className="block truncate font-mono text-xs text-on-surface-variant">{a.email}</span>
              <span className="block font-mono text-xs text-on-surface-variant">{a.password}</span>
            </button>
          ))}
        </div>
      </Card>

      <p className="mt-4 text-center text-xs text-on-surface-variant">
        Customers register freely · Worker accounts are created by admins and activated by invitation
      </p>
    </div>
  );
}
