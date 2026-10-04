import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, MapPin, Phone, House, LayoutGrid, CalendarCheck, CircleUser } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { homeFor } from "../lib/auth";

/** Mobile bottom tab bar — Home, Services, My Jobs, Account. */
function BottomNav() {
  const { user, role } = useAuth();
  const jobsTo = role === "admin" ? "/admin" : role === "worker" ? "/worker" : "/dashboard";
  const accountTo = user ? "/profile" : "/signin";
  const tabs = [
    { to: "/", label: "Home", Icon: House, end: true },
    { to: "/services", label: "Services", Icon: LayoutGrid, end: false },
    { to: jobsTo, label: role === "worker" ? "My Jobs" : role === "admin" ? "Admin" : "Bookings", Icon: CalendarCheck, end: false },
    { to: accountTo, label: "Account", Icon: CircleUser, end: false },
  ];
  return (
    <nav aria-label="Bottom"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="grid grid-cols-4">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink key={label} to={to} end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold transition active:scale-95 ${
                isActive ? "text-primary" : "text-on-surface-variant"
              }`}>
            <Icon size={21} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function logout() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">
        Skip to content
      </a>
      <div className="bg-pine-950 text-white">
        <div className="wrap flex items-center justify-center gap-4 py-1.5 text-[11px] font-semibold tracking-wide">
          <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden="true" /> Damak Municipality only</span>
          <span className="inline-flex items-center gap-1"><Phone size={12} aria-hidden="true" /> 023-580000</span>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-outline/60 bg-surface/95 backdrop-blur">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-md bg-pine-950 font-display text-lg font-bold text-marigold-300">स</span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-bold">Sajilo Damak</span>
              <span className="block text-[11px] font-semibold text-on-surface-variant">Ramro Sewa, Sajilo Jeevan</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            <NavLink to="/services" className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-surface-container">Services</NavLink>
            <NavLink to="/quotes/new" className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-surface-container">Request a quote</NavLink>
            <NavLink to="/support" className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-surface-container">Support</NavLink>
            {role && <NavLink to={homeFor(role)} className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-surface-container">Dashboard</NavLink>}
            {role === "admin" && <NavLink to="/admin" className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-surface-container">Admin</NavLink>}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <span className="text-sm text-on-surface-variant">{user.name}</span>
                <button onClick={logout} className="rounded-md border border-outline px-3 py-2 text-sm font-bold hover:border-pine-800">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/signin" className="rounded-md px-3 py-2 text-sm font-bold hover:bg-surface-container">Sign in</Link>
                <Link to="/signup" className="rounded-md bg-pine-950 px-4 py-2 text-sm font-bold text-white hover:bg-pine-800">Book a service</Link>
              </>
            )}
          </div>
          <button className="rounded-md p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-outline/60 px-4 py-3 md:hidden" aria-label="Mobile">
            <div className="grid gap-1 text-sm font-semibold">
              <NavLink to="/services" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 hover:bg-surface-container">Services</NavLink>
              <NavLink to="/quotes/new" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 hover:bg-surface-container">Request a quote</NavLink>
              <NavLink to="/support" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 hover:bg-surface-container">Support</NavLink>
              {role && <NavLink to={homeFor(role)} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 hover:bg-surface-container">Dashboard</NavLink>}
              {user ? (
                <button onClick={() => { void logout(); setOpen(false); }} className="rounded-md px-3 py-2.5 text-left hover:bg-surface-container">Sign out ({user.name})</button>
              ) : (
                <>
                  <NavLink to="/signin" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 hover:bg-surface-container">Sign in</NavLink>
                  <NavLink to="/signup" onClick={() => setOpen(false)} className="rounded-md bg-pine-950 px-3 py-2.5 text-white">Book a service</NavLink>
                </>
              )}
            </div>
          </nav>
        )}
      </header>
      <main id="content" className="flex-1 pb-20 md:pb-0">{children}</main>
      <BottomNav />
      <footer className="mt-12 border-t border-outline/60 bg-pine-950 text-white">
        <div className="wrap grid gap-8 py-10 md:grid-cols-4">
          <div>
            <p className="font-display text-lg font-bold">Sajilo Damak</p>
            <p className="mt-1 text-sm text-white/70">Verified pros for Damak homes and businesses. Damak-5, Himal Chowk.</p>
          </div>
          <div>
            <p className="text-xs font-extrabold tracking-widest text-marigold-300 uppercase">Marketplace</p>
            <ul className="mt-2 space-y-1.5 text-sm text-white/80">
              <li><Link to="/services" className="hover:underline">All services</Link></li>
              <li><Link to="/quotes/new" className="hover:underline">Request a quote</Link></li>
              <li><Link to="/support" className="hover:underline">Support</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-extrabold tracking-widest text-marigold-300 uppercase">Trust</p>
            <ul className="mt-2 space-y-1.5 text-sm text-white/80">
              <li><Link to="/cookies" className="hover:underline">Cookie Policy</Link></li>
              <li><Link to="/privacy" className="hover:underline">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:underline">Terms</Link></li>
              <li><Link to="/cancellation" className="hover:underline">Cancellation</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-extrabold tracking-widest text-marigold-300 uppercase">Coverage</p>
            <p className="mt-2 text-sm text-white/80">Damak Municipality, wards 1–10. New areas open only by admin announcement — never silently.</p>
            <Link to="/privacy#preferences" className="mt-2 inline-block text-sm font-bold text-marigold-300 hover:underline">Cookie preferences</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
