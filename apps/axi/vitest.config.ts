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
    globalSetup: path.resolve(__dirname, 'vitest.global-setup.ts'),
    include: ['tests/**/*.test.ts'],
    // The first test in a file pays for a cold import of the runtime, which can pass 5s on Windows under load.
    testTimeout: 20_000,
  },
});
