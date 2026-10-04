import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Button, Card, EmptyState, Field, PageHero, TextField } from "../components/ui";
import { post } from "../lib/api";

const schema = z.object({
  phone: z.string().trim().min(10, "Enter a valid phone number").max(20),
  password: z.string().min(8, "Minimum 8 characters"),
});

interface InviteInfo {
  email: string;
  name: string;
  expires_at: string;
  accepted_at: string | null;
}

export default function Invite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "", password: "" },
  });

  useEffect(() => {
    if (!token) {
      setError("This invitation link is incomplete — ask your administrator for a fresh invite.");
      return;
    }
    post<{ invite: InviteInfo }>("/api/auth/worker/invite/check", { token })
      .then((d) => setInfo(d.invite))
      .catch((e) => setError(e instanceof Error ? e.message : "Invalid invitation"));
  }, [token]);

  async function accept(f: z.infer<typeof schema>) {
    setBusy(true);
    setError("");
    try {
      await post("/api/auth/worker/accept", { token, phone: f.phone, password: f.password });
      navigate("/worker", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept invitation");
      setBusy(false);
    }
  }

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Professional onboarding"
        title="You've been invited"
        body="Pros join Sajilo Damak by invitation only. Set your contact and password to claim this invite, then submit your documents for verification."
      />
      <div className="wrap py-8">
        <Card className="mx-auto max-w-md p-6 md:p-8">
          {error && !info ? (
            <div className="space-y-3">
              <p role="alert" className="flex items-start gap-2 rounded-md bg-error-container p-3.5 text-sm font-medium text-error">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
              </p>
              <Link to="/support"><Button variant="outline" className="w-full">Contact support</Button></Link>
            </div>
          ) : !info ? (
            <p role="status" className="py-6 text-center text-on-surface-variant">Checking invitation…</p>
          ) : info.accepted_at ? (
            <EmptyState title="Invitation already used" body="This invite was claimed. Sign in, or ask for a fresh one." />
          ) : (
            <>
              <p className="flex items-center gap-1.5 rounded-md bg-success-container p-3 text-sm font-bold text-on-primary-container">
                <ShieldCheck size={16} aria-hidden="true" /> Invite for {info.name} · {info.email}
              </p>
              <p className="mt-2 text-xs text-on-surface-variant">
                Expires {new Date(info.expires_at).toLocaleString()}. After claiming, only verified + activated pros receive assignments.
              </p>
              <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(accept)}>
                <Field label="Phone" error={form.formState.errors.phone?.message}>
                  <TextField {...form.register("phone")} inputMode="tel" placeholder="9852600000" autoComplete="tel" />
                </Field>
                <Field label="Create password" error={form.formState.errors.password?.message}>
                  <TextField {...form.register("password")} type="password" placeholder="Minimum 8 characters" autoComplete="new-password" />
                </Field>
                {error && <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">{error}</p>}
                <Button type="submit" className="w-full py-3" disabled={busy}>
                  {busy ? "Claiming…" : "Claim invitation"}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
