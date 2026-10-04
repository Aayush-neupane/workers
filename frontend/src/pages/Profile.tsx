import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin } from "lucide-react";
import { Button, Card, Field, PageHero, Select, TextField } from "../components/ui";
import { MapPicker } from "../components/MapPicker";
import { api, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Pin } from "../lib/geo";
import type { Address } from "../lib/types";

const addressSchema = z.object({
  label: z.string().trim().min(2, "Label your address"),
  line: z.string().trim().min(5, "Enter ward, street and house"),
  ward: z.coerce.number().int().min(1).max(10).optional(),
  phone: z.string().trim().min(10, "Enter a valid phone").max(20),
});

export default function Profile() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrError, setAddrError] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState("");
  const [pin, setPin] = useState<Pin | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  function reload() {
    api<{ addresses: Address[] }>("/api/addresses").then((d) => setAddresses(d.addresses)).catch(() => {});
  }
  useEffect(reload, []);

  const addr = useForm<z.input<typeof addressSchema>, unknown, z.output<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: "Home", line: "", phone: "" },
  });

  async function addAddress(f: z.output<typeof addressSchema>) {
    setAddrError("");
    try {
      await post("/api/addresses", { ...f, city: "Damak", phone: f.phone ?? "", lat: pin?.lat ?? null, lng: pin?.lng ?? null });
      addr.reset({ label: "Home", line: "", phone: "" });
      setPin(null);
      reload();
    } catch (e) {
      setAddrError(e instanceof Error ? e.message : "Could not add address");
    }
  }

  async function saveProfile() {
    setSaved("");
    try {
      await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ name, phone }) });
      setSaved("Profile saved.");
    } catch {
      setSaved("Could not save profile.");
    }
  }

  async function remove(id: string) {
    await api(`/api/addresses/${id}`, { method: "DELETE" }).catch(() => {});
    reload();
  }

  return (
    <div className="fade-up">
      <PageHero eyebrow="Account" title="Profile & addresses" body="Where pros show up, and how we reach you." />
      <div className="wrap grid gap-5 py-8 md:grid-cols-2">
        <Card className="h-fit p-6">
          <h2 className="font-bold">Profile</h2>
          <p className="text-sm text-on-surface-variant">{user?.email}</p>
          <div className="mt-4 space-y-4">
            <Field label="Full name"><TextField value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Phone"><TextField value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="9852600000" /></Field>
            <Button onClick={saveProfile}>Save profile</Button>
            {saved && <p className="text-sm font-medium">{saved}</p>}
          </div>
        </Card>
        <Card className="h-fit p-6">
          <h2 className="font-bold">Saved addresses ({addresses.length}/5)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {addresses.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-container p-3">
                <span><strong>{a.label}</strong> — {a.line}, {a.city}{a.ward ? ` (Ward ${a.ward})` : ""}</span>
                <Button variant="ghost" onClick={() => remove(a.id)}>Remove</Button>
              </li>
            ))}
          </ul>
          <form className="mt-4 space-y-4" onSubmit={addr.handleSubmit(addAddress)}>
            <Field label="Label" error={addr.formState.errors.label?.message}>
              <Select {...addr.register("label")}><option>Home</option><option>Shop</option><option>Office</option></Select>
            </Field>
            <Field label="Ward, street & house" error={addr.formState.errors.line?.message}>
              <TextField {...addr.register("line")} placeholder="Damak-5, Himal Chowk, House 12" />
            </Field>
            <Field label="Ward (optional — parsed from above if blank)">
              <TextField {...addr.register("ward")} type="number" min={1} max={10} placeholder="5" />
            </Field>
            <Field label="Phone" error={addr.formState.errors.phone?.message}>
              <TextField {...addr.register("phone")} inputMode="tel" placeholder="9852600000" />
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-semibold">Map pin (optional)</span>
              <Button type="button" variant="outline" onClick={() => setMapOpen(true)}>
                <MapPin size={15} aria-hidden="true" /> {pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "Pin on map"}
              </Button>
              <p className="mt-1 text-xs text-on-surface-variant">Helps the pro find you. The ward above still decides coverage.</p>
            </div>
            {addrError && <p role="alert" className="text-sm font-medium text-error">{addrError}</p>}
            <Button type="submit">Add address</Button>
          </form>
          {mapOpen && (
            <MapPicker initial={pin} onClose={() => setMapOpen(false)}
              onConfirm={(p) => { setPin(p); setMapOpen(false); }} />
          )}
        </Card>
      </div>
    </div>
  );
}
