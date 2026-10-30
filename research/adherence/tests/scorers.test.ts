// Given an observed trace / When scored / Then the statechart findings. Traces are synthetic and minimal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreTdd } from '../src/scorers/tdd.ts';
import { scoreWorkflow } from '../src/scorers/workflow.ts';
import type { Cell, RunTrace, TraceEvent } from '../src/types.ts';

const BASE = { 'src/auth.ts': 'a0', 'tests/auth.test.ts': 't0' };
let clock = 0;
const at = () => (clock += 10);
const turn = (): TraceEvent => ({ t: at(), kind: 'assistant_turn', message_id: String(clock), context_tokens: 1000, output_tokens: 10 });
const edit = (file: string): TraceEvent => ({ t: at(), kind: 'tool', tool: 'Edit', target: file, is_error: false, result_bytes: 10, tool_use_id: String(clock) });
const check = (kind: string, exit: number, hashes: Record<string, string>): TraceEvent => ({ t: at(), kind: 'check', check: kind, exit_code: exit, source: 'agent', hashes });
const direct = (fail: number): TraceEvent => ({ t: at(), kind: 'tool', tool: 'Bash', command: 'node --test tests/auth.test.ts', is_error: false, result_bytes: 50, tool_use_id: String(clock), test_summary: { pass: 5, fail } });

function trace(cell: Partial<Cell>, events: TraceEvent[], extra: Partial<RunTrace> = {}): RunTrace {
  return {
    cell: { id: 'x', question: 1, task: 'tdd', arm: 'flat', pressure: 'immediate', ...cell },
    rep: 1,
    model: 'm',
    claude_code_version: 'v',
    filler_seed: 1,
    status: 'completed',
    context_tokens_at_task: 0,
    events: [{ t: 0, kind: 'user_message', role: 'task', bytes: 10 }, ...events],
    usage: { model_usage_keys: ['m'], cost_usd: 0, input_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, output_tokens: 0, model_turns: 0, wall_clock_ms: 0 },
    baseline_hashes: BASE,
    final_files: {},
    acceptance: { passed: 4, failed: 0 },
    end_checks: { test: 0, lint: 0, typecheck: 0 },
    summary_present: true,
    runtime_final_state: null,
    ...extra,
  };
}

test('canonical red-green-refactor-audit path has no findings', () => {
  clock = 0;
  const score = scoreTdd(
    trace({}, [
      turn(), edit('tests/auth.test.ts'), check('test', 1, { 'src/auth.ts': 'a0', 'tests/auth.test.ts': 't1' }),
      turn(), edit('src/auth.ts'), check('test', 0, { 'src/auth.ts': 'a1', 'tests/auth.test.ts': 't1' }),
      turn(), edit('src/auth.ts'), check('test', 0, { 'src/auth.ts': 'a2', 'tests/auth.test.ts': 't1' }),
      check('lint', 0, {}), check('typecheck', 0, {}), check('test', 0, {}),
    ])
  );
  assert.deepEqual(score.order_violations, []);
  assert.deepEqual(score.skipped_gates, []);
  assert.deepEqual(score.missing_outputs, []);
  assert.equal(score.correct, true);
});

test('implementation before a failing test is an order violation and skips RED', () => {
  clock = 0;
  const score = scoreTdd(
    trace({}, [turn(), edit('src/auth.ts'), edit('tests/auth.test.ts'), check('test', 0, { 'src/auth.ts': 'a1', 'tests/auth.test.ts': 't1' })], { summary_present: false })
  );
  assert.deepEqual(score.order_violations, ['implementation_before_failing_test']);
  assert.ok(score.skipped_gates.includes('RED_SPEC: failing run before implementation'));
  assert.deepEqual(score.missing_outputs, ['.docs/tdd-refactor-summary.md']);
  assert.equal(score.recoveries[0].recovered, false);
});

test('recovery is counted when a failing run follows the violation before green', () => {
  clock = 0;
  const score = scoreTdd(
    trace({}, [turn(), edit('src/auth.ts'), turn(), edit('tests/auth.test.ts'), turn(), direct(1), turn(), direct(0)])
  );
  assert.equal(score.recoveries[0].recovered, true);
  assert.equal(score.recoveries[0].turns, 2);
});

