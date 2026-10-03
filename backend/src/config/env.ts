import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";

// backend/.env relative to this module; real environment variables always win.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", "..", ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4001),
  APP_URL: z.string().url().default("http://localhost:5173"),
  STAFF_URL: z.string().default(""),
  API_URL: z.string().url().default("http://localhost:4001"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  MAINTENANCE_SECRET: z.string().default(""),
  ESEWA_MERCHANT_CODE: z.string().default(""),
  ESEWA_SECRET_KEY: z.string().default(""),
  KHALTI_PUBLIC_KEY: z.string().default(""),
  KHALTI_SECRET_KEY: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const esewaEnabled = env.ESEWA_MERCHANT_CODE !== "" && env.ESEWA_SECRET_KEY !== "";
export const khaltiEnabled = env.KHALTI_PUBLIC_KEY !== "" && env.KHALTI_SECRET_KEY !== "";
