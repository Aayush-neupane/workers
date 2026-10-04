import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { notFound, errorHandler } from "./middleware/error.js";
import authRoutes from "./modules/auth.routes.js";
import publicRoutes from "./modules/public.routes.js";
import accountRoutes from "./modules/account.routes.js";
import bookingRoutes from "./modules/bookings.routes.js";
import otpRoutes from "./modules/otp.routes.js";
import quoteRoutes from "./modules/quotes.routes.js";
import workerRoutes from "./modules/worker.routes.js";
import adminRoutes from "./modules/admin.routes.js";
import paymentRoutes from "./modules/payments.routes.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: [env.APP_URL], credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Admin API responses are never indexed.
  app.use("/api/admin", (_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });

  app.use(
    "/api/auth",
    rateLimit({ windowMs: 60_000, max: 60 }),
    authRoutes,
  );
  app.use("/api", rateLimit({ windowMs: 60_000, max: 600 }), publicRoutes);
  app.use("/api", accountRoutes);
  app.use("/api", bookingRoutes);
  app.use("/api", otpRoutes);
  app.use("/api", quoteRoutes);
  app.use("/api", workerRoutes);
  app.use("/api", adminRoutes);
  app.use("/api", paymentRoutes);

  app.get("/health", (_req, res) => res.json({ ok: true, zone: "Damak" }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
