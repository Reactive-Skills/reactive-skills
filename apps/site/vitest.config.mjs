import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Next compiles JSX in .js files, so tests that import pages need the same.
  esbuild: { loader: 'jsx', include: /src\/.*\.jsx?$/, exclude: [], jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
