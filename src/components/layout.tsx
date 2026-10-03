import type { ReactNode } from "react";
import { MapPin, Phone, Wrench } from "lucide-react";
import { Button } from "./ui";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/track", label: "Track booking" },
  { href: "/rewards", label: "Rewards" },
  { href: "/support", label: "Support" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-outline bg-surface/95 backdrop-blur">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2 font-bold" aria-label="Workers home">
          <span className="grid size-9 place-items-center rounded-md bg-primary text-white">
            <Wrench size={18} aria-hidden="true" />
          </span>
          <span className="text-lg tracking-tight">Workers</span>
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href="/signin">
            <Button variant="ghost">Sign in</Button>
          </a>
          <a href="/services" className="hidden sm:block">
            <Button>Book a service</Button>
          </a>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-outline bg-surface-container/60">
      <div className="wrap grid gap-10 py-12 md:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 font-bold">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-white">
              <Wrench size={16} aria-hidden="true" />
            </span>
            Workers
          </p>
          <p className="mt-3 text-sm text-on-surface-variant">
            Nepal&apos;s verified home-services marketplace. Every professional background-checked
            by our team before their first job.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-on-surface-variant">
            <MapPin size={15} aria-hidden="true" /> Jawalakhel, Lalitpur
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-on-surface-variant">
            <Phone size={15} aria-hidden="true" /> 01-5900000
          </p>
        </div>
        <nav aria-label="Services">
          <p className="text-sm font-bold">Services</p>
          <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
            {["Plumbing", "Electrical", "Cleaning", "AC Services", "Painting"].map((s) => (
              <li key={s}>
                <a href="/services" className="hover:text-primary">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company">
          <p className="text-sm font-bold">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
            <li><a href="/worker" className="hover:text-primary">For workers</a></li>
            <li><a href="/admin" className="hover:text-primary">Admin</a></li>
            <li><a href="/support" className="hover:text-primary">Help & support</a></li>
            <li><a href="/rewards" className="hover:text-primary">Rewards</a></li>
          </ul>
        </nav>
        <nav aria-label="Policies">
          <p className="text-sm font-bold">Policies</p>
          <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
            <li><a href="/terms" className="hover:text-primary">Terms of service</a></li>
            <li><a href="/privacy" className="hover:text-primary">Privacy policy</a></li>
            <li><a href="/cancellation" className="hover:text-primary">Cancellation & refunds</a></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-outline">
        <div className="wrap flex flex-col justify-between gap-2 py-4 text-xs text-on-surface-variant sm:flex-row">
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
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
