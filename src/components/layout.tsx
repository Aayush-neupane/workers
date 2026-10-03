import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Menu, Phone, ShieldCheck, Wrench, X } from "lucide-react";
import { homeFor, useAuth } from "../lib/auth";
import { Button } from "./ui";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/track/BK-1057", label: "Track booking" },
  { to: "/rewards", label: "Rewards" },
  { to: "/support", label: "Support" },
];

export function Navbar() {
  const { role, user, signOut } = useAuth();
  const name = user?.name ?? "";
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-pine-950 text-white/85">
        <div className="wrap flex h-9 items-center justify-between gap-4 text-xs">
          <p className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-marigold-300" aria-hidden="true" />
            Every pro background-checked before their first job
          </p>
          <p className="hidden items-center gap-1.5 sm:flex">
            <Phone size={12} aria-hidden="true" /> 023-580000
            <span aria-hidden="true" className="mx-1 text-white/30">·</span>
            <MapPin size={12} aria-hidden="true" /> Damak, Jhapa
          </p>
        </div>
      </div>
      <div className="border-b border-outline bg-surface/95 backdrop-blur">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <Link to="/" className="group flex items-center gap-2.5" aria-label="Workers home">
            <span className="grid size-10 place-items-center rounded-lg bg-pine-950 text-marigold-300 transition group-hover:bg-pine-900">
              <Wrench size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="font-display block text-xl leading-none font-semibold tracking-tight">
                Workers
              </span>
              <span className="block text-[11px] font-semibold tracking-wide text-on-surface-variant">
                VERIFIED HOME SERVICES
              </span>
            </span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container hover:text-pine-950"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              className="grid size-10 cursor-pointer place-items-center rounded-md hover:bg-surface-container md:hidden"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
            {role ? (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to={homeFor(role)}>
                  <Button variant="ghost">Dashboard</Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => {
                    signOut();
                    navigate("/");
                  }}
                  aria-label={`Sign out${name ? ` ${name}` : ""}`}
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/signin">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link to="/services">
                  <Button>Book a service</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
        {open && (
          <nav aria-label="Mobile" className="border-t border-outline bg-surface px-4 py-2 md:hidden">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-semibold hover:bg-surface-container"
              >
                {n.label}
              </Link>
            ))}
            {role ? (
              <Link to={homeFor(role)} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-bold text-primary">
                Dashboard
              </Link>
            ) : (
              <Link to="/signin" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-bold text-primary">
                Sign in
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="ring-band mt-24 text-white/80">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-marigold-300 text-pine-950">
              <Wrench size={17} aria-hidden="true" />
            </span>
            <span className="font-display text-2xl font-semibold text-white">Workers</span>
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Damak&apos;s verified home-services marketplace. Every professional is
            background-checked by our team before their first job — or they never
            get one.
          </p>
          <p className="mt-4 flex items-center gap-1.5 text-sm">
            <MapPin size={15} className="text-marigold-300" aria-hidden="true" /> Damak-5, Himal Chowk, Jhapa
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <Phone size={15} className="text-marigold-300" aria-hidden="true" /> 023-580000 · 9 AM – 8 PM
          </p>
        </div>
        <nav aria-label="Services">
          <p className="text-xs font-extrabold tracking-[0.16em] text-marigold-300 uppercase">Services</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {["Plumbing", "Electrical", "Cleaning", "AC Services", "Painting", "Pest Control"].map((s) => (
              <li key={s}>
                <Link to="/services" className="transition hover:text-white">
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company">
          <p className="text-xs font-extrabold tracking-[0.16em] text-marigold-300 uppercase">Company</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/worker" className="transition hover:text-white">For workers</Link></li>
            <li><Link to="/admin" className="transition hover:text-white">Admin</Link></li>
            <li><Link to="/support" className="transition hover:text-white">Help & support</Link></li>
            <li><Link to="/rewards" className="transition hover:text-white">Rewards</Link></li>
          </ul>
        </nav>
        <nav aria-label="Policies">
          <p className="text-xs font-extrabold tracking-[0.16em] text-marigold-300 uppercase">Policies</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/terms" className="transition hover:text-white">Terms of service</Link></li>
            <li><Link to="/privacy" className="transition hover:text-white">Privacy policy</Link></li>
            <li><Link to="/cancellation" className="transition hover:text-white">Cancellation & refunds</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/15">
        <div className="wrap flex flex-col justify-between gap-2 py-5 text-xs sm:flex-row">
          <span>© 2026 Workers Marketplace · All prices in NPR</span>
          <span>Cash, eSewa & Khalti accepted on eligible bookings</span>
        </div>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
