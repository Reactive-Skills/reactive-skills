// Entry point: `pilot` runs the grid (skipping finished runs), `score` re-derives scores, `report` writes REPORT.md.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HARNESS_ROOT, RESULTS } from './paths.ts';
import { PROMPT_VERSION } from './prompts.ts';
import { writeReport } from './report.ts';
import { type PilotConfig, runTrial } from './runner.ts';
import { deriveTrace } from './trace.ts';
import type { Cell, RunTrace } from './types.ts';

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function loadConfig(): PilotConfig {
  return JSON.parse(fs.readFileSync(path.resolve(HARNESS_ROOT, arg('config', 'config/pilot.json')!), 'utf8'));
}

export function outDir(config: PilotConfig): string {
  return path.join(RESULTS, arg('out', 'pilot')!, 'traces');
}

function traceFile(dir: string, cell: Cell, rep: number): string {
  return path.join(dir, `${cell.id}__rep${rep}.json`);
}

function assertPinned(config: PilotConfig): void {
  const version = execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim().split(' ')[0];
  if (version !== config.claude_code_version) {
    throw new Error(`Claude Code ${version} is installed; config pins ${config.claude_code_version}`);
  }
}

/** # Performance & Risk Budget
 * - Tier: P3 (model-driven batch; minutes per run)
 * - Complexity: O(c*r) runs, `concurrency` at a time
 * - Cyclomatic Complexity (CC): 8 (threshold <= 20) */
async function pilot(): Promise<void> {
  const config = loadConfig();
  assertPinned(config);
  const dir = outDir(config);
  fs.mkdirSync(dir, { recursive: true });
  const rawRoot = path.resolve(arg('raw-dir', path.join(os.tmpdir(), 'reactive-adherence-raw'))!);
  const only = arg('cells')?.split(',');
  const reps = Number(arg('reps', String(config.reps)));
  const concurrency = Number(arg('concurrency', '3'));
  const queue: { cell: Cell; rep: number }[] = [];
  for (const cell of config.cells) {
    if (only && !only.includes(cell.id)) continue;
    for (let rep = 1; rep <= reps; rep++) {
      if (!fs.existsSync(traceFile(dir, cell, rep))) queue.push({ cell, rep });
    }
  }
  console.log(`${queue.length} run(s) to do; raw traces in ${rawRoot}`);
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { cell, rep } = job;
      const began = Date.now();
      try {
        const raw = await runTrial(config, cell, rep, rawRoot);
        const trace = deriveTrace(raw, cell, rep, { model: config.model, claude_code_version: config.claude_code_version, seed: config.seed + rep });
        if (trace.usage.model_usage_keys.some((key) => key !== config.model)) {
          trace.status = 'error';
          trace.error = `unpinned model usage: ${trace.usage.model_usage_keys.join(',')}`;
        }
        if (cell.pressure === 'compaction' && !trace.events.some((e) => e.kind === 'compact_boundary')) {
          trace.status = 'error';
          trace.error = 'compaction requested but not observed';
        }
        fs.writeFileSync(traceFile(dir, cell, rep), JSON.stringify({ prompt_version: PROMPT_VERSION, ...trace }, null, 1) + '\n');
        console.log(`${cell.id} rep${rep}: ${trace.status} $${trace.usage.cost_usd.toFixed(2)} ${Math.round((Date.now() - began) / 1000)}s`);
      } catch (error) {
        console.error(`${cell.id} rep${rep}: harness error ${(error as Error).stack}`);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

function loadTraces(config: PilotConfig): RunTrace[] {
  const dir = outDir(config);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as RunTrace);
}

/** Re-derives committed traces from raw runs still on disk (after a scorer or derivation change). */
function rederive(): void {
  const config = loadConfig();
  const dir = outDir(config);
  const rawRoot = path.resolve(arg('raw-dir', path.join(os.tmpdir(), 'reactive-adherence-raw'))!);
  for (const cell of config.cells) {
    for (let rep = 1; rep <= config.reps; rep++) {
      const runDir = path.join(rawRoot, cell.id, `rep${rep}`);
      if (!fs.existsSync(path.join(runDir, 'status.json')) || !fs.existsSync(traceFile(dir, cell, rep))) continue;
      const old = JSON.parse(fs.readFileSync(traceFile(dir, cell, rep), 'utf8')) as RunTrace;
      const raw = { dir: runDir, workspace: path.join(runDir, 'ws'), stream: path.join(runDir, 'stream.jsonl'), sent: path.join(runDir, 'sent.jsonl') };
      const trace = deriveTrace(raw, cell, rep, { model: config.model, claude_code_version: config.claude_code_version, seed: config.seed + rep });
      if (old.status === 'error' && old.error) Object.assign(trace, { status: old.status, error: old.error });
      fs.writeFileSync(traceFile(dir, cell, rep), JSON.stringify({ prompt_version: PROMPT_VERSION, ...trace }, null, 1) + '\n');
    }
  }
}

const command = process.argv[2];
if (command === 'pilot') {
  await pilot();
  const config = loadConfig();
  writeReport(config, loadTraces(config), path.dirname(outDir(config)));
} else if (command === 'derive') {
  rederive();
  const config = loadConfig();
  writeReport(config, loadTraces(config), path.dirname(outDir(config)));
} else if (command === 'report' || command === 'score') {
  const config = loadConfig();
  writeReport(config, loadTraces(config), path.dirname(outDir(config)));
} else {
  console.error('usage: node src/cli.ts <pilot|derive|score|report> [--config file] [--cells a,b] [--reps n] [--concurrency n] [--raw-dir dir] [--out name]');
  process.exit(2);
}
