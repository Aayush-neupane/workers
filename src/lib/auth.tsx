import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Role } from "./types";

interface AuthValue {
  role: Role | null;
  name: string;
  signIn: (role: Role, name: string) => void;
  signOut: () => void;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(() => {
    try {
      return (localStorage.getItem("wk-role") as Role | null) ?? null;
    } catch {
      return null;
    }
  });
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("wk-name") ?? "";
    } catch {
      return "";
    }
  });

  const signIn = useCallback((r: Role, n: string) => {
    setRole(r);
    setName(n);
    try {
      localStorage.setItem("wk-role", r);
      localStorage.setItem("wk-name", n);
    } catch {
      /* demo continues in memory */
    }
  }, []);

  const signOut = useCallback(() => {
    setRole(null);
    setName("");
    try {
      localStorage.removeItem("wk-role");
      localStorage.removeItem("wk-name");
    } catch {
      /* noop */
    }
  }, []);

  const value = useMemo(() => ({ role, name, signIn, signOut }), [role, name, signIn, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Dashboard home per role. */
export function homeFor(role: Role): string {
  if (role === "worker") return "/worker";
  if (role === "admin") return "/admin";
  return "/dashboard";
}
