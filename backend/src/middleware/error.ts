import type { NextFunction, Request, Response } from "express";

export function notFound(_req: Request, res: Response) {
  return res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error("[api] error", err instanceof Error ? err.message : err);
  return res.status(500).json({ error: "Internal error" });
}
