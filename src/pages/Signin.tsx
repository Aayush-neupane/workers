import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { ArrowLeft, ArrowRight, ShieldCheck, Wrench } from "lucide-react";
import { Button, Card, Field, TextField } from "../components/ui";
import { homeFor, useAuth } from "../lib/auth";
import type { Role } from "../lib/types";

const signinSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  phone: z.string().trim().min(10, "Enter a valid phone number"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Minimum 8 characters"),
});

function LoginForm({ onDone }: { onDone: (role: Role) => void }) {
  const { signIn, authError } = useAuth();
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof signinSchema>>({
    resolver: zodResolver(signinSchema) as unknown as Resolver<z.infer<typeof signinSchema>>,
    defaultValues: { email: "", password: "" },
  });

  return (
    <form
      onSubmit={form.handleSubmit(async (f) => {
        setBusy(true);
        const role = await signIn(f.email, f.password);
        setBusy(false);
        if (role) onDone(role);
      })}
      className="space-y-4"
    >
      <Field label="Email" error={form.formState.errors.email?.message}>
        <TextField {...form.register("email")} placeholder="you@example.com" autoComplete="email" />
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message}>
        <TextField {...form.register("password")} type="password" autoComplete="current-password" />
      </Field>
      {authError && (
        <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">
          {authError}
        </p>
      )}
      <Button type="submit" className="w-full py-3" disabled={busy}>
        {busy ? "Please wait…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: (role: Role) => void }) {
  const { signUp, authError } = useAuth();
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema) as unknown as Resolver<z.infer<typeof signupSchema>>,
    defaultValues: { name: "", phone: "", email: "", password: "" },
  });

  return (
    <form
      onSubmit={form.handleSubmit(async (f) => {
        setBusy(true);
        const role = await signUp(f.name, f.phone, f.email, f.password);
        setBusy(false);
        if (role) onDone(role);
      })}
      className="space-y-4"
    >
      <Field label="Full name" error={form.formState.errors.name?.message}>
        <TextField {...form.register("name")} placeholder="Your name" autoComplete="name" />
      </Field>
      <Field label="Phone" error={form.formState.errors.phone?.message}>
        <TextField {...form.register("phone")} placeholder="9852600000" inputMode="tel" autoComplete="tel" />
      </Field>
      <Field label="Email" error={form.formState.errors.email?.message}>
        <TextField {...form.register("email")} placeholder="you@example.com" autoComplete="email" />
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message}>
        <TextField {...form.register("password")} type="password" autoComplete="new-password" />
      </Field>
      <p className="text-xs leading-relaxed text-on-surface-variant">
        By creating an account you agree to the{" "}
        <Link to="/terms" className="font-semibold text-primary">Terms of service</Link> and{" "}
        <Link to="/privacy" className="font-semibold text-primary">Privacy policy</Link>.
      </p>
      {authError && (
        <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">
          {authError}
        </p>
      )}
      <Button type="submit" className="w-full py-3" disabled={busy}>
        {busy ? "Please wait…" : "Create account"}
      </Button>
    </form>
  );
}

function BrandPanel({ mode }: { mode: "signin" | "signup" }) {
  return (
    <div className="ring-band dotgrid-light flex h-full flex-col justify-between p-8 md:p-10">
      <p className="flex items-center gap-2 font-bold text-white">
        <span className="grid size-9 place-items-center rounded-lg bg-marigold-300 text-pine-950">
          <Wrench size={18} aria-hidden="true" />
        </span>
        <span className="font-display text-xl font-semibold">Workers</span>
      </p>
      <div key={mode} className="fade-up">
        <p className="font-display text-3xl leading-tight font-semibold text-white md:text-4xl">
          {mode === "signin" ? "New to Damak's trusted pros?" : "One of us already?"}
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
            <><ArrowLeft size={15} aria-hidden="true" /> Sign in</>
          )}
        </Link>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-white/50">
        <ShieldCheck size={13} className="text-marigold-300" aria-hidden="true" />
        Every pro background-checked · Cash, eSewa & Khalti
      </p>
    </div>
  );
}

export default function Signin({ mode }: { mode: "signin" | "signup" }) {
  const navigate = useNavigate();
  const done = (role: Role) => navigate(homeFor(role));
  const signup = mode === "signup";

  return (
    <div className="wrap fade-up py-10 md:py-14">
      {/* Mobile brand strip */}
      <div className="ring-band mb-4 rounded-lg p-5 md:hidden">
        <p className="flex items-center gap-2 font-bold text-white">
          <span className="grid size-8 place-items-center rounded-md bg-marigold-300 text-pine-950">
            <Wrench size={16} aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-semibold">Workers</span>
        </p>
        <p className="mt-2 text-sm text-white/75">
          {signup ? "Create your free account." : "Welcome back."}{" "}
          <Link
            to={signup ? "/signin" : "/signup"}
            className="font-bold text-marigold-300"
          >
            {signup ? "Sign in instead" : "Create an account"}
          </Link>
        </p>
      </div>

      <Card className="elev-2 relative mx-auto grid max-w-4xl overflow-hidden md:min-h-[640px] md:grid-cols-2">
        {/* Left cell — login form home */}
        <div className="p-7 md:p-10">
          <h1 className="font-display text-3xl font-semibold">Sign in</h1>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Track bookings, rewards and receipts.
          </p>
          <div className="mt-6">
            <LoginForm onDone={done} />
          </div>
          <p className="mt-5 text-center text-sm text-on-surface-variant md:hidden">
            New here?{" "}
            <Link to="/signup" className="font-bold text-primary">Create an account</Link>
          </p>
        </div>

        {/* Right cell — signup form home */}
        <div className="hidden p-7 md:block md:p-10">
          <h1 className="font-display text-3xl font-semibold">Create account</h1>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Free forever. Book in under a minute.
          </p>
          <div className="mt-6">
            <SignupForm onDone={done} />
          </div>
        </div>

        {/* Mobile signup form */}
        {signup && (
          <div className="border-t border-outline p-7 md:hidden">
            <h1 className="font-display text-2xl font-semibold">Create account</h1>
            <div className="mt-5">
              <SignupForm onDone={done} />
            </div>
          </div>
        )}

        {/* Sliding brand card — covers the inactive side on desktop */}
        <div
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 hidden w-1/2 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none md:block ${
            signup ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <BrandPanel mode={mode} />
        </div>
      </Card>

      <p className="mt-4 hidden text-center text-xs text-on-surface-variant md:block">
        Customers register freely · Worker accounts are created by admins and activated by invitation
      </p>
    </div>
  );
}
