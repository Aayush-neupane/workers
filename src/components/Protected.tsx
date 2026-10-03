import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { Role } from "../lib/types";

/** Password + role gate. Backend enforces the same rules; this keeps UX honest. */
export function Protected({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, role, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="wrap py-16" role="status">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-1/3 rounded bg-surface-container-high" />
          <div className="h-4 w-2/3 rounded bg-surface-container" />
        </div>
        <p className="sr-only">Checking your session…</p>
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate
        to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }
  if (roles && (!role || !roles.includes(role))) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
