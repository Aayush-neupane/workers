import type { NextFunction, Request, Response } from "express";
import * as jose from "jose";
import { env } from "../config/env.js";
import { query } from "../db/pool.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const COOKIE = "workers_session";

export function signSession(userId: string): Promise<string> {
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(env.AUTH_SECRET));
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(env.AUTH_SECRET));
    const sub = payload.sub as string;
    const r = await query<{ id: string; email: string; name: string }>(
      `SELECT id, email, name FROM users WHERE id = $1 AND is_active = true`,
      [sub],
    );
    if (r.rowCount === 0) return res.status(401).json({ error: "Unauthorized" });
    const roles = await query<{ name: string }>(
      `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
      [sub],
    );
    req.user = { ...r.rows[0], roles: roles.rows.map((x) => x.name) };
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roles = req.user?.roles ?? [];
    if (!allowed.some((a) => roles.includes(a))) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

export const SESSION_COOKIE = COOKIE;
