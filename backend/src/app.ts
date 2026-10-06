import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env, isProd } from "./config/env.js";
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
import pushRoutes from "./modules/push.routes.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", env.TRUST_PROXY);
  app.use(helmet({
    contentSecurityPolicy: isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    } : false,
    // HSTS on plain-http localhost is noise (browsers ignore it there) and
    // risks pinning localhost to https in odd setups — prod only.
    hsts: isProd ? undefined : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }));
  const origins = [env.APP_URL, ...env.ADDITIONAL_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)];
  app.use(cors({ origin: origins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Admin API responses are never indexed.
  app.use("/api/admin", (_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });

  // CSRF: cookie-authenticated mutations must arrive as JSON. A cross-site
  // <form> or fetch without CORS preflight cannot set
  // Content-Type: application/json, so forged writes die here even in
  // browsers that don't enforce SameSite.
  app.use("/api", (req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
        !(req.headers["content-type"] ?? "").includes("application/json")) {
      return res.status(415).json({ error: "JSON requests only" });
    }
    next();
  });

  // Credential-guessing endpoints get their own tight buckets — the shared
  // /api/auth bucket is too generous for password spraying.
  const loginLimiter = rateLimit({ windowMs: 60_000, max: 20, message: { error: "Too many attempts — wait a minute" } });
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/push/test", rateLimit({ windowMs: 60_000, max: 5 }));
  app.use("/api/admin/notifications/broadcast", rateLimit({ windowMs: 3_600_000, max: 10 }));
  app.use(
    "/api/auth",
    rateLimit({ windowMs: 60_000, max: 60 }),
    authRoutes,
  );
  // Mount order matters: every router below uses route-level guards only, so
  // requests safely fall through non-matching routers to the right handler.
  // One baseline limiter for the whole API (OTP guessing, ticket and device
  // spam all live behind these mounts) — applied once so each request
  // counts once.
  app.use("/api", rateLimit({ windowMs: 60_000, max: 600 }));
  app.use("/api", publicRoutes);
  app.use("/api", paymentRoutes);
  app.use("/api", pushRoutes);
  app.use("/api", accountRoutes);
  app.use("/api", bookingRoutes);
  app.use("/api", otpRoutes);
  app.use("/api", quoteRoutes);
  app.use("/api", workerRoutes);
  app.use("/api", adminRoutes);

  app.get("/health", (_req, res) => res.json({ ok: true, zone: "Damak" }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
