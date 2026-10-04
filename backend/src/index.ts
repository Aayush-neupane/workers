import { env } from "./config/env.js";
import { createApp } from "./app.js";

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`[api] Sajilo Damak on :${env.PORT} (zone: Damak)`);
});
