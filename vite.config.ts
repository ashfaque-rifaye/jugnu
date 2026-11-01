import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const API_PORT = Number(process.env.API_PORT || 8788);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MapLibre's tile worker is its own module (bundled via ?worker&url in RealMap.tsx).
  worker: { format: "es" },
  test: { env: { JUGNU_OFFLINE: "1" } },
  server: {
    port: Number(process.env.PORT) || 5190,
    proxy: { "/api": `http://localhost:${API_PORT}` },
  },
});
