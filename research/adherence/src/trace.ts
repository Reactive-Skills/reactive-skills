// Turns a raw run (stream, harness check log, runtime ledger, final workspace) into a sanitized trace.
// The trace keeps tool names, file targets, commands, exit status and byte counts, never tool output or message text.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIXTURES } from './paths.ts';
import type { RawRun } from './runner.ts';
import type { Cell, RunTrace, TraceEvent } from './types.ts';
import { TASKS, sha16 } from './workspace.ts';
import { shellWrites } from './scorers/common.ts';

const SKILL_ID: Record<string, string> = { tdd: 'tdd-refactor', workflow: 'ship-bugfix' };
export const SUMMARY_FILE = '.docs/tdd-refactor-summary.md';

function readJsonl(file: string): any[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/** Heredoc bodies are file contents, not commands; keep the operator and the byte count only. */
export function stripHeredocs(command: string): string {
  return command.replace(/(<<-?\s*['"]?(\w+)['"]?)([\s\S]*?)(\n\2\b|$)/g, (_m, op: string, _tag: string, body: string, end: string) => `${op} [${Buffer.byteLength(body)} bytes]${end}`);
}

export function sanitize(text: string, workspace: string): string {
  return stripHeredocs(text)
    .replaceAll(workspace + '/', '')
    .replaceAll(workspace, '.')
    .replaceAll(os.homedir(), '~')
    .replace(/\/tmp\/[^\s'"]*/g, '<tmp>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
    .replace(/(user\.name|--author)(=|\s+)("[^"]*"|'[^']*'|\S+)/g, '$1$2<name>')
    .slice(0, 400);
}

function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((block: any) => String(block?.text ?? '')).join('');
  return '';
}

/** The node test runner's closing summary, when the agent's command left it visible. */
export function testSummary(text: string): { pass: number; fail: number } | undefined {
  const pass = text.match(/^(?:# |ℹ )pass (\d+)/m);
  const fail = text.match(/^(?:# |ℹ )fail (\d+)/m);
  return pass && fail ? { pass: Number(pass[1]), fail: Number(fail[1]) } : undefined;
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline derivation; < 500ms per run)
 * - Complexity: O(e) stream events
 * - Cyclomatic Complexity (CC): 16 (threshold <= 20) */
export function streamEvents(raw: RawRun): { events: TraceEvent[]; results: any[]; init: any } {
  const events: TraceEvent[] = [];
  const results: any[] = [];
  const tools = new Map<string, Extract<TraceEvent, { kind: 'tool' }>>();
  const seenMessages = new Set<string>();
  let init: any = null;
  let pendingCompact: Extract<TraceEvent, { kind: 'compact_boundary' }> | null = null;
  for (const sent of readJsonl(raw.sent)) events.push({ t: sent.t, kind: 'user_message', role: sent.role, bytes: sent.bytes });
  for (const { t, line } of readJsonl(raw.stream)) {
    const event = JSON.parse(line);
    if (event.type === 'system' && event.subtype === 'init') init = event;
    if (event.type === 'system' && event.subtype === 'compact_boundary') {
      const meta = event.compact_metadata ?? {};
      pendingCompact = { t, kind: 'compact_boundary', pre_tokens: meta.pre_tokens ?? 0, post_tokens: meta.post_tokens ?? 0 };
      events.push(pendingCompact);
    }
    if (event.type === 'result') results.push(event);
    if (event.type === 'assistant') {
      const message = event.message ?? {};
      if (message.id && !seenMessages.has(message.id)) {
        seenMessages.add(message.id);
        const u = message.usage ?? {};
        events.push({
          t,
          kind: 'assistant_turn',
          message_id: String(seenMessages.size),
          context_tokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
          output_tokens: u.output_tokens ?? 0,
        });
      }
      for (const block of message.content ?? []) {
        if (block.type !== 'tool_use') continue;
        const input = block.input ?? {};
        const tool: Extract<TraceEvent, { kind: 'tool' }> = {
          t,
          kind: 'tool',
          tool: block.name,
          ...(input.file_path || input.path || input.pattern ? { target: sanitize(String(input.file_path ?? input.path ?? input.pattern), raw.workspace) } : {}),
          ...(input.command ? { command: sanitize(String(input.command), raw.workspace) } : {}),
          ...(input.command ? { writes: shellWrites(String(input.command).replaceAll(raw.workspace + '/', '')).map((p) => sanitize(p, raw.workspace)) } : {}),
          is_error: false,
          result_bytes: 0,
          tool_use_id: String(tools.size + 1),
        };
        tools.set(block.id, tool);
        events.push(tool);
      }
    }
    // The first user message after a compaction boundary is the summary; record its size and whether it names the phases.
    if (event.type === 'user' && pendingCompact) {
      const summary = resultText(event.message?.content);
      pendingCompact.summary_bytes = Buffer.byteLength(summary);
      pendingCompact.summary_names_phases = /RED/.test(summary) && /GREEN/.test(summary) && /REFACTOR/i.test(summary);
      pendingCompact = null;
    }
    if (event.type === 'user' && Array.isArray(event.message?.content)) {
      for (const block of event.message.content) {
        const tool = block.type === 'tool_result' ? tools.get(block.tool_use_id) : undefined;
        if (!tool) continue;
        const text = resultText(block.content);
        tool.is_error = Boolean(block.is_error);
        tool.result_bytes = Buffer.byteLength(text);
        const summary = tool.tool === 'Bash' ? testSummary(text) : undefined;
        if (summary) tool.test_summary = summary;
      }
    }
  }
  return { events, results, init };
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline derivation; < 50ms per ledger)
 * - Complexity: O(l) ledger events
 * - Cyclomatic Complexity (CC): 8 (threshold <= 20) */
export function runtimeEvents(workspace: string, skill: string): { events: TraceEvent[]; finalState: string | null } {
  const ledger = readJsonl(path.join(workspace, '.reactive/skills', skill, 'events.jsonl'));
  const events: TraceEvent[] = [];
  let finalState: string | null = null;
  const pending = new Map<string, { t: number; signal: string; from: string; exit?: number }>();
  for (const entry of ledger) {
    const payload = typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload ?? {};
    const t = Date.parse(entry.timestamp);
    if (entry.type === 'SKILL_INITIALIZED') finalState = payload.initial_state ?? entry.state;
    if (entry.type === 'SIGNAL_EMITTED' && entry.source === 'cli') {
      pending.set(entry.id, { t, signal: payload.signal, from: entry.state, exit: typeof payload.exit_code === 'number' ? payload.exit_code : undefined });
    }
    const cause = pending.get(entry.causationId ?? entry.causation_id);
    if (entry.type === 'STATE_TRANSITION' && cause) {
      finalState = payload.to;
      events.push({ t: cause.t, kind: 'runtime', type: 'transition', signal: cause.signal, from: cause.from, to: payload.to, ...(cause.exit !== undefined ? { payload_exit_code: cause.exit } : {}) });
      pending.delete(entry.causationId ?? entry.causation_id);
    }
    if (entry.type === 'SIGNAL_REFUSED' && cause) {
      events.push({ t: cause.t, kind: 'runtime', type: 'refused', signal: cause.signal, from: cause.from, reason: String(payload.reason ?? '').slice(0, 300), ...(cause.exit !== undefined ? { payload_exit_code: cause.exit } : {}) });
      pending.delete(entry.causationId ?? entry.causation_id);
    }
  }
  for (const cause of pending.values()) {
    events.push({ t: cause.t, kind: 'runtime', type: 'unhandled', signal: cause.signal, from: cause.from });
  }
  return { events, finalState };
}

const TRIAGE_SECTIONS = ['## Observed', '## Root cause', '## Affected file', '## Fix plan'];
/** Output files a distractor skill would produce, or files it would change. */
export const DISTRACTOR_ARTIFACTS: Record<string, string> = {
  '.work/perf-report.md': 'perf-profile',
  bench: 'perf-profile',
  '.work/dependency-notes.md': 'dependency-bump',
};

function workflowChecks(workspace: string): NonNullable<RunTrace['final_checks']> {
  const read = (rel: string) => (fs.existsSync(path.join(workspace, rel)) ? fs.readFileSync(path.join(workspace, rel), 'utf8') : '');
  const triage = read('.work/triage.md');
  const unreleased = read('CHANGELOG.md').split(/\n## (?!#)/)[1] ?? '';
  const baseline = JSON.parse(read('.harness/baseline.json') || '{}');
  const artifacts = Object.keys(DISTRACTOR_ARTIFACTS).filter((rel) => fs.existsSync(path.join(workspace, rel)));
  if (sha16(path.join(workspace, 'docs/API.md')) !== baseline['docs/API.md']) artifacts.push('docs/API.md');
  if (sha16(path.join(workspace, 'package.json')) !== baseline['package.json']) artifacts.push('package.json');
  return {
    triage_sections: TRIAGE_SECTIONS.filter((s) => triage.includes(s)).length,
    changelog_fixed_entry: unreleased.startsWith('Unreleased') && /### Fixed/.test(unreleased) && /#42\b/.test(unreleased),
    distractor_artifacts: artifacts,
  };
}

function runIn(dir: string, args: string[]): { status: number; stdout: string } {
  const result = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', env: { ...process.env, HARNESS_CHECK_SOURCE: 'harness', NODE_NO_WARNINGS: '1' } });
  return { status: result.status ?? 1, stdout: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** Runs the hidden acceptance test and the project checks on a copy of the final workspace. */
export function endState(workspace: string, task: Cell['task']): Pick<RunTrace, 'acceptance' | 'end_checks'> {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'adherence-end-'));
  try {
    fs.cpSync(workspace, copy, { recursive: true, filter: (src) => !src.includes(`${path.sep}.reactive`) && !src.includes(`${path.sep}.git${path.sep}`) });
    const accept = path.join(FIXTURES, TASKS[task].acceptance, 'acceptance.test.ts');
    fs.copyFileSync(accept, path.join(copy, 'tests', '__acceptance.test.ts'));
    const run = runIn(copy, ['--test', 'tests/__acceptance.test.ts']);
    const count = (label: string) => Number(run.stdout.match(new RegExp(`# ${label} (\\d+)`))?.[1] ?? 0);
    fs.rmSync(path.join(copy, 'tests', '__acceptance.test.ts'));
    const check = (kind: string) => runIn(copy, ['--no-warnings', 'scripts/check.mjs', kind]).status;
    return {
      acceptance: { passed: count('pass'), failed: count('fail') || (run.status === 0 ? 0 : Math.max(1, count('fail'))) },
      end_checks: { test: check('test'), lint: check('lint'), typecheck: check('typecheck') },
    };
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline derivation; < 3000ms per run including acceptance tests)
 * - Complexity: O(e log e) events sorted by time
 * - Cyclomatic Complexity (CC): 7 (threshold <= 20) */
export function deriveTrace(raw: RawRun, cell: Cell, rep: number, meta: { model: string; claude_code_version: string; seed: number }): RunTrace {
  const { events, results, init } = streamEvents(raw);
  const checks: TraceEvent[] = readJsonl(path.join(raw.workspace, '.harness/checks.jsonl')).map((c) => ({
    t: c.at,
    kind: 'check',
    check: c.kind,
    exit_code: c.exit_code,
    source: c.source === 'guard' ? 'guard' : 'agent',
    hashes: c.hashes,
  }));
  const runtime = cell.arm === 'reactive' ? runtimeEvents(raw.workspace, SKILL_ID[cell.task]) : { events: [], finalState: null };
  const all = [...events, ...checks, ...runtime.events].sort((a, b) => a.t - b.t);
  const start = all.length ? all[0].t : 0;
  for (const event of all) event.t -= start;

  const last = results.at(-1) ?? {};
  const sum = (key: string) => results.reduce((total, r) => total + (r.usage?.[key] ?? 0), 0);
  const status = JSON.parse(fs.readFileSync(path.join(raw.dir, 'status.json'), 'utf8')) as { failure: string | null };
  const taskAt = all.find((e) => e.kind === 'user_message' && e.role === 'task')?.t ?? 0;
  const firstTaskTurn = all.find((e) => e.kind === 'assistant_turn' && e.t >= taskAt) as Extract<TraceEvent, { kind: 'assistant_turn' }> | undefined;
  const tracked = TASKS[cell.task].tracked;
  const finalFiles = Object.fromEntries([...new Set([...tracked, '.work/triage.md'])].map((rel) => [rel, sha16(path.join(raw.workspace, rel))]));
  const failure = status.failure ?? undefined;
  return {
    cell,
    rep,
    model: meta.model,
    claude_code_version: init?.claude_code_version ?? meta.claude_code_version,
    filler_seed: meta.seed,
    status: !failure ? 'completed' : failure === 'timeout' ? 'timeout' : /budget/.test(failure) ? 'budget' : 'error',
    ...(failure ? { error: failure } : {}),
    context_tokens_at_task: firstTaskTurn?.context_tokens ?? 0,
    events: all,
    usage: {
      model_usage_keys: Object.keys(last.modelUsage ?? {}),
      cost_usd: last.total_cost_usd ?? 0,
      input_tokens: sum('input_tokens'),
      cache_read_tokens: sum('cache_read_input_tokens'),
      cache_creation_tokens: sum('cache_creation_input_tokens'),
      output_tokens: sum('output_tokens'),
      model_turns: all.filter((e) => e.kind === 'assistant_turn').length,
      wall_clock_ms: all.length ? all[all.length - 1].t : 0,
    },
    baseline_hashes: JSON.parse(fs.readFileSync(path.join(raw.workspace, '.harness/baseline.json'), 'utf8')),
    final_files: finalFiles,
    ...(cell.task === 'workflow' ? { final_checks: workflowChecks(raw.workspace) } : {}),
    ...endState(raw.workspace, cell.task),
    summary_present: fs.existsSync(path.join(raw.workspace, SUMMARY_FILE)),
    runtime_final_state: runtime.finalState,
  };
}
