import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env, isProd } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { requestLog } from "./middleware/requestLog.js";
import authRoutes from "./modules/auth.routes.js";
import publicRoutes from "./modules/public.routes.js";
import bookingRoutes from "./modules/bookings.routes.js";
import paymentRoutes from "./modules/payments.routes.js";
import workerRoutes from "./modules/worker.routes.js";
import documentRoutes from "./modules/documents.routes.js";
import adminWorkersRoutes from "./modules/admin-workers.routes.js";
import adminCatalogRoutes from "./modules/admin-catalog.routes.js";
import adminOpsRoutes from "./modules/admin-ops.routes.js";
import adminInvitesRoutes from "./modules/admin-invites.routes.js";
import adminBookingsRoutes from "./modules/admin-bookings.routes.js";
import adminFinanceRoutes from "./modules/admin-finance.routes.js";
import adminRewardsRoutes from "./modules/admin-rewards.routes.js";
import adminSupportRoutes from "./modules/admin-support.routes.js";
import adminReportsRoutes from "./modules/admin-reports.routes.js";
import accountRoutes from "./modules/account.routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const origins = [env.APP_URL, env.STAFF_URL].map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins, credentials: true }));
  if (!isProd) app.use(requestLog);

  const strict = rateLimit({ windowMs: 60_000, max: 60 });
  const adminGuard = rateLimit({ windowMs: 60_000, max: 300 });
  const apiGuard = rateLimit({ windowMs: 60_000, max: 600 });
  app.use("/api/auth", strict);
  app.use("/api/admin", adminGuard);
  app.use("/api", apiGuard);

  app.get("/health", (_req, res) => res.json({ ok: true, service: "workers-backend" }));
  app.use("/api/auth", authRoutes);
  app.use("/api", publicRoutes);
  app.use("/api", bookingRoutes);
  app.use("/api", paymentRoutes);
  app.use("/api", workerRoutes);
  app.use("/api", documentRoutes);
  app.use("/api", accountRoutes);
  // Admin routers share the /api prefix with full /admin/* paths inside;
  // guards are per-route (never router-level) so teams don't 403 each other.
  app.use("/api", adminWorkersRoutes);
  app.use("/api", adminCatalogRoutes);
  app.use("/api", adminOpsRoutes);
  app.use("/api", adminInvitesRoutes);
  app.use("/api", adminBookingsRoutes);
  app.use("/api", adminFinanceRoutes);
  app.use("/api", adminRewardsRoutes);
  app.use("/api", adminSupportRoutes);
  app.use("/api", adminReportsRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
