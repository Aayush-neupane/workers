import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

pool.on("error", (err) => {
  console.error("[db] pool error", err);
});

export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  const res = await pool.query(text, params as unknown[]);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}
