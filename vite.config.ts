import { defineConfig } from "vite";

/** Node CLI: SSR 打包为单入口 dist/cli.js；开发用 vite-node --watch */
export default defineConfig({
  build: {
    ssr: "src/cli.ts",
    target: "node20",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: "cli.js",
      },
    },
  },
});
