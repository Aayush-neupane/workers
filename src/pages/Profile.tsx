import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Field, PageHero, Select, TextField } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useStore } from "../lib/store";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  phone: z.string().trim().min(10, "Enter a valid phone"),
});

const addressSchema = z.object({
  label: z.string().trim().min(2, "Label your address"),
  line: z.string().trim().min(5, "Enter ward, street and house"),
  city: z.enum(["Damak"]),
  phone: z.string().trim().min(10, "Enter a valid phone"),
});

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { addresses, addAddress, deleteAddress } = useStore();
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  const profile = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? "", phone: "" },
  });

  const addr = useForm<z.infer<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: "", line: "", city: "Damak", phone: "9852600000" },
  });

  return (
    <div className="fade-up">
      <PageHero eyebrow="Account" title="Profile & addresses" body="Where pros show up, and how we reach you." />
      <div className="wrap max-w-3xl py-8">
      <Card className="p-6">
        <h2 className="font-bold">Contact details</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{user?.email}</p>
        <form
          className="mt-3 grid gap-4 sm:grid-cols-2"
          onSubmit={profile.handleSubmit(async (f) => {
            setBusy(true);
            const ok = await updateProfile(f.name, f.phone);
            setBusy(false);
            setSaved(ok ? "Profile saved." : "Save failed — try again.");
          })}
        >
          <Field label="Full name" error={profile.formState.errors.name?.message}>
            <TextField {...profile.register("name")} />
          </Field>
          <Field label="Phone" error={profile.formState.errors.phone?.message}>
            <TextField {...profile.register("phone")} inputMode="tel" placeholder="9852600000" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
            {saved && <p role="status" className="mt-2 text-sm text-success">{saved}</p>}
          </div>
        </form>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-bold">Saved addresses ({addresses.length}/5)</h2>
        <ul className="mt-3 space-y-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-md border border-outline p-3 text-sm">
              <span><strong>{a.label}</strong> — {a.line}, {a.city} · {a.phone}</span>
              <Button variant="ghost" onClick={() => void deleteAddress(a.id)}>Remove</Button>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 font-bold">Add address</h3>
        <form
          className="mt-3 grid gap-4 sm:grid-cols-2"
          onSubmit={addr.handleSubmit(async (f) => {
            try {
              await addAddress(f);
              addr.reset({ label: "", line: "", city: "Damak", phone: "9852600000" });
            } catch (e) {
              alert(e instanceof Error ? e.message : "Could not add address");
            }
          })}
        >
          <Field label="Label" error={addr.formState.errors.label?.message}>
            <TextField {...addr.register("label")} placeholder="Home, Shop…" />
          </Field>
          <Field label="Phone" error={addr.formState.errors.phone?.message}>
            <TextField {...addr.register("phone")} inputMode="tel" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Ward, street & house" error={addr.formState.errors.line?.message}>
              <TextField {...addr.register("line")} placeholder="Damak-5, Himal Chowk, House 12" />
            </Field>
          </div>
          <Field label="City">
            <Select {...addr.register("city")}>
              <option>Damak</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit">Add address</Button>
          </div>
        </form>
      </Card>
      </div>
    </div>
  );
}
