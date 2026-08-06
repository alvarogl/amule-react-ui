import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiOrigin = env.VITE_DEV_API_ORIGIN || "http://127.0.0.1:4713";
  return {
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: { proxy: { "/api": apiOrigin, "/flags": apiOrigin } },
    test: { environment: "jsdom", include: ["src/**/*.test.ts"] },
  };
});
