import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./pool.js";

const here = dirname(fileURLToPath(import.meta.url));

// schema.sql first (idempotent IF NOT EXISTS), then numbered migrations in order.
const files = [
  "schema.sql",
  ...readdirSync(join(here, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => `migrations/${f}`),
];

for (const f of files) {
  const sql = readFileSync(join(here, f), "utf8");
  await pool.query(sql);
  console.log(`[db] applied ${f}`);
}
console.log("[db] migrate ok");
await pool.end();
