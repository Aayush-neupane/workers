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
  const { name, signIn } = useAuth();
  const { addresses, addAddress } = useStore();
  const [saved, setSaved] = useState("");

  const profile = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name, phone: "9852600000" },
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
        <form
          className="mt-3 grid gap-4 sm:grid-cols-2"
          onSubmit={profile.handleSubmit((f) => {
            signIn("customer", f.name);
            setSaved("Profile saved.");
          })}
        >
          <Field label="Full name" error={profile.formState.errors.name?.message}>
            <TextField {...profile.register("name")} />
          </Field>
          <Field label="Phone" error={profile.formState.errors.phone?.message}>
            <TextField {...profile.register("phone")} inputMode="tel" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Save changes</Button>
            {saved && <p role="status" className="mt-2 text-sm text-success">{saved}</p>}
          </div>
        </form>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-bold">Saved addresses ({addresses.length})</h2>
        <ul className="mt-3 space-y-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-md border border-outline p-3 text-sm">
              <strong>{a.label}</strong> — {a.line}, {a.city} · {a.phone}
            </li>
          ))}
        </ul>
        <h3 className="mt-5 font-bold">Add address</h3>
        <form
          className="mt-3 grid gap-4 sm:grid-cols-2"
          onSubmit={addr.handleSubmit((f) => {
            addAddress({ id: `a-${Date.now()}`, ...f });
            addr.reset({ label: "", line: "", city: "Damak", phone: "9852600000" });
          })}
        >
          <Field label="Label" error={addr.formState.errors.label?.message}>
            <TextField {...addr.register("label")} placeholder="Home, Office…" />
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
