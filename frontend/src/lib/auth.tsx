import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, onUnauthorized, post } from "./api";
import type { Role } from "./types";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  roles: string[];
  onboarded: boolean;
  permissions?: string[];
  isSuperAdmin?: boolean;
}

interface AuthValue {
  user: SessionUser | null;
  role: Role | null;
  ready: boolean;
  authError: string;
  permissions: string[];
  isSuperAdmin: boolean;
  can: (perm: string) => boolean;
  signIn: (email: string, password: string) => Promise<SessionUser | null>;
  signUp: (name: string, phone: string, email: string, password: string, referralCode?: string) => Promise<SessionUser | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function toRole(roles: string[]): Role | null {
  if (roles.includes("ADMIN")) return "admin";
  if (roles.includes("SUB_ADMIN")) return "admin"; // staff use the admin portal, gated by permissions
  if (roles.includes("WORKER")) return "worker";
  if (roles.includes("CUSTOMER")) return "customer";
  return null;
}

export function homeFor(role: Role): string {
  if (role === "worker") return "/worker";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    onUnauthorized(() => setUser(null));
    api<{ user: SessionUser }>("/api/auth/me")
      .then((me) => setUser(me.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
    return () => onUnauthorized(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError("");
    try {
      await post("/api/auth/login", { email, password });
      const me = await api<{ user: SessionUser }>("/api/auth/me");
      setUser(me.user);
      return me.user;
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign in failed");
      return null;
    }
  }, []);

  const signUp = useCallback(async (name: string, phone: string, email: string, password: string, referralCode?: string) => {
    setAuthError("");
    try {
      await post("/api/auth/register", { name, phone, email, password, referralCode: referralCode || undefined });
      const me = await api<{ user: SessionUser }>("/api/auth/me");
      setUser(me.user);
      return me.user;
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign up failed");
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await post("/api/auth/logout", {});
    } catch {
      /* already gone */
    }
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: SessionUser }>("/api/auth/me");
      setUser(me.user);
    } catch {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthValue>(() => {
    const permissions = user?.permissions ?? [];
    const superAdmin = user?.isSuperAdmin ?? user?.roles.includes("ADMIN") ?? false;
    const can = (perm: string) => superAdmin || permissions.includes(perm);
    return {
      user, role: user ? toRole(user.roles) : null, ready, authError,
      permissions, isSuperAdmin: superAdmin, can,
      signIn, signUp, signOut, refresh,
    };
  },
    [user, ready, authError, signIn, signUp, signOut, refresh],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
