import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  evaluatePureRuntimeAction,
  RUNTIME_OUTPUT_TAIL_BYTES,
  type RuntimeAction,
  type RuntimeActionObservation,
} from './runtime-actions.js';

export interface RuntimeActionInput {
  workspaceDir: string;
  /** Recorded context with evidence materialized; only the pure kinds read it. */
  context: Record<string, unknown>;
}

/** Port through which the engine runs a declared action; tests and hosts may inject their own. */
export interface RuntimeActionExecutor {
  execute(action: RuntimeAction, input: RuntimeActionInput): Promise<RuntimeActionObservation>;
}

/**
 * Resolve a declared workspace-relative path and refuse one that leaves the workspace, including
 * through a symbolic link.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(p), path length plus two realpath calls
 * - Cyclomatic Complexity (CC): 4
 * - Branch Coverage: target 100% (runtime-actions executor tests)
 * - CRAP Score: target <= 4.0
 */
export function containedPath(workspaceDir: string, relative: string): string {
  const root = fs.realpathSync(workspaceDir);
  const resolved = path.resolve(root, relative);
  const real = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
  const within = path.relative(root, real);
  if (within.startsWith('..') || path.isAbsolute(within)) throw new Error(`Path '${relative}' resolves outside the workspace`);
  return real;
}

class OutputTail {
  private buffer = Buffer.alloc(0);
  push(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > RUNTIME_OUTPUT_TAIL_BYTES) this.buffer = this.buffer.subarray(this.buffer.length - RUNTIME_OUTPUT_TAIL_BYTES);
  }
  text(): string { return this.buffer.toString('utf8'); }
}

/**
 * Run a declared argv without a shell, killing it and its process group at the declared timeout.
 * Arguments are the manifest's literal strings; nothing from context or a signal payload reaches the process.
 * # Performance & Risk Budget
 * - Tier: P3 (bounded by the declared timeout_ms); Complexity: O(o), output bytes, with O(1) retained tail
 * - Cyclomatic Complexity (CC): 6
 * - Branch Coverage: target >= 90% (runtime-actions executor tests)
 * - CRAP Score: target <= 8.0
 */
function runCommand(action: Extract<RuntimeAction, { kind: 'command' }>, workspaceDir: string): Promise<Omit<RuntimeActionObservation, 'duration_ms'>> {
  return new Promise((resolve) => {
    let cwd: string;
    let executable = action.command;
    try {
      cwd = containedPath(workspaceDir, action.cwd ?? '.');
      if (executable === 'node') executable = process.execPath;
      else if (executable.includes('/')) executable = containedPath(workspaceDir, path.join(action.cwd ?? '.', executable));
    } catch (error) {
      resolve({ error: (error as Error).message });
      return;
    }
    const stdout = new OutputTail();
    const stderr = new OutputTail();
    let timedOut = false;
    // Its own process group on POSIX, so a timeout also stops processes the command started.
    const group = process.platform !== 'win32';
    const child = spawn(executable, action.args ?? [], { cwd, shell: false, windowsHide: true, detached: group, stdio: ['ignore', 'pipe', 'pipe'] });
    const kill = () => {
      try { if (group && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { child.kill('SIGKILL'); }
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, action.timeout_ms);
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', (error) => {
      clearTimeout(timer);
      resolve({ error: `Command failed to start: ${(error as NodeJS.ErrnoException).code ?? error.message}` });
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ exit_code: code, signal, ...(timedOut ? { timed_out: true } : {}), stdout_tail: stdout.text(), stderr_tail: stderr.text() });
    });
  });
}

/**
 * Inspect a declared workspace-relative path without following it outside the workspace.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(p), one stat and realpath
 * - Cyclomatic Complexity (CC): 4
 * - Branch Coverage: target 100%
 * - CRAP Score: target <= 4.0
 */
function inspectPath(action: Extract<RuntimeAction, { kind: 'path_exists' }>, workspaceDir: string): Omit<RuntimeActionObservation, 'duration_ms'> {
  try {
    const target = containedPath(workspaceDir, action.path);
    if (!fs.existsSync(target)) return { exists: false, entry_type: null };
    const stat = fs.statSync(target);
    return { exists: true, entry_type: stat.isFile() ? 'file' : stat.isDirectory() ? 'directory' : 'other' };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/** Default local adapter: commands and path checks touch the workspace; the pure kinds read only context. */
export class LocalRuntimeActionExecutor implements RuntimeActionExecutor {
  /**
   * # Performance & Risk Budget
   * - Tier: P0 for path, schema and expression kinds; P3 for commands (bounded by timeout_ms)
   * - Complexity: O(1) dispatch plus the selected kind's cost
   * - Cyclomatic Complexity (CC): 4
   * - Branch Coverage: target 100%
   * - CRAP Score: target <= 4.0
   */
  async execute(action: RuntimeAction, input: RuntimeActionInput): Promise<RuntimeActionObservation> {
    const started = performance.now();
    const observed = action.kind === 'command'
      ? await runCommand(action, input.workspaceDir)
      : action.kind === 'path_exists'
        ? inspectPath(action, input.workspaceDir)
        : evaluatePureRuntimeAction(action, input.context);
    return { ...observed, duration_ms: Number((performance.now() - started).toFixed(3)) };
  }
}
