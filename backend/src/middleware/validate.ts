import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

/** Validate req.body against a Zod schema; 400 with safe messages on failure. */
export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }
    req.body = parsed.data;
    next();
  };
}
