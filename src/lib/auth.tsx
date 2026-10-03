import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, onUnauthorized, post } from "./api";
import type { Role } from "./types";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

interface AuthValue {
  user: SessionUser | null;
  role: Role | null;
  ready: boolean;
  authError: string;
  signIn: (email: string, password: string) => Promise<Role | null>;
  signUp: (name: string, phone: string, email: string, password: string) => Promise<Role | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (name: string, phone: string) => Promise<boolean>;
}

const AuthCtx = createContext<AuthValue | null>(null);

function toRole(roles: string[]): Role | null {
  if (roles.includes("ADMIN")) return "admin";
  if (roles.includes("WORKER")) return "worker";
  if (roles.includes("CUSTOMER")) return "customer";
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: SessionUser }>("/api/auth/me");
      setUser(me.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    onUnauthorized(() => setUser(null));
    void refresh();
    return () => onUnauthorized(null);
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError("");
    try {
      await post("/api/auth/login", { email, password });
      const me = await api<{ user: SessionUser }>("/api/auth/me");
      setUser(me.user);
      setReady(true);
      return toRole(me.user.roles);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign in failed");
      return null;
    }
  }, []);

  const signUp = useCallback(async (name: string, phone: string, email: string, password: string) => {
    setAuthError("");
    try {
      await post("/api/auth/register", { name, phone, email, password });
      const me = await api<{ user: SessionUser }>("/api/auth/me");
      setUser(me.user);
      setReady(true);
      return toRole(me.user.roles);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign up failed");
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await post("/api/auth/logout", {});
    } catch {
      /* session already gone */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      role: user ? toRole(user.roles) : null,
      ready,
      authError,
      signIn,
      signUp,
      signOut,
      refresh,
      updateProfile: async (name: string, phone: string) => {
        try {
          await api("/api/auth/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone }),
          });
          await refresh();
          return true;
        } catch {
          return false;
        }
      },
    }),
    [user, ready, authError, signIn, signUp, signOut, refresh],
  );
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
