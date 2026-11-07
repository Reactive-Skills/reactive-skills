import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'next/font/google': fileURLToPath(new URL('./tests/stubs/nextFontGoogle.js', import.meta.url)),
    },
  },
  // Next compiles JSX in .js files, so tests that import pages need the same; the tsx loader
  // also lets tests import the AXI CLI's TypeScript sources.
  esbuild: { loader: 'tsx', include: /src\/.*\.(jsx?|ts)$/, exclude: [], jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
