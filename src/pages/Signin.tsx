import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
    <div className="wrap fade-up max-w-md py-12">
      <h1 className="text-3xl font-bold">{mode === "signin" ? "Welcome back" : "Create account"}</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Demo auth — pick a role to explore that experience. Real Supabase Auth connects in Phase 1.
      </p>
      <Card className="mt-6 p-6">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name" error={errors.name?.message}>
            <TextField {...register("name")} placeholder="Aayush Neupane" autoComplete="name" />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <TextField {...register("phone")} placeholder="9851000000" inputMode="tel" autoComplete="tel" />
          </Field>
          <Field label="Explore as" hint="Customers register freely. Worker and admin logins are shown for demo — workers are created by admins only.">
            <Select {...register("role")}>
              <option value="customer">Customer</option>
              <option value="worker">Worker (demo)</option>
              <option value="admin">Admin (demo)</option>
            </Select>
          </Field>
          <Button type="submit" className="w-full">
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-on-surface-variant">
        {mode === "signin" ? (
          <>New here? <Link to="/signup" className="font-semibold text-primary">Create an account</Link></>
        ) : (
          <>Have an account? <Link to="/signin" className="font-semibold text-primary">Sign in</Link></>
        )}
      </p>
    </div>
  );
}
