// Aggregates scored traces into scores.json and a generated REPORT.md, including the measured cost per run
// and a projection for the full grid. Every number in the report comes from the committed traces.
import fs from 'node:fs';
import path from 'node:path';
import type { PilotConfig } from './runner.ts';
import { scoreTdd, type TddScore } from './scorers/tdd.ts';
import { newcomerBytes, scoreWorkflow, type WorkflowScore } from './scorers/workflow.ts';
import type { Cell, RunTrace } from './types.ts';

export interface ScoredRun {
  cell: string;
  rep: number;
  status: RunTrace['status'];
  context_tokens_at_task: number;
  compacted: boolean;
  usage: RunTrace['usage'];
  tdd?: TddScore;
  workflow?: WorkflowScore;
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function scoreRun(trace: RunTrace): ScoredRun {
  return {
    cell: trace.cell.id,
    rep: trace.rep,
    status: trace.status,
    context_tokens_at_task: trace.context_tokens_at_task,
    compacted: trace.events.some((e) => e.kind === 'compact_boundary'),
    usage: trace.usage,
    ...(trace.cell.task === 'tdd' ? { tdd: scoreTdd(trace) } : { workflow: scoreWorkflow(trace) }),
  };
}

const fmt = (n: number, digits = 0) => (Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : 'n/a');
const frac = (runs: ScoredRun[], pred: (r: ScoredRun) => boolean) => `${runs.filter(pred).length}/${runs.length}`;
const sumOf = (runs: ScoredRun[], f: (r: ScoredRun) => number) => runs.reduce((s, r) => s + f(r), 0);

function recoveryText(runs: ScoredRun[], key: 'tdd' | 'workflow'): string {
  const all = runs.flatMap((r) => r[key]?.recoveries ?? []);
  if (all.length === 0) return '0 violations';
  const recovered = all.filter((r) => r.recovered);
  return `${recovered.length}/${all.length} recovered, median ${fmt(median(recovered.map((r) => r.turns ?? 0)))} turns`;
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline report; < 1000ms)
 * - Complexity: O(r*e) runs times events
 * - Cyclomatic Complexity (CC): 9 (threshold <= 20) */
export function writeReport(config: PilotConfig, traces: RunTrace[], outRoot: string): void {
  const scored = traces.map(scoreRun);
  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(path.join(outRoot, 'scores.json'), JSON.stringify(scored, null, 1) + '\n');
  const byCell = (cell: Cell) => scored.filter((s) => s.cell === cell.id);
  const valid = (runs: ScoredRun[]) => runs.filter((r) => r.status === 'completed');
  const lines: string[] = [
    '# Adherence pilot: generated results',
    '',
    '> **Pilot.** Three repetitions per cell, one skill per question. These numbers describe these runs only;',
    '> they are not estimates of general rates. Regenerate with `node src/cli.ts report`.',
    '',
    `- Agent under test: Claude Code \`${config.claude_code_version}\`, model \`${config.model}\`, effort \`${config.effort}\`, tools ${config.tools.map((t) => `\`${t}\``).join(', ')}.`,
    `- Runs: ${scored.length} (${scored.filter((s) => s.status === 'completed').length} completed). Filler seed base ${config.seed}.`,
    '',
    '## Question 1: tdd-refactor under context pressure',
    '',
    '| Cell | Runs | Context at task (median tokens) | Correct end state | Runs with order violations | Skipped gates (total) | Missing outputs (total) | Skill re-reads (total, bytes) | Runs reading reactive skill source | Recovery | Self-report mismatches |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const cell of config.cells.filter((c) => c.question === 1)) {
    const runs = valid(byCell(cell));
    if (byCell(cell).length === 0) continue;
    lines.push(
      `| ${cell.id} | ${runs.length}/${byCell(cell).length} | ${fmt(median(runs.map((r) => r.context_tokens_at_task)))} | ${frac(runs, (r) => !!r.tdd?.correct)} | ${frac(runs, (r) => (r.tdd?.order_violations.length ?? 0) > 0)} | ${sumOf(runs, (r) => r.tdd!.skipped_gates.length)} | ${sumOf(runs, (r) => r.tdd!.missing_outputs.length)} | ${sumOf(runs, (r) => r.tdd!.skill_rereads)}, ${fmt(sumOf(runs, (r) => r.tdd!.skill_reread_bytes))} B | ${frac(runs, (r) => r.tdd!.skill_source_reads > 0)} | ${recoveryText(runs, 'tdd')} | ${cell.arm === 'reactive' ? sumOf(runs, (r) => r.tdd!.self_report_mismatches) : 'n/a'} |`
    );
  }
  lines.push('', '### Skipped gates and violations by run', '');
  for (const run of scored.filter((s) => s.tdd)) {
    const t = run.tdd!;
    lines.push(`- \`${run.cell}\` rep ${run.rep} (${run.status}): violations [${t.order_violations.join(', ')}]; skipped [${t.skipped_gates.join('; ')}]; missing [${t.missing_outputs.join('; ')}]; acceptance ${t.acceptance.passed} passed / ${t.acceptance.failed} failed.`);
  }

  lines.push(
    '',
    '## Question 2: three-skill workflow',
    '',
    '| Cell | Runs | Correct end state | Wrong skill reads (runs) | Wrong skill choices (runs) | Sequence errors (total) | Skipped steps (total) | Skill bytes before first correct action (median) | Skill bytes read (median) | Runs reading reactive skill source | Recovery |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  );
  for (const cell of config.cells.filter((c) => c.question === 2)) {
    const runs = valid(byCell(cell));
    if (byCell(cell).length === 0) continue;
    lines.push(
      `| ${cell.id} | ${runs.length}/${byCell(cell).length} | ${frac(runs, (r) => !!r.workflow?.correct)} | ${frac(runs, (r) => r.workflow!.wrong_skill_reads.length > 0)} | ${frac(runs, (r) => r.workflow!.wrong_skill_choices.length > 0)} | ${sumOf(runs, (r) => r.workflow!.sequence_errors.length)} | ${sumOf(runs, (r) => r.workflow!.skipped_steps.length)} | ${fmt(median(runs.map((r) => r.workflow!.bytes_before_first_correct_action ?? NaN).filter(Number.isFinite)))} B | ${fmt(median(runs.map((r) => r.workflow!.skill_bytes_total)))} B | ${frac(runs, (r) => r.workflow!.skill_source_reads > 0)} | ${recoveryText(runs, 'workflow')} |`
    );
  }
  const newcomer = newcomerBytes();
  lines.push(
    '',
    'Static newcomer cost (bytes to read before knowing which skill to use):',
    '',
    `- Flat library: ${fmt(newcomer.flat_index_bytes)} B of frontmatter across six skills to choose, ${fmt(newcomer.flat_needed_bytes)} B for the three needed skills in full, ${fmt(newcomer.flat_library_bytes)} B for the whole library.`,
    `- Reactive router: ${fmt(newcomer.reactive_entry_bytes)} B entry state prompt; ${fmt(newcomer.reactive_all_states_bytes)} B across all its state prompts (delivered one at a time), plus runtime envelope bytes measured above.`,
    '',
    '## Cost, tokens, turns and wall-clock',
    '',
    '| Cell | Median cost per run (USD) | Median total tokens | Median output tokens | Median model turns | Median wall-clock (s) |',
    '| --- | --- | --- | --- | --- | --- |'
  );
  const tokens = (r: ScoredRun) => r.usage.input_tokens + r.usage.cache_read_tokens + r.usage.cache_creation_tokens + r.usage.output_tokens;
  for (const cell of config.cells) {
    const runs = byCell(cell);
    if (runs.length === 0) continue;
    lines.push(`| ${cell.id} | ${fmt(median(runs.map((r) => r.usage.cost_usd)), 2)} | ${fmt(median(runs.map(tokens)))} | ${fmt(median(runs.map((r) => r.usage.output_tokens)))} | ${fmt(median(runs.map((r) => r.usage.model_turns)))} | ${fmt(median(runs.map((r) => r.usage.wall_clock_ms / 1000)))} |`);
  }
  const total = sumOf(scored, (r) => r.usage.cost_usd);
  lines.push('', `Measured pilot spend: **$${fmt(total, 2)}** over ${scored.length} runs (list prices as reported by Claude Code, \`costBasis: list\`).`, '');
  lines.push(...projection(config, scored));
  fs.writeFileSync(path.join(outRoot, 'REPORT.md'), lines.join('\n') + '\n');
}

