import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname);

export default defineConfig({
  root: appRoot,
  test: {
    root: appRoot,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
