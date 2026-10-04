import type { NextFunction, Request, Response } from "express";

/** 404 JSON + generic 500 (never leaks internals). */
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error("[api]", err instanceof Error ? err.message : err);
  res.status(500).json({ error: "Something went wrong" });
}
