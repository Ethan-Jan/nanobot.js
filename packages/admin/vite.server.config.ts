import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    ssr: true,
    target: "node20",
    outDir: "dist-server",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./server/index.ts", import.meta.url)),
      output: {
        entryFileNames: "server.js",
      },
    },
  },
});
