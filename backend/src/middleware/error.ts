import type { NextFunction, Request, Response } from "express";

/** 404 JSON + generic 500 (never leaks internals). */
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error("[api]", err instanceof Error ? err.message : err);
  // Client errors from body parsing etc. keep their status (never internals).
  const status = (err as { status?: unknown; statusCode?: unknown }).status ??
    (err as { statusCode?: unknown }).statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    const message = status === 413 ? "Request too large"
      : status === 429 ? "Too many requests — slow down"
      : "Invalid request";
    return res.status(status).json({ error: message });
  }
  res.status(500).json({ error: "Something went wrong" });
}
