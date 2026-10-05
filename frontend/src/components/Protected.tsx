import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import type { Role } from "../lib/types";

/** Route guard. Public pages stay public; role pages redirect by role.
 *  Cross-portal protection is enforced server-side — this is navigation. */
export function Protected({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, role, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return <p role="status" className="wrap py-16 text-center text-on-surface-variant">Loading…</p>;
  }
  if (!user || !role) {
    return <Navigate to="/signin" state={{ from: location.pathname + location.search + location.hash }} replace />;
  }
  if (roles && !roles.includes(role)) {
    const home = role === "admin" ? "/admin" : role === "worker" ? "/worker" : "/dashboard";
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}
