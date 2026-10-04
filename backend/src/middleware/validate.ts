import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

/** Validate req.body against a Zod schema; 400 with field details on failure. */
export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    }
    req.body = parsed.data;
    next();
  };
}
