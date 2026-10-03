import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, Wrench } from "lucide-react";
import { Button, Card, Field, TextField } from "../components/ui";
import { homeFor, useAuth } from "../lib/auth";

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

export default function Signin({ mode }: { mode: "signin" | "signup" }) {
  const { signIn, signUp, authError } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(mode === "signin" ? signinSchema : signupSchema) as unknown as Resolver<
      z.infer<typeof signupSchema>
    >,
    defaultValues: { name: "", phone: "", email: "", password: "" },
  });

  const submit = form.handleSubmit(async (f) => {
    setBusy(true);
    let role = null;
    if (mode === "signin" && "email" in f) {
      role = await signIn(f.email, f.password);
    } else if ("name" in f && "phone" in f) {
      role = await signUp(f.name, f.phone, f.email, f.password);
    }
    setBusy(false);
    if (role) navigate(homeFor(role));
  });

  const fill = (email: string, password: string) => {
    form.setValue("email", email);
    form.setValue("password", password);
  };

  return (
    <div className="wrap fade-up py-12">
      <Card className="elev-2 mx-auto grid max-w-3xl overflow-hidden md:grid-cols-[0.9fr_1.1fr]">
        <div className="ring-band dotgrid-light hidden flex-col justify-between p-8 md:flex">
          <p className="flex items-center gap-2 font-bold text-white">
            <span className="grid size-9 place-items-center rounded-lg bg-marigold-300 text-pine-950">
              <Wrench size={18} aria-hidden="true" />
            </span>
            <span className="font-display text-xl font-semibold">Workers</span>
          </p>
          <div>
            <p className="font-display text-3xl leading-tight font-semibold text-white">
              {mode === "signin" ? "Welcome back." : "Join Damak's happy homes."}
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-white/75">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-marigold-300" aria-hidden="true" />
              Customers register freely. Worker accounts are created by admins and activated by invitation.
            </p>
          </div>
          <p className="text-xs text-white/50">Cash · eSewa · Khalti · All prices in NPR</p>
        </div>
        <div className="p-7 md:p-8">
          <h1 className="font-display text-3xl font-semibold">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <>
                <Field label="Full name" error={form.formState.errors.name?.message as string | undefined}>
                  <TextField {...form.register("name" as never)} placeholder="Your name" autoComplete="name" />
                </Field>
                <Field label="Phone" error={form.formState.errors.phone?.message as string | undefined}>
                  <TextField {...form.register("phone" as never)} placeholder="9852600000" inputMode="tel" autoComplete="tel" />
                </Field>
              </>
            )}
            <Field label="Email" error={form.formState.errors.email?.message}>
              <TextField {...form.register("email")} placeholder="you@example.com" autoComplete="email" />
            </Field>
            <Field label="Password" error={form.formState.errors.password?.message}>
              <TextField {...form.register("password")} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            </Field>
            {mode === "signup" && (
              <p className="text-xs leading-relaxed text-on-surface-variant">
                By creating an account you agree to the <Link to="/terms" className="font-semibold text-primary">Terms of service</Link> and{" "}
                <Link to="/privacy" className="font-semibold text-primary">Privacy policy</Link>.
              </p>
            )}
            {authError && (
              <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">
                {authError}
              </p>
            )}
            <Button type="submit" className="w-full py-3" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          {mode === "signin" && (
            <div className="mt-4 rounded-md bg-surface-container p-3 text-xs leading-relaxed">
              <p className="font-bold">Demo accounts (seeded):</p>
              <ul className="mt-1 space-y-1">
                <li><button className="cursor-pointer font-semibold text-primary" onClick={() => fill("customer@demo.local", "Customer123!")}>Customer</button> — customer@demo.local</li>
                <li><button className="cursor-pointer font-semibold text-primary" onClick={() => fill("gita@demo.local", "Customer123!")}>Customer+</button> — gita@demo.local</li>
                <li><button className="cursor-pointer font-semibold text-primary" onClick={() => fill("ram@workers.local", "Worker123!")}>Worker</button> — ram@workers.local</li>
                <li><button className="cursor-pointer font-semibold text-primary" onClick={() => fill("deepak@workers.local", "Worker123!")}>Worker+</button> — deepak@workers.local</li>
                <li><button className="cursor-pointer font-semibold text-primary" onClick={() => fill("admin@workers.local", "ChangeMe123!")}>Admin</button> — admin@workers.local</li>
              </ul>
            </div>
          )}
          <p className="mt-4 text-center text-sm text-on-surface-variant">
            {mode === "signin" ? (
              <>New here? <Link to="/signup" className="font-bold text-primary">Create an account</Link></>
            ) : (
              <>Have an account? <Link to="/signin" className="font-bold text-primary">Sign in</Link></>
            )}
          </p>
        </div>
      </Card>
    </div>
  );
}
