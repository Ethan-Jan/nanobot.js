import path from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
  root: ".",
  publicDir: false,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    // 避免仅监听 IPv6 ::1 时，用 http://127.0.0.1:5173 会连不上；需要局域网访问时用 Network 地址
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:18791", changeOrigin: true },
    },
  },
});
