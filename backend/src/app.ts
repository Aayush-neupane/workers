import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./modules/auth.routes.js";
import publicRoutes from "./modules/public.routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const origins = [env.APP_URL, env.STAFF_URL].map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins, credentials: true }));

  const strict = rateLimit({ windowMs: 60_000, max: 60 });
  const adminGuard = rateLimit({ windowMs: 60_000, max: 300 });
  const apiGuard = rateLimit({ windowMs: 60_000, max: 600 });
  app.use("/api/auth", strict);
  app.use("/api/admin", adminGuard);
  app.use("/api", apiGuard);

  app.get("/health", (_req, res) => res.json({ ok: true, service: "workers-backend" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", authRoutes);
  app.use("/api", publicRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
