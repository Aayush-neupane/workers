import type { NextFunction, Request, Response } from "express";

/** Minimal request log: method, path, status, duration. No bodies, no cookies. */
export function requestLog(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[api] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
}
