import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Listen on all local interfaces (IPv4 + IPv6). The default `localhost`
  // binding only covers ::1 on some machines, so browsers that resolve
  // localhost to 127.0.0.1 (Brave does this more strictly than Chrome)
  // fail to connect at all.
  server: { host: true, port: 5173, strictPort: true },
});
