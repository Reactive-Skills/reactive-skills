import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bytes, normalizeText } from './accounting.js';
import { repositoryRoot } from './fixtures.js';

/** Runs the compiled public AXI entry in a fresh Node process for every observation.
 * # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(e+b) fixture events and output bytes
 * - Cyclomatic Complexity (CC): 8 (measured; threshold <= 20)
 * - Branch Coverage: 100% (12/12 V8 branches measured; target >= 60%)
 * - CRAP Score: 8.0 (measured; threshold <= 30.0)
 */
export function measureAxi(workspace: string) {
  const entry = path.join(repositoryRoot, 'apps', 'axi', 'dist', 'cli', 'index.js');
  const fence = fileURLToPath(new URL('./network-fence.mjs', import.meta.url));
  const commands: Array<[string, string[], Record<string, unknown>]> = [
    ['initial', ['invoke', 'tdd-refactor'], {}],
    ['initial_state', ['state', 'tdd-refactor'], {}],
    ['ready', ['emit', 'tdd-refactor', 'RUNTIME_READY'], {}],
    ['guard_refusal', ['emit', 'tdd-refactor', 'TEST_RAN', '{"exit_code":0}'], { exit_code: 0 }],
    ['red', ['emit', 'tdd-refactor', 'TEST_RAN', '{"exit_code":1}'], { exit_code: 1 }],
    ['green', ['emit', 'tdd-refactor', 'TEST_RAN', '{"exit_code":0}'], { exit_code: 0 }],
    ['clean', ['state', 'tdd-refactor'], {}],
    ['resume_empty_transcript', ['state', 'tdd-refactor'], {}],
    ['failure', ['state', 'benchmark-missing-fixture'], {}],
  ];
  return commands.map(([label, args, payload]) => {
    const start = performance.now();
    const result = spawnSync(process.execPath, ['--import', fence, entry, ...args], {
      cwd: workspace, env: { ...process.env, WORKSPACE_DIR: workspace }, encoding: 'utf8', timeout: 30_000,
    });
    const duration = performance.now() - start;
    if (result.error || result.status !== 0) throw result.error ?? new Error(`AXI process failed: ${result.status}: ${result.stderr}`);
    if (label !== 'failure' && /^error:/m.test(result.stdout)) throw new Error(`AXI command failed: ${result.stdout}`);
    if (label === 'failure' && !/^error:/m.test(result.stdout)) throw new Error('AXI missing-skill path did not fail');
    const stdout = normalizeText(result.stdout, [workspace]);
    return {
      label, transport: 'axi', operation: args[0], argv: args,
      resumed_state_fetch: label === 'resume_empty_transcript',
      timing: { mode: 'cold_process', process_ms: duration },
      raw: {
        argv_json_bytes: bytes(JSON.stringify(args)), input_payload_bytes: bytes(JSON.stringify(payload)),
        stdout_bytes: bytes(result.stdout), stderr_bytes: bytes(result.stderr),
      },
      normalized: { stdout_bytes: bytes(stdout) },
      protocol_envelope_bytes: null,
      stdout,
    };
  });
}
