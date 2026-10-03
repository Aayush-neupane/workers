import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, Wrench } from "lucide-react";
import { Button, Card, Field, Select, TextField } from "../components/ui";
import { homeFor, useAuth } from "../lib/auth";
import type { Role } from "../lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  phone: z.string().trim().min(10, "Enter a valid phone number"),
  role: z.enum(["customer", "worker", "admin"]),
});

type Form = z.infer<typeof schema>;

export default function Signin({ mode }: { mode: "signin" | "signup" }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", role: "customer" },
  });

  const submit = handleSubmit((f) => {
    signIn(f.role as Role, f.name);
    navigate(homeFor(f.role as Role));
  });

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
              {mode === "signin" ? "Welcome back." : "Join 11,000+ happy homes."}
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-white/75">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-marigold-300" aria-hidden="true" />
              Demo auth — pick a role to explore that experience. Real Supabase Auth connects in Phase 1.
            </p>
          </div>
          <p className="text-xs text-white/50">Cash · eSewa · Khalti · All prices in NPR</p>
        </div>
        <div className="p-7 md:p-8">
          <h1 className="font-display text-3xl font-semibold">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Full name" error={errors.name?.message}>
              <TextField {...register("name")} placeholder="Aayush Neupane" autoComplete="name" />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <TextField {...register("phone")} placeholder="9852600000" inputMode="tel" autoComplete="tel" />
            </Field>
            <Field label="Explore as" hint="Customers register freely. Worker and admin logins are shown for demo — workers are created by admins only.">
              <Select {...register("role")}>
                <option value="customer">Customer</option>
                <option value="worker">Worker (demo)</option>
                <option value="admin">Admin (demo)</option>
              </Select>
            </Field>
            <Button type="submit" className="w-full py-3">
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
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
