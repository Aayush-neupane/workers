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
      user?: { id: string; email: string; name: string; roles: string[] };
    }
  }
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export function setSession(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 7 * 24 * 3600 * 1000,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Re-fetch user + roles per request; a cookie alone authorizes nothing. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return res.status(401).json({ error: "Sign in required" });
  try {
    const { payload } = await jwtVerify(token, secret);
    const sub = payload.sub as string;
    const r = await query<{ id: string; email: string; name: string; is_active: boolean }>(
      `SELECT id, email, name, is_active FROM users WHERE id = $1`,
      [sub],
    );
    if (r.rowCount === 0 || r.rows[0].is_active === false) {
      return res.status(401).json({ error: "Account unavailable" });
    }
    const roles = await query<{ name: string }>(
      `SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1`,
      [sub],
    );
    req.user = {
      id: r.rows[0].id,
      email: r.rows[0].email,
      name: r.rows[0].name,
      roles: roles.rows.map((x) => x.name),
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

/** Capability gate backed by role_permissions. */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Sign in required" });
    const r = await query(
      `SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1 AND p.name = $2 LIMIT 1`,
      [userId, permission],
    );
    if ((r.rowCount ?? 0) === 0) return res.status(403).json({ error: "Missing permission" });
    next();
  };
}
