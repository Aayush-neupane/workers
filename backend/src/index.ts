import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { pool } from "./db/pool.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`[api] Sajilo Damak on :${env.PORT} (zone: Damak)`);
});

// Graceful shutdown: stop accepting, drain in-flight requests, then pool.
let shuttingDown = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[api] ${sig} — draining...`);
    server.close(async () => {
      try {
        await pool.end();
      } catch {
        /* already closed */
      }
      console.log("[api] shutdown complete");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
