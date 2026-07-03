import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(rootDir, "../..");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@templara/editor": path.resolve(repoRoot, "packages/editor/src/index.ts")
    }
  },
  server: {
    fs: {
      allow: [repoRoot]
    }
  }
});
