import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().default("http://localhost:5173"),
  API_URL: z.string().default("http://localhost:4001"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be 32+ chars"),
  // Split-domain deploys (app on one host, API on another) need cross-site
  // cookies: COOKIE_SAMESITE=none + COOKIE_DOMAIN=.example.com. Same-origin
  // deploys keep the default lax.
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: z.string().max(120).default(""),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  // Comma-separated extra origins allowed CORS access (preview deploys,
  // portal subdomains). APP_URL is always allowed.
  ADDITIONAL_ORIGINS: z.string().max(1000).default(""),
  ESEWA_MERCHANT_CODE: z.string().default(""),
  ESEWA_SECRET_KEY: z.string().default(""),
  KHALTI_PUBLIC_KEY: z.string().default(""),
  KHALTI_SECRET_KEY: z.string().default(""),
  VAPID_PUBLIC_KEY: z.string().default(""),
  VAPID_PRIVATE_KEY: z.string().default(""),
  VAPID_SUBJECT: z.string().default("mailto:support@sajilodamak.com"),
});

export const env = envSchema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
export const onlinePaymentsEnabled =
  Boolean(env.ESEWA_MERCHANT_CODE || env.KHALTI_SECRET_KEY);
