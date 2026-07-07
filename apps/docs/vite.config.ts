import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import mdx from 'fumadocs-mdx/vite';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(rootDir, '../..');

export default defineConfig({
  plugins: [mdx(), tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@templara/core': path.resolve(repoRoot, 'packages/core/src/index.ts'),
      '@templara/renderer': path.resolve(repoRoot, 'packages/renderer/src/index.ts'),
      '@templara/react-renderer': path.resolve(repoRoot, 'packages/react-renderer/src/index.ts'),
      '@templara/templates': path.resolve(repoRoot, 'packages/templates/src/index.ts'),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
    port: 3001,
  },
});
