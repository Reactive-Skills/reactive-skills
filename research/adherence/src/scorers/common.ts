import type { RunTrace, TraceEvent } from '../types.ts';

export type ToolEvent = Extract<TraceEvent, { kind: 'tool' }>;
export type CheckEvent = Extract<TraceEvent, { kind: 'check' }>;
export type RuntimeEvent = Extract<TraceEvent, { kind: 'runtime' }>;

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const PATH = String.raw`['"]?([\w./-]+)['"]?`;

/** # Performance & Risk Budget
 * - Tier: P3 (offline scoring; < 1ms per command)
 * - Complexity: O(b) command bytes
 * - Cyclomatic Complexity (CC): 5 (threshold <= 20)
 * Files a shell command writes: redirection and tee targets, in-place edits, copy/move destinations, git restores,
 * and files named in an inline script that calls a write API. Heredoc bodies are ignored. */
export function shellWrites(command: string): string[] {
  const body = command.replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?(\n\1\b|$)/g, '');
  const out: string[] = [];
  for (const m of body.matchAll(new RegExp(String.raw`(?:^|[^<0-9&])>>?\s*${PATH}`, 'g'))) out.push(m[1]);
  for (const m of body.matchAll(new RegExp(String.raw`\btee\s+(?:-a\s+)?${PATH}`, 'g'))) out.push(m[1]);
  // Quoted arguments (sed expressions, messages) can hold separators; blank them before splitting into commands.
  for (const segment of body.replace(/'[^']*'|"[^"]*"/g, "''").split(/&&|\|\||;|\|/)) {
    const words = segment.trim().split(/\s+/);
    if (/^(sed|perl)$/.test(words[0]) && words.some((w) => /^-[a-z]*i/.test(w))) out.push(words.at(-1)!.replace(/['"]/g, ''));
    if (/^(cp|mv)$/.test(words[0])) out.push(words.at(-1)!.replace(/['"]/g, ''));
    if (words[0] === 'git' && /^(checkout|restore)$/.test(words[1] ?? '') && !words.includes('-b')) {
      out.push(...words.slice(2).filter((w) => w.includes('/')));
    }
  }
  if (/\b(python3?|node)\b[\s\S]*(writeFile|write_text|open\([^)]*['"]w)/.test(command)) {
    for (const m of command.matchAll(/[\w.-]+\/[\w./-]+\.\w+/g)) out.push(m[0]);
  }
  return out.map((p) => p.replace(/^\.\//, '')).filter((p) => !p.startsWith('/dev/') && p !== "''");
}

/** True when the event writes `file`, through an edit tool or a shell command. Uses targets extracted before sanitizing. */
export function writes(event: TraceEvent, file: string): boolean {
  if (event.kind !== 'tool') return false;
  if (EDIT_TOOLS.has(event.tool)) return (event.target ?? '').endsWith(file);
  const targets = event.writes ?? (event.command ? shellWrites(event.command) : []);
  return event.tool === 'Bash' && targets.some((p) => p.endsWith(file));
}

/** Earliest evidence that `file` changed: a detected write, or a logged check whose hash differs from the baseline. */
export function firstChange(events: TraceEvent[], baseline: Record<string, string | null>, file: string): number {
  const write = events.find((e) => writes(e, file))?.t ?? Infinity;
  const snapshot = events.find((e) => e.kind === 'check' && e.hashes[file] !== undefined && e.hashes[file] !== baseline[file])?.t ?? Infinity;
  return Math.min(write, snapshot);
}

export function lastWrite(events: TraceEvent[], files: string[]): number {
  return Math.max(...events.filter((e) => files.some((f) => writes(e, f))).map((e) => e.t), -Infinity);
}

export function agentChecks(events: TraceEvent[], kind?: string): CheckEvent[] {
  return events.filter((e): e is CheckEvent => e.kind === 'check' && e.source === 'agent' && (!kind || e.check === kind));
}

export interface TestRun {
  t: number;
  exit_code: number;
  hashes?: Record<string, string | null>;
  via: 'check_log' | 'direct';
}

/** Suite runs the agent made: logged project checks, plus direct `node --test` runs read from the runner's summary. */
export function testRuns(events: TraceEvent[]): TestRun[] {
  const logged: TestRun[] = agentChecks(events, 'test').map((c) => ({ t: c.t, exit_code: c.exit_code, hashes: c.hashes, via: 'check_log' }));
  const direct: TestRun[] = events
    .filter((e): e is ToolEvent => e.kind === 'tool' && !!e.test_summary && !/\bnpm\s+(run\s+)?(-s\s+)?test\b|check\.mjs|npm run -s \$/.test(e.command ?? ''))
    .map((e) => ({ t: e.t, exit_code: e.test_summary!.fail > 0 ? 1 : 0, via: 'direct' }));
  return [...logged, ...direct].sort((a, b) => a.t - b.t);
}

/** Assistant turns strictly after `from` and at or before `to`. */
export function turnsBetween(events: TraceEvent[], from: number, to: number): number {
  return events.filter((e) => e.kind === 'assistant_turn' && e.t > from && e.t <= to).length;
}

export function taskStart(trace: RunTrace): number {
  return trace.events.find((e) => e.kind === 'user_message' && e.role === 'task')?.t ?? 0;
}

/** Reads of skill content: flat SKILL.md files, or reactive runtime prompt deliveries. */
export interface SkillRead {
  t: number;
  source: string;
  bytes: number;
  kind: 'flat_read' | 'runtime_fetch' | 'runtime_emit' | 'source_read';
}

const AXI = /reactive-skills-axi\s+(invoke|state|inspect|emit|events)\b/;

/** # Performance & Risk Budget
 * - Tier: P3 (offline scoring; < 10ms per run)
 * - Complexity: O(e)
 * - Cyclomatic Complexity (CC): 8 (threshold <= 20) */
export function skillReads(trace: RunTrace): SkillRead[] {
  const reads: SkillRead[] = [];
  for (const event of trace.events) {
    if (event.kind !== 'tool') continue;
    const target = event.target ?? '';
    if (event.tool === 'Read' && /SKILL\.md$/.test(target)) {
      reads.push({ t: event.t, source: target, bytes: event.result_bytes, kind: 'flat_read' });
    } else if (event.tool === 'Read' && /(^|\/)skills\//.test(target)) {
      reads.push({ t: event.t, source: target, bytes: event.result_bytes, kind: 'source_read' });
    } else if (event.tool === 'Bash' && event.command) {
      const axi = event.command.match(AXI);
      if (axi) {
        reads.push({ t: event.t, source: `axi ${axi[1]}`, bytes: event.result_bytes, kind: axi[1] === 'emit' ? 'runtime_emit' : 'runtime_fetch' });
      } else if (/SKILL\.md/.test(event.command) && /\b(cat|head|tail|less|sed -n|awk|grep)\b/.test(event.command)) {
        reads.push({ t: event.t, source: event.command.match(/[\w./-]*SKILL\.md/)?.[0] ?? 'SKILL.md', bytes: event.result_bytes, kind: 'flat_read' });
      } else if (/(^|[\s'"])skills\/[\w-]+\/(skill\.yaml|states|guards)/.test(event.command) && /\b(cat|head|tail|less|sed -n|awk)\b/.test(event.command)) {
        // Reading a reactive skill's manifest, state prompts or guard code directly, outside the runtime.
        reads.push({ t: event.t, source: 'reactive skill source', bytes: event.result_bytes, kind: 'source_read' });
      }
    }
  }
  return reads;
}

/** Re-reads are skill fetches after the first one; emits deliver the next state and are not re-reads. */
export function rereads(reads: SkillRead[]): { count: number; bytes: number } {
  const fetches = reads.filter((r) => r.kind !== 'runtime_emit');
  const again = fetches.slice(1);
  return { count: again.length, bytes: again.reduce((sum, r) => sum + r.bytes, 0) };
}

export interface Recovery {
  code: string;
  t: number;
  recovered: boolean;
  turns: number | null;
}

/** Self-reported exit codes that disagree with the latest real check of the same kind before the emit. */
export function selfReportMismatches(trace: RunTrace): number {
  let mismatches = 0;
  for (const event of trace.events) {
    if (event.kind !== 'runtime' || event.payload_exit_code === undefined) continue;
    const before = agentChecks(trace.events, 'test').filter((c) => c.t <= event.t).at(-1);
    if (before && before.exit_code !== 0 !== (event.payload_exit_code !== 0)) mismatches += 1;
  }
  return mismatches;
}

/** Runtime refusals and whether the agent then got a transition through, and how many turns it took. */
export function refusalRecoveries(trace: RunTrace): Recovery[] {
  const runtime = trace.events.filter((e): e is RuntimeEvent => e.kind === 'runtime');
  return runtime
    .filter((e) => e.type === 'refused' || e.type === 'unhandled')
    .map((refusal) => {
      const next = runtime.find((e) => e.t > refusal.t && e.type === 'transition');
      return {
        code: `runtime_${refusal.type}:${refusal.signal}@${refusal.from}`,
        t: refusal.t,
        recovered: !!next,
        turns: next ? turnsBetween(trace.events, refusal.t, next.t) : null,
      };
    });
}
