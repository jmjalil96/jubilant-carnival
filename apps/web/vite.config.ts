import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

import { parseViteRuntimeEnv } from "./vite.env.js";

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  const { API_PROXY_TARGET } = parseViteRuntimeEnv(loadedEnv);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: API_PROXY_TARGET,
          changeOrigin: true,
        },
      },
    },
  };
});
