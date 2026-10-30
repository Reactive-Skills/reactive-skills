// Scores the three-skill workflow (triage-bug -> regression-fix -> release-note) from observed behaviour.
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURES } from '../paths.ts';
import type { RunTrace } from '../types.ts';
import { DISTRACTOR_ARTIFACTS } from '../trace.ts';
import { type Recovery, type TestRun, firstChange, lastWrite, refusalRecoveries, rereads, skillReads, taskStart, testRuns, turnsBetween } from './common.ts';

export const NEEDED = ['triage-bug', 'regression-fix', 'release-note'];
export const DISTRACTORS = ['perf-profile', 'api-docs', 'dependency-bump'];

export interface WorkflowScore {
  wrong_skill_reads: string[];
  wrong_skill_choices: string[];
  sequence_errors: string[];
  skipped_steps: string[];
  correct: boolean;
  acceptance: { passed: number; failed: number };
  bytes_before_first_correct_action: number | null;
  skill_rereads: number;
  skill_reread_bytes: number;
  skill_bytes_total: number;
  skill_source_reads: number;
  recoveries: Recovery[];
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline scoring; < 10ms per run)
 * - Complexity: O(e^2) worst case over e trace events (small e)
 * - Cyclomatic Complexity (CC): 18 (threshold <= 20) */
export function scoreWorkflow(trace: RunTrace): WorkflowScore {
  const start = taskStart(trace);
  const events = trace.events.filter((e) => e.t >= start);
  const base = trace.baseline_hashes;
  const at = (file: string) => firstChange(events, base, file);
  const triage = at('.work/triage.md');
  const testEdit = at('tests/cart.test.ts');
  const srcEdit = at('src/cart.ts');
  const changelogEdit = at('CHANGELOG.md');
  // Guard-run checks count as observed runs: in the reactive arm the runtime runs the suite on the agent's behalf.
  const guardTests: TestRun[] = events
    .filter((e): e is Extract<typeof e, { kind: 'check' }> => e.kind === 'check' && e.check === 'test' && e.source === 'guard')
    .map((c) => ({ t: c.t, exit_code: c.exit_code, hashes: c.hashes, via: 'check_log' }));
  const allTests = [...testRuns(events), ...guardTests].sort((a, b) => a.t - b.t);
  const changed = (r: TestRun, file: string) => r.hashes![file] !== base[file];
  const red = allTests.find((r) => r.exit_code !== 0 && (r.hashes ? changed(r, 'tests/cart.test.ts') && !changed(r, 'src/cart.ts') : r.t > testEdit && r.t < srcEdit));
  const finalSrc = trace.final_files['src/cart.ts'];
  const lastSrcEdit = lastWrite(events, ['src/cart.ts']);
  const isFinal = (r: TestRun) => (r.hashes ? r.hashes['src/cart.ts'] === finalSrc : r.t > lastSrcEdit);
  const greenAfterFix = allTests.find((r) => r.exit_code === 0 && finalSrc !== base['src/cart.ts'] && isFinal(r));

  const sequence: string[] = [];
  if (testEdit < triage) sequence.push('test_before_triage');
  if (srcEdit < triage) sequence.push('fix_before_triage');
  if (srcEdit !== Infinity && (!red || srcEdit < red.t)) sequence.push('fix_before_failing_test');
  if (changelogEdit !== Infinity && (!greenAfterFix || changelogEdit < greenAfterFix.t)) sequence.push('changelog_before_green_fix');

  const skipped: string[] = [];
  const checks = trace.final_checks;
  if (triage === Infinity || (checks?.triage_sections ?? 0) < 4) skipped.push('triage note with four sections');
  if (trace.final_files['tests/cart.test.ts'] === base['tests/cart.test.ts']) skipped.push('regression test');
  if (!red) skipped.push('failing run before the fix');
  if (!greenAfterFix) skipped.push('passing run after the fix');
  if (!events.some((e) => e.kind === 'check' && e.check === 'lint' && e.exit_code === 0 && e.hashes['src/cart.ts'] === finalSrc)) {
    skipped.push('lint after the fix');
  }
  if (!checks?.changelog_fixed_entry) skipped.push('changelog entry for #42');

  const reads = skillReads(trace);
  const readSkills = reads.filter((r) => r.kind === 'flat_read').map((r) => r.source.split('/').at(-2) ?? r.source);
  const firstCorrect = Math.min(triage, testEdit, srcEdit, changelogEdit);
  const wrongChoices = [...new Set((checks?.distractor_artifacts ?? []).map((a) => DISTRACTOR_ARTIFACTS[a] ?? (a === 'docs/API.md' ? 'api-docs' : 'dependency-bump')))];
  const again = rereads(reads);

  const recoveries: Recovery[] = sequence
    .filter((code) => code === 'fix_before_failing_test')
    .map((code) => {
      const laterRed = allTests.find((c) => c.exit_code !== 0 && c.t > srcEdit);
      return { code, t: srcEdit, recovered: !!laterRed, turns: laterRed ? turnsBetween(events, srcEdit, laterRed.t) : null };
    });
  return {
    wrong_skill_reads: [...new Set(readSkills.filter((s) => DISTRACTORS.includes(s)))],
    wrong_skill_choices: wrongChoices,
    sequence_errors: sequence,
    skipped_steps: skipped,
    correct: trace.acceptance.failed === 0 && trace.acceptance.passed > 0 && trace.end_checks.test === 0 && trace.end_checks.lint === 0 && !!checks?.changelog_fixed_entry,
    acceptance: trace.acceptance,
    bytes_before_first_correct_action: firstCorrect === Infinity ? null : reads.filter((r) => r.t < firstCorrect).reduce((sum, r) => sum + r.bytes, 0),
    skill_rereads: again.count,
    skill_reread_bytes: again.bytes,
    skill_bytes_total: reads.reduce((sum, r) => sum + r.bytes, 0),
    skill_source_reads: reads.filter((r) => r.kind === 'source_read').length,
    recoveries: [...recoveries, ...refusalRecoveries(trace)],
  };
}

/** Static newcomer cost: what must be read to know which skill to use, before any run. */
export function newcomerBytes(): { flat_index_bytes: number; flat_library_bytes: number; flat_needed_bytes: number; reactive_entry_bytes: number; reactive_all_states_bytes: number } {
  const lib = path.join(FIXTURES, 'skills/library');
  const file = (skill: string) => fs.readFileSync(path.join(lib, skill, 'SKILL.md'), 'utf8');
  const frontmatter = (text: string) => Buffer.byteLength(text.match(/^---\n[\s\S]*?\n---\n/)?.[0] ?? '');
  const all = [...NEEDED, ...DISTRACTORS];
  const states = path.join(FIXTURES, 'skills/reactive/ship-bugfix/states');
  return {
    flat_index_bytes: all.reduce((sum, s) => sum + frontmatter(file(s)), 0),
    flat_library_bytes: all.reduce((sum, s) => sum + Buffer.byteLength(file(s)), 0),
    flat_needed_bytes: NEEDED.reduce((sum, s) => sum + Buffer.byteLength(file(s)), 0),
    reactive_entry_bytes: fs.statSync(path.join(states, 'triage.md')).size,
    reactive_all_states_bytes: fs.readdirSync(states).reduce((sum, f) => sum + fs.statSync(path.join(states, f)).size, 0),
  };
}
