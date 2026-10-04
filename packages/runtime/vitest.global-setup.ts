import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoNewTestOutput, snapshotTestOutput } from '../../scripts/test-output-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '../..');

export default function setup() {
  // Ensure process.cwd() points at the workspace root during tests.
  // Tests resolve skill paths via path.resolve(process.cwd(), 'skills', ...)
  // which must find the skills/ directory at the repo root, not packages/runtime/.
  process.chdir(workspaceRoot);

  // Fail the run when a test leaves projection or ledger output in the repository (#28).
  const before = snapshotTestOutput();
  return () => assertNoNewTestOutput(before);
}