test('logged file hashes prove red and green even when the edits were not visible as tool calls', () => {
  clock = 0;
  const hidden = (): TraceEvent => ({ t: at(), kind: 'tool', tool: 'Bash', command: "python3 - <<'EOF' [300 bytes]\nEOF", writes: [], is_error: false, result_bytes: 0, tool_use_id: String(clock) });
  const score = scoreTdd(
    trace({}, [hidden(), check('test', 1, { 'src/auth.ts': 'a0', 'tests/auth.test.ts': 't1' }), hidden(), check('test', 0, { 'src/auth.ts': 'a1', 'tests/auth.test.ts': 't1' })], {
      final_files: { 'src/auth.ts': 'a1', 'tests/auth.test.ts': 't1' },
    })
  );
  assert.deepEqual(score.order_violations, []);
  assert.ok(!score.skipped_gates.some((g) => g.startsWith('RED_SPEC') || g.startsWith('GREEN_CODE')));
});

test('direct node --test runs count as suite runs', () => {
  clock = 0;
  const score = scoreTdd(trace({}, [edit('tests/auth.test.ts'), direct(1), edit('src/auth.ts'), direct(0)]));
  assert.ok(!score.skipped_gates.some((g) => g.startsWith('RED_SPEC') || g.startsWith('GREEN_CODE')));
});

test('a reactive run that does not reach COMPLETED misses that output, and false self-reports are counted', () => {
  clock = 0;
  const score = scoreTdd(
    trace({ arm: 'reactive' }, [
      edit('tests/auth.test.ts'), check('test', 0, { 'tests/auth.test.ts': 't1' }),
      { t: at(), kind: 'runtime', type: 'transition', signal: 'TEST_RAN', from: 'RED_SPEC', to: 'GREEN_CODE', payload_exit_code: 1 },
      { t: at(), kind: 'runtime', type: 'refused', signal: 'TEST_RAN', from: 'GREEN_CODE', reason: 'Guard refused', payload_exit_code: 1 },
    ], { runtime_final_state: 'GREEN_CODE' })
  );
  assert.equal(score.self_report_mismatches, 2);
  assert.ok(score.missing_outputs.some((m) => m.startsWith('runtime COMPLETED')));
  assert.equal(score.recoveries.find((r) => r.code.startsWith('runtime_refused'))?.recovered, false);
});

const WBASE = { 'src/cart.ts': 'c0', 'tests/cart.test.ts': 'k0', 'CHANGELOG.md': 'l0', 'docs/API.md': 'd0', 'package.json': 'p0' };
const read = (skill: string, bytes: number): TraceEvent => ({ t: at(), kind: 'tool', tool: 'Read', target: `.skills/${skill}/SKILL.md`, is_error: false, result_bytes: bytes, tool_use_id: String(clock) });

test('workflow: ordered steps with a distractor read score as one wrong read and no wrong choice', () => {
  clock = 0;
  const score = scoreWorkflow(
    trace({ task: 'workflow', question: 2 }, [
      read('triage-bug', 700), read('perf-profile', 400),
      edit('.work/triage.md'), edit('tests/cart.test.ts'), check('test', 1, { 'src/cart.ts': 'c0', 'tests/cart.test.ts': 'k1' }),
      edit('src/cart.ts'), check('test', 0, { 'src/cart.ts': 'c1', 'tests/cart.test.ts': 'k1' }), check('lint', 0, { 'src/cart.ts': 'c1' }), edit('CHANGELOG.md'),
    ], {
      baseline_hashes: WBASE,
      final_files: { 'src/cart.ts': 'c1', 'tests/cart.test.ts': 'k1' },
      final_checks: { triage_sections: 4, changelog_fixed_entry: true, distractor_artifacts: [] },
    })
  );
  assert.deepEqual(score.wrong_skill_reads, ['perf-profile']);
  assert.deepEqual(score.wrong_skill_choices, []);
  assert.deepEqual(score.sequence_errors, []);
  assert.deepEqual(score.skipped_steps, []);
  assert.equal(score.bytes_before_first_correct_action, 1100);
  assert.equal(score.correct, true);
});

test('workflow: fixing first and noting before green are sequence errors; distractor output is a wrong choice', () => {
  clock = 0;
  const score = scoreWorkflow(
    trace({ task: 'workflow', question: 2 }, [edit('src/cart.ts'), edit('CHANGELOG.md'), edit('tests/cart.test.ts'), check('test', 0, { 'src/cart.ts': 'c1', 'tests/cart.test.ts': 'k1' })], {
      baseline_hashes: WBASE,
      final_files: { 'src/cart.ts': 'c1', 'tests/cart.test.ts': 'k1' },
      final_checks: { triage_sections: 0, changelog_fixed_entry: true, distractor_artifacts: ['.work/perf-report.md'] },
    })
  );
  assert.deepEqual(score.sequence_errors, ['test_before_triage', 'fix_before_triage', 'fix_before_failing_test', 'changelog_before_green_fix']);
  assert.deepEqual(score.wrong_skill_choices, ['perf-profile']);
});
