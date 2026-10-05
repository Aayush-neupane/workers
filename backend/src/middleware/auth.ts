import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { env, isProd } from "../config/env.js";
import { query } from "../db/pool.js";

export const SESSION_COOKIE = "sajilo_session";

const secret = new TextEncoder().encode(env.AUTH_SECRET);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string; email: string; name: string; phone: string; roles: string[];
        onboarded: boolean; permissions?: string[]; isSuperAdmin?: boolean;
      };
    }
  }
}

export async function signSession(userId: string, version?: number): Promise<string> {
  const jwt = new SignJWT({ sub: userId, ...(version !== undefined ? { pca: version } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d");
  return jwt.sign(secret);
}

export function setSession(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE,
    secure: env.COOKIE_SAMESITE === "none" ? true : isProd,
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: 7 * 24 * 3600 * 1000,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE,
    secure: env.COOKIE_SAMESITE === "none" ? true : isProd,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  });
}

/** Effective permission set: role grants + per-user staff grants. */
export async function effectivePermissions(userId: string): Promise<string[]> {
  const r = await query<{ name: string }>(
    `SELECT p.name FROM permissions p WHERE p.id IN (
       SELECT rp.permission_id FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1
       UNION
       SELECT up.permission_id FROM user_permissions up WHERE up.user_id = $1
     )`,
    [userId],
  );
  return r.rows.map((x) => x.name);
}

export function isSuperAdmin(roles: string[]): boolean {
  return roles.includes("ADMIN");
}

/** Re-fetch user + roles per request; a cookie alone authorizes nothing. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return res.status(401).json({ error: "Sign in required" });
  try {
    const { payload } = await jwtVerify(token, secret);
    const sub = payload.sub as string;
    const r = await query<{ id: string; email: string; name: string; phone: string; is_active: boolean; onboarded: boolean; password_changed_at: string }>(
      `SELECT id, email, name, phone, is_active, onboarded, password_changed_at FROM users WHERE id = $1`,
      [sub],
    );
    if (r.rowCount === 0 || r.rows[0].is_active === false) {
      return res.status(401).json({ error: "Account unavailable" });
    }
    // Sessions issued before the last password (re)set are dead — stolen
    // tokens don't survive a reset. Millisecond precision so a reset in the
    // same second still kills. Tokens without a version (pre-feature) are
    // still honored so nobody is logged out by the deploy.
    const tokenVersion = typeof payload.pca === "number" ? payload.pca : null;
    const currentVersion = new Date(r.rows[0].password_changed_at).getTime();
    if (tokenVersion !== null && tokenVersion < currentVersion) {
      return res.status(401).json({ error: "Session expired" });
    }
    const roles = await query<{ name: string }>(
      `SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1`,
      [sub],
    );
    const roleNames = roles.rows.map((x) => x.name);
    req.user = {
      id: r.rows[0].id,
      email: r.rows[0].email,
      name: r.rows[0].name,
      phone: r.rows[0].phone,
      roles: roleNames,
      onboarded: r.rows[0].onboarded,
      isSuperAdmin: isSuperAdmin(roleNames),
    };
    next();
  } catch {
    return res.status(401).json({ error: "Session expired" });
  }
}

/** Role gate — use after requireAuth. */
export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roles = req.user?.roles ?? [];
    if (!allowed.some((a) => roles.includes(a))) {
      return res.status(403).json({ error: "Forbidden for your role" });
    }
    next();
  };
}

/** Super-admin gate — only ADMIN role holders (staff.manage implied). */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const roles = req.user?.roles ?? [];
  if (!isSuperAdmin(roles)) {
    return res.status(403).json({ error: "Super-admin only" });
  }
  next();
}

/** Capability gate backed by role_permissions + user_permissions.
 *  Super-admins (ADMIN role) bypass so they are never locked out. */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Sign in required" });
      if (isSuperAdmin(req.user?.roles ?? [])) return next();
      const r = await query(
        `SELECT 1 FROM permissions p WHERE p.name = $2 AND p.id IN (
           SELECT rp.permission_id FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           WHERE ur.user_id = $1
           UNION
           SELECT up.permission_id FROM user_permissions up WHERE up.user_id = $1
         ) LIMIT 1`,
        [userId, permission],
      );
      if ((r.rowCount ?? 0) === 0) return res.status(403).json({ error: "Missing permission" });
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Pass if the caller holds ANY of the listed permissions (super-admin bypasses). */
export function requireAnyPermission(...permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Sign in required" });
      if (isSuperAdmin(req.user?.roles ?? [])) return next();
      const r = await query(
        `SELECT 1 FROM permissions p WHERE p.name = ANY ($2::text[]) AND p.id IN (
           SELECT rp.permission_id FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           WHERE ur.user_id = $1
           UNION
           SELECT up.permission_id FROM user_permissions up WHERE up.user_id = $1
         ) LIMIT 1`,
        [userId, permissions],
      );
      if ((r.rowCount ?? 0) === 0) return res.status(403).json({ error: "Missing permission" });
      next();
    } catch (e) {
      next(e);
    }
  };
}
