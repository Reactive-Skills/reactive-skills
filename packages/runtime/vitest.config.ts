import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve to workspace root (two levels up from packages/runtime/)
const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  root: workspaceRoot,
  test: {
    root: workspaceRoot,
    globalSetup: path.resolve(__dirname, 'vitest.global-setup.ts'),
    include: ['packages/runtime/tests/**/*.test.ts'],
    fileParallelism: false,
  },
});
