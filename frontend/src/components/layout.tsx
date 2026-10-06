import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, MapPin, Phone, House, LayoutGrid, CalendarCheck, CircleUser, ChevronDown, LogOut } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { NoticeBell } from "./NoticeBell";
import type { Role } from "../lib/types";

/** Primary links per audience — pros and admins get portal nav, never the public marketing set. */
function primaryLinks(role: Role | null): { to: string; label: string }[] {
  if (role === "worker") {
    return [
      { to: "/worker", label: "My Jobs" },
      { to: "/support", label: "Support" },
    ];
  }
  if (role === "admin") {
    return [
      { to: "/admin", label: "Control Centre" },
      { to: "/support", label: "Support" },
    ];
  }
  return [
    { to: "/services", label: "Services" },
    { to: "/quotes/new", label: "Request a quote" },
    { to: "/support", label: "Support" },
  ];
}

/** Mobile bottom tab bar — Home, Services, Bookings, Account. */
function BottomNav() {
  const { user, role } = useAuth();
  const jobsTo = role === "admin" ? "/admin" : role === "worker" ? "/worker" : "/dashboard";
  const jobsLabel = role === "worker" ? "My Jobs" : role === "admin" ? "Admin" : "Bookings";
  const accountTo = user ? (role === "worker" || role === "admin" ? jobsTo : "/profile") : "/signin";
  const tabs = [
    { to: "/", label: "Home", Icon: House, end: true },
    ...(role === "worker" || role === "admin"
      ? []
      : [{ to: "/services", label: "Services", Icon: LayoutGrid, end: false }]),
    { to: jobsTo, label: jobsLabel, Icon: CalendarCheck, end: false },
    { to: accountTo, label: "Account", Icon: CircleUser, end: false },
  ];
  return (
    <nav aria-label="Bottom"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className={`mx-auto grid max-w-md ${tabs.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
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

/** Desktop account menu — the account page entry point on wide screens. */
function AccountMenu() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  if (!user || !role) return null;

  async function logout() {
    await signOut();
    setOpen(false);
    navigate("/");
  }

  const items: { to: string; label: string }[] =
    role === "worker"
      ? [{ to: "/worker", label: "My Jobs" }]
      : role === "admin"
        ? [{ to: "/admin", label: "Control Centre" }]
        : [
            { to: "/dashboard", label: "My bookings" },
            { to: "/profile", label: "Profile & addresses" },
            { to: "/rewards", label: "Rewards" },
          ];

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-outline bg-white py-1.5 pr-3 pl-1.5 transition hover:border-pine-800"
      >
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-pine-950 font-display text-sm font-bold text-marigold-300">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </span>
        <span className="max-w-28 truncate text-sm font-bold">{user.name}</span>
        <ChevronDown size={15} aria-hidden="true" className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="menu" aria-label="Account"
            className="elev-2 absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-outline bg-white py-1.5">
            <p className="truncate px-4 py-2 text-xs text-on-surface-variant">{user.email}</p>
            {items.map((i) => (
              <Link key={i.to} to={i.to} role="menuitem" onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-container">
                {i.label}
              </Link>
            ))}
            <div className="my-1.5 border-t border-outline/60" />
            <button role="menuitem" onClick={logout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-error transition hover:bg-error-container/50">
              <LogOut size={15} aria-hidden="true" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Mobile slide-over menu — overlays content, never pushes it. */
function MobileMenu({ links, onNavigate }: { links: { to: string; label: string }[]; onNavigate: () => void }) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  async function logout() {
    await signOut();
    onNavigate();
    navigate("/");
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Menu" aria-modal="true">
      <div className="absolute inset-0 bg-pine-950/60" onClick={onNavigate} aria-hidden="true" />
      <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline/60 px-4 py-3.5">
          <span className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-pine-950 font-display text-base font-bold text-marigold-300" aria-hidden="true">स</span>
            <span className="font-display font-bold">Sajilo Damak</span>
          </span>
          <button onClick={onNavigate} aria-label="Close menu" className="rounded-md p-2 hover:bg-surface-container">
            <X size={22} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Mobile">
          {links.map((l) => (
            <NavLink key={l.to + l.label} to={l.to} onClick={onNavigate}
              className={({ isActive }) =>
                `block rounded-md px-3 py-3 text-[15px] font-bold ${isActive ? "bg-pine-950 text-white" : "hover:bg-surface-container"}`}>
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <div className="my-2 border-t border-outline/60" />
              {(role === null || role === "customer") && (
                <>
                  <NavLink to="/dashboard" onClick={onNavigate} className="block rounded-md px-3 py-3 text-[15px] font-bold hover:bg-surface-container">My bookings</NavLink>
                  <NavLink to="/profile" onClick={onNavigate} className="block rounded-md px-3 py-3 text-[15px] font-bold hover:bg-surface-container">Profile & addresses</NavLink>
                  <NavLink to="/rewards" onClick={onNavigate} className="block rounded-md px-3 py-3 text-[15px] font-bold hover:bg-surface-container">Rewards</NavLink>
                </>
              )}
              <p className="px-3 pt-2 text-xs text-on-surface-variant">{user.name} · {user.email}</p>
              <button onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-[15px] font-bold text-error hover:bg-error-container/50">
                <LogOut size={17} aria-hidden="true" /> Sign out
              </button>
            </>
          ) : (
            <>
              <div className="my-2 border-t border-outline/60" />
              <NavLink to="/signin" onClick={onNavigate} className="block rounded-md px-3 py-3 text-[15px] font-bold hover:bg-surface-container">Sign in</NavLink>
              <NavLink to="/signup" onClick={onNavigate} className="mt-1 block rounded-md bg-pine-950 px-3 py-3 text-center text-[15px] font-bold text-white">Book a service</NavLink>
            </>
          )}
        </nav>
        <p className="border-t border-outline/60 px-4 py-3 text-center text-[11px] font-semibold text-on-surface-variant">
          Damak Municipality only · 023-580000
        </p>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const links = primaryLinks(role);

  // Close the overlay on navigation; lock body scroll while open.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
          <Link to={role === "worker" ? "/worker" : role === "admin" ? "/admin" : "/"} className="flex items-center gap-2" aria-label="Sajilo Damak home">
            <span className="grid size-9 place-items-center rounded-md bg-pine-950 font-display text-lg font-bold text-marigold-300">स</span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-bold">Sajilo Damak</span>
              <span className="block text-[11px] font-semibold text-on-surface-variant">Ramro Sewa, Sajilo Jeevan</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {links.map((l) => (
              <NavLink key={l.to + l.label} to={l.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-semibold transition hover:bg-surface-container ${isActive ? "text-primary" : ""}`}>
                {l.label}
              </NavLink>
            ))}
            {role === "customer" && (
              <NavLink to="/dashboard" className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-surface-container">Dashboard</NavLink>
            )}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <NoticeBell />
                <AccountMenu />
              </>
            ) : (
              <>
                <Link to="/signin" className="rounded-md px-3 py-2 text-sm font-bold hover:bg-surface-container">Sign in</Link>
                <Link to="/signup" className="rounded-md bg-pine-950 px-4 py-2 text-sm font-bold text-white hover:bg-pine-800">Book a service</Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 md:hidden">
            {user && <NoticeBell />}
            <button className="rounded-md p-2" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>
      {menuOpen && <MobileMenu links={links} onNavigate={() => setMenuOpen(false)} />}
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
              <li><Link to="/rewards" className="hover:underline">Rewards</Link></li>
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
            <span className="mt-2 inline-flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("sajilo-open-cookie-preferences"))}
                className="text-sm font-bold text-marigold-300 hover:underline"
              >
                Cookie preferences
              </button>
              <Link to="/cookies" className="text-sm text-white/70 hover:underline">Cookie Policy</Link>
            </span>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="wrap flex flex-col items-center justify-between gap-3 py-4 text-xs text-white/70 sm:flex-row">
            <p>© 2026 Sajilo Damak · Damak, Jhapa</p>
            <a
              href="https://dynamic-aayush38.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Aayush Neupane — portfolio"
              className="inline-flex items-center gap-2 font-semibold text-white/85 transition hover:text-marigold-300"
            >
              <img
                src="/logotrp.png"
                alt="Aayush Neupane"
                width={28}
                height={28}
                draggable={false}
              />
              <span>
                Developed by <span className="font-extrabold text-white">Aayush Neupane</span>
              </span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