/** Full grid: 5 skills x 2 arms x 4 pressures x 10 reps, plus 3 workflows x 2 arms x 10 reps. */
function projection(config: PilotConfig, scored: ScoredRun[]): string[] {
  const costFor = (pressure: string, question: number) =>
    median(scored.filter((s) => config.cells.find((c) => c.id === s.cell && c.pressure === pressure && c.question === question)).map((s) => s.usage.cost_usd));
  const immediate = costFor('immediate', 1);
  const heavy = costFor('filler150k', 1);
  const compaction = costFor('compaction', 1);
  const mid = immediate + (heavy - immediate) / 3;
  const perSkill = 2 * 10 * (immediate + mid + heavy + compaction);
  const q1 = 5 * perSkill;
  const q2 = 3 * 2 * 10 * costFor('immediate', 2);
  return [
    '## Projected cost of the full grid',
    '',
    'Assumptions: per-run cost equals the pilot median of the matching pressure on tdd-refactor; the ~50k level, not piloted,',
    'is interpolated as one third of the way from immediate to ~150k; other skills cost the same as tdd-refactor; prompt-cache',
    'behaviour matches the pilot (1-hour cache writes, then cache reads).',
    '',
    '| Part | Grid | Projected USD |',
    '| --- | --- | --- |',
    `| Question 1 | 5 skills x 2 arms x 4 pressures x 10 reps = 400 runs | ${fmt(q1, 0)} |`,
    `| Question 2 | 3 workflows x 2 arms x 10 reps = 60 runs | ${fmt(q2, 0)} |`,
    `| Total | 460 runs | **${fmt(q1 + q2, 0)}** |`,
    '',
  ];
}
