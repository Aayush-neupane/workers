import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { KeyRound } from "lucide-react";
import { Button, Card, Field, PageHero, TextField } from "../components/ui";
import { ApiError, post } from "../lib/api";
import { useAuth } from "../lib/auth";

const schema = z.object({
  password: z.string().min(8, "Minimum 8 characters"),
  confirm: z.string(),
});

export default function Invite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [invite, setInvite] = useState<{ name: string; email: string; expiresAt: string } | null>(null);
  const [deadReason, setDeadReason] = useState("");
  const token = params.get("token") ?? "";

  const form = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(schema) as unknown as Resolver<{ password: string; confirm: string }>,
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    post<{ name: string; email: string; expiresAt: string }>("/api/auth/worker/invite/check", { token })
      .then((d) => {
        setInvite(d);
        setChecking(false);
      })
      .catch((e) => {
        setDeadReason(e instanceof ApiError && e.status === 410 ? e.message : "This invitation link is not valid.");
        setChecking(false);
      });
  }, [token]);

  if (!token) {
    return (
      <div className="wrap py-12 text-center">
        <h1 className="font-display text-3xl font-semibold">Invitation needed</h1>
        <p className="mt-2 text-on-surface-variant">
          Worker accounts are created by admins, who share a one-time invitation link.
        </p>
        <div className="mt-5">
          <Link to="/support">
            <Button variant="outline">Contact support</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="wrap py-12" role="status">
        <div className="mx-auto max-w-md animate-pulse space-y-3">
          <div className="h-8 w-2/3 rounded bg-surface-container-high" />
          <div className="h-4 w-full rounded bg-surface-container" />
        </div>
        <p className="sr-only">Checking invitation…</p>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="wrap py-12 text-center">
        <h1 className="font-display text-3xl font-semibold">Link {deadReason.toLowerCase().includes("expired") ? "expired" : "already used"}</h1>
        <p className="mx-auto mt-2 max-w-md text-on-surface-variant">
          {deadReason || "This invitation link is not valid."} Invitations are one-time and expire after 7 days —
          ask your admin for a fresh one.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/signin">
            <Button>Sign in</Button>
          </Link>
          <Link to="/support">
            <Button variant="outline">Contact support</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <PageHero
        eyebrow="Worker invitation"
        title={`Welcome, ${invite.name.split(" ")[0]}`}
        body={`This invitation is for ${invite.email}. Set a password to activate the account — the link works once.`}
      />
      <div className="wrap max-w-md py-8">
        <Card className="elev-2 p-6 md:p-8">
          <p className="flex items-center gap-2 font-bold">
            <KeyRound size={17} className="text-primary" aria-hidden="true" /> Set your password
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={form.handleSubmit(async (f) => {
              if (f.password !== f.confirm) {
                setError("Passwords do not match.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                await post("/api/auth/worker/accept", { token, password: f.password });
                await refresh();
                navigate("/worker");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Activation failed");
              } finally {
                setBusy(false);
              }
            })}
          >
            <Field label="New password" error={form.formState.errors.password?.message}>
              <TextField {...form.register("password")} type="password" autoComplete="new-password" />
            </Field>
            <Field label="Confirm password">
              <TextField {...form.register("confirm")} type="password" autoComplete="new-password" />
            </Field>
            {error && (
              <p role="alert" className="rounded-md bg-error-container p-3 text-sm font-medium text-error">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full py-3" disabled={busy}>
              {busy ? "Activating…" : "Activate account"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
