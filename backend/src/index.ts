import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`[api] workers-backend on :${env.PORT}`);
});
