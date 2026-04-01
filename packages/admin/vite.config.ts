import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
  root: ".",
  publicDir: false,
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:18791", changeOrigin: true },
    },
  },
});
