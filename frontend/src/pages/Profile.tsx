import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Crosshair, MapPin } from "lucide-react";
import { Button, Card, Field, PageHero, Select, TextField } from "../components/ui";
import { MapPicker } from "../components/MapPicker";
import { api, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { inDamak, parseWardFromText, roundPin, reverseLabel, suggestStreet, type Pin } from "../lib/geo";
import type { Address } from "../lib/types";

const addressSchema = z.object({
  label: z.string().trim().min(2, "Label your address"),
  line: z.string().trim().min(5, "Enter ward, street and house"),
  ward: z.coerce.number().int().min(1).max(10).optional(),
  phone: z.string().trim().min(10, "Enter a valid phone").max(20),
});

export default function Profile() {
  const { user, signOut } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrError, setAddrError] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState("");
  const [profileError, setProfileError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [pin, setPin] = useState<Pin | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  function reload() {
    setLoadError("");
    api<{ addresses: Address[] }>("/api/addresses").then((d) => setAddresses(d.addresses)).catch(() => setLoadError("Couldn't load your addresses."));
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
    setProfileError("");
    if (name.trim().length < 2) {
      setProfileError("Enter your full name (at least 2 characters).");
      return;
    }
    if (phone.trim().length < 10) {
      setProfileError("Enter a valid phone number (at least 10 digits).");
      return;
    }
    try {
      await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ name: name.trim(), phone: phone.trim() }) });
      setSaved("Profile saved.");
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Could not save profile.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this address?")) return;
    setAddrError("");
    try {
      await api(`/api/addresses/${id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setAddrError(e instanceof Error ? e.message : "Could not remove address.");
    }
  }

  function locateMe() {
    setAddrError("");
    if (!("geolocation" in navigator)) {
      setAddrError("This device has no location service — pin on the map instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (g) => {
        setLocating(false);
        const p = roundPin({ lat: g.coords.latitude, lng: g.coords.longitude });
        if (!inDamak(p)) {
          setAddrError("You're outside Damak — pin your Damak address on the map.");
          return;
        }
        setPin(p);
        // Autofill the address box from the GPS fix — editable after.
        reverseLabel(p)
          .then((t) => {
            const street = suggestStreet(t);
            if (street) addr.setValue("line", street, { shouldValidate: true, shouldDirty: true });
            const w = parseWardFromText(t);
            if (w !== null) addr.setValue("ward", w, { shouldValidate: true, shouldDirty: true });
          })
          .catch(() => {});
      },
      () => {
        setLocating(false);
        setAddrError("Location blocked — allow access or pin on the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
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
            {profileError && <p role="alert" className="text-sm font-medium text-error">{profileError}</p>}
            {saved && <p role="status" className="text-sm font-medium">{saved}</p>}
          </div>
        </Card>
        <div className="space-y-5">
        <Card className="h-fit p-6">
          <h2 className="font-bold">Sessions</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Lost a device or see activity you don't recognize? This signs out every session, everywhere — including this one.</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={async () => {
              if (!window.confirm("Sign out on all devices? You'll need to sign in again here too.")) return;
              try {
                await post("/api/auth/logout-all", {});
              } catch {
                /* session already dead — still leave */
              }
              await signOut();
              window.location.href = "/signin";
            }}
          >
            Sign out everywhere
          </Button>
        </Card>
        <Card className="h-fit p-6">
          <h2 className="font-bold">Saved addresses ({addresses.length}/5)</h2>
          {loadError && (
            <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-error-container p-3 text-sm font-medium text-error">
              {loadError}
              <Button variant="outline" onClick={reload}>Retry</Button>
            </p>
          )}
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
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setMapOpen(true)}>
                  <MapPin size={15} aria-hidden="true" /> {pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "Pin on map"}
                </Button>
                <Button type="button" variant="outline" onClick={locateMe} disabled={locating}>
                  <Crosshair size={15} aria-hidden="true" /> {locating ? "Locating…" : pin ? "Re-locate me" : "Locate me"}
                </Button>
                {pin && <Button type="button" variant="ghost" onClick={() => setPin(null)}>Clear pin</Button>}
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">Pin fills the address box automatically — edit it freely after. The ward still decides coverage.</p>
            </div>
            {addrError && <p role="alert" className="text-sm font-medium text-error">{addrError}</p>}
            <Button type="submit">Add address</Button>
          </form>
          {mapOpen && (
            <MapPicker initial={pin} onClose={() => setMapOpen(false)}
              onConfirm={(p, label) => {
                setPin(p);
                setMapOpen(false);
                // Autofill the address box from the pin — editable after.
                const street = suggestStreet(label);
                if (street) addr.setValue("line", street, { shouldValidate: true, shouldDirty: true });
                const w = parseWardFromText(label);
                if (w !== null) addr.setValue("ward", w, { shouldValidate: true, shouldDirty: true });
              }} />
          )}
        </Card>
        </div>
      </div>
    </div>
  );
}
