import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./pool.js";

const here = dirname(fileURLToPath(import.meta.url));

// schema.sql first (idempotent), then numbered migrations in order.
// Each file runs inside its own transaction and is recorded in
// schema_migrations, so re-runs skip applied files and a mid-file failure
// rolls back instead of leaving half-applied DDL.
const files = [
  "schema.sql",
  ...readdirSync(join(here, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => `migrations/${f}`),
];

await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`);

for (const f of files) {
  const done = await pool.query(`SELECT 1 FROM schema_migrations WHERE version = $1`, [f]);
  if ((done.rowCount ?? 0) > 0) {
    console.log(`[db] skipped ${f} (already applied)`);
    continue;
  }
  const sql = readFileSync(join(here, f), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(`INSERT INTO schema_migrations(version) VALUES ($1)`, [f]);
    await client.query("COMMIT");
    console.log(`[db] applied ${f}`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
console.log("[db] migrate ok");
await pool.end();
