// Scores a tdd-refactor run against the skill's statechart from observed behaviour only:
// RED_SPEC -> GREEN_CODE -> REFACTOR (CLEAN_CODE, PERF_AUDIT) -> AUDIT_VERIFY -> COMPLETED.
// The same rules apply to both arms; self-reported signals never count as evidence of a step.
import type { RunTrace } from '../types.ts';
import {
  type Recovery,
  agentChecks,
  refusalRecoveries,
  testRuns,
  type TestRun,
  firstChange,
  lastWrite,
  rereads,
  selfReportMismatches,
  skillReads,
  taskStart,
  turnsBetween,
  writes,
} from './common.ts';

export const TARGET = 'src/auth.ts';
export const TEST = 'tests/auth.test.ts';

export interface TddScore {
  order_violations: string[];
  skipped_gates: string[];
  missing_outputs: string[];
  correct: boolean;
  acceptance: { passed: number; failed: number };
  skill_rereads: number;
  skill_reread_bytes: number;
  skill_bytes_total: number;
  recoveries: Recovery[];
  self_report_mismatches: number;
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline scoring; < 10ms per run)
 * - Complexity: O(e^2) worst case over e trace events (small e)
 * - Cyclomatic Complexity (CC): 17 (threshold <= 20) */
export function scoreTdd(trace: RunTrace): TddScore {
  const start = taskStart(trace);
  const events = trace.events.filter((e) => e.t >= start);
  const base = trace.baseline_hashes;
  const tests = testRuns(events);
  const changed = (run: TestRun, file: string) => run.hashes![file] !== base[file];
  const testChange = firstChange(events, base, TEST);
  const implChange = firstChange(events, base, TARGET);

  // RED: a failing suite run with the test changed and the target still at its original content.
  // Logged runs prove this from file hashes; direct runs fall back to edit timing.
  const red = tests.find((r) =>
    r.exit_code !== 0 && (r.hashes ? changed(r, TEST) && !changed(r, TARGET) : r.t > testChange && r.t < implChange)
  );
  const green = tests.find((r) => r.exit_code === 0 && (!red || r.t > red.t) && (r.hashes ? changed(r, TARGET) : r.t > implChange));

  const orderViolations: string[] = [];
  const recoveries: Recovery[] = [];
  if (implChange !== Infinity && (!red || implChange < red.t)) {
    orderViolations.push('implementation_before_failing_test');
    const laterRed = tests.find((r) => r.exit_code !== 0 && r.t > implChange && (!r.hashes || changed(r, TEST)));
    const recovered = !!laterRed && (!green || laterRed.t < green.t);
    recoveries.push({
      code: 'implementation_before_failing_test',
      t: implChange,
      recovered,
      turns: recovered ? turnsBetween(events, implChange, laterRed!.t) : null,
    });
  }
  if (trace.final_files[TEST] === base[TEST]) orderViolations.push('no_test_written');

  const skipped: string[] = [];
  if (!red) skipped.push('RED_SPEC: failing run before implementation');
  if (!green) skipped.push('GREEN_CODE: passing run after implementation');
  const finalTarget = trace.final_files[TARGET];
  const refactored = !!green && (events.some((e) => e.t > green.t && writes(e, TARGET)) || (!!green.hashes && finalTarget !== green.hashes[TARGET]));
  if (green && !refactored) skipped.push('REFACTOR.CLEAN_CODE: no change after green');
  const lastChange = lastWrite(events, [TARGET, TEST]);
  const isFinal = (r: { t: number; hashes?: Record<string, string | null> }) =>
    r.hashes ? r.hashes[TARGET] === finalTarget && r.hashes[TEST] === trace.final_files[TEST] : r.t > lastChange;
  if (refactored && !tests.some((r) => r.exit_code === 0 && r.t > green!.t && isFinal(r))) {
    skipped.push('REFACTOR.PERF_AUDIT: refactor not re-verified');
  }
  for (const kind of ['lint', 'typecheck', 'test']) {
    const runs = kind === 'test' ? tests : agentChecks(events, kind);
    if (!runs.some((r) => r.exit_code === 0 && isFinal(r))) skipped.push(`AUDIT_VERIFY: ${kind} on the final files`);
  }

  const missing: string[] = [];
  if (!trace.summary_present) missing.push('.docs/tdd-refactor-summary.md');
  if (trace.cell.arm === 'reactive' && trace.runtime_final_state !== 'COMPLETED') missing.push(`runtime COMPLETED (ended in ${trace.runtime_final_state})`);

  const reads = skillReads(trace);
  const again = rereads(reads);
  return {
    order_violations: orderViolations,
    skipped_gates: skipped,
    missing_outputs: missing,
    correct: trace.acceptance.failed === 0 && trace.acceptance.passed > 0 && trace.end_checks.test === 0 && trace.end_checks.lint === 0 && trace.end_checks.typecheck === 0,
    acceptance: trace.acceptance,
    skill_rereads: again.count,
    skill_reread_bytes: again.bytes,
    skill_bytes_total: reads.reduce((sum, r) => sum + r.bytes, 0),
    recoveries: [...recoveries, ...refusalRecoveries(trace)],
    self_report_mismatches: selfReportMismatches(trace),
  };
}
