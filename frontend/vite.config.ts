import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

const visStandalone = path.resolve(
  __dirname,
  "node_modules/vis-network/standalone/esm/vis-network.js",
);

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "vis-network/standalone": visStandalone,
      "vis-network/standalone/esm/vis-network": visStandalone,
      "vis-network/standalone/esm/vis-network.js": visStandalone,
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
