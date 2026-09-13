import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/v1": {
        target: process.env.JARVIS_API_URL || (process.env.JARVIS_PORT ? `http://127.0.0.1:${process.env.JARVIS_PORT}` : "http://127.0.0.1:7330"),
        changeOrigin: true,
      },
      "/mcp": {
        target: process.env.JARVIS_MCP_URL || (process.env.JARVIS_MCP_PORT ? `http://127.0.0.1:${process.env.JARVIS_MCP_PORT}` : "http://127.0.0.1:7331"),
        changeOrigin: true,
      },
    },
  },
});
