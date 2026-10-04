import { assertNoNewTestOutput, snapshotTestOutput } from '../../scripts/test-output-guard.mjs';

export default function setup() {
  // Fail the run when a test leaves projection or ledger output in the repository (#28).
  const before = snapshotTestOutput();
  return () => assertNoNewTestOutput(before);
}
