import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Field, PageHero, TextField } from "../components/ui";
import { useAuth, homeFor } from "../lib/auth";

const schema = z.object({
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export default function Signin({ mode }: { mode: "signin" | "signup" }) {
  const { signIn, signUp, authError } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", password: "" },
  });

  async function submit(f: z.infer<typeof schema>) {
    if (mode === "signup") {
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
      mode === "signup"
        ? await signUp(f.name!.trim(), f.phone!.trim(), f.email, f.password)
        : await signIn(f.email, f.password);
    setBusy(false);
    if (role) navigate(homeFor(role), { replace: true });
  }

  return (
    <div className="fade-up">
      <PageHero
        eyebrow={mode === "signin" ? "Welcome back" : "Join Damak's marketplace"}
        title={mode === "signin" ? "Sign in" : "Create your account"}
        body={mode === "signin"
          ? "Track bookings, manage addresses and spend loyalty points."
          : "Book verified pros in minutes — and earn rewards on every completed job."}
      />
      <div className="wrap py-8">
        <Card className="mx-auto max-w-md p-6 md:p-8">
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            {mode === "signup" && (
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
              <TextField {...form.register("password")} type="password" placeholder={mode === "signup" ? "Minimum 8 characters" : "Your password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </Field>
            {authError && <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">{authError}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-on-surface-variant">
            {mode === "signin" ? (
              <>New here? <Link to="/signup" className="font-bold text-primary hover:underline">Create an account</Link></>
            ) : (
              <>Already registered? <Link to="/signin" className="font-bold text-primary hover:underline">Sign in</Link></>
            )}
          </p>
          {mode === "signup" && (
            <p className="mt-3 rounded-md bg-surface-container p-3 text-xs leading-relaxed text-on-surface-variant">
              Customer accounts only. Professionals join by admin invitation after verification —
              there is no public pro signup.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
