import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { createStateView } from '../src/core/state-view.js';
import { payloadContractError, payloadRequirements, inspectTransitionGuard } from '../src/core/payload-contract.js';
import { evaluatePayloadGuard } from '../src/core/payload-guard.js';
import { TransitionSchema, type SkillManifest, type TransitionDefinition } from '../src/core/types.js';

const contract = {
  fields: { exit_code: { type: 'number' as const, const: 0 } },
  relationships: [], evidence_source: 'test result', refusal_hint: 'Submit the test exit code.',
};

/**
 * Time bounded local operations after ten warmups; report empirical p50/p95 without external model calls.
 * # Performance & Risk Budget
 * - Tier: P3 (< 2000ms); Complexity: O(n * operation), n = 100 samples
 * - Cyclomatic Complexity (CC): 3 (measured with ESLint)
 * - Branch Coverage: offline driver not instrumented; measured product helper branches are 100%
 * - CRAP Score: worst-case <= 30 even at 0% coverage; measured CC <= 5
 */
function sample(operation: () => unknown) {
  for (let i = 0; i < 10; i++) operation();
  const times: number[] = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    operation();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { p50_ms: times[49], p95_ms: times[94], samples: times.length };
}

/**
 * Time asynchronous guard/refusal paths with the same sample count and warmup as synchronous measurements.
 * # Performance & Risk Budget
 * - Tier: P3 (< 2000ms); Complexity: O(n * operation), n = 100 samples
 * - Cyclomatic Complexity (CC): 3 (measured with ESLint)
 * - Branch Coverage: offline driver not instrumented; measured product helper branches are 100%
 * - CRAP Score: worst-case <= 30 even at 0% coverage; measured CC <= 5
 */
async function sampleAsync(operation: () => Promise<unknown>) {
  for (let i = 0; i < 10; i++) await operation();
  const times: number[] = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    await operation();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { p50_ms: times[49], p95_ms: times[94], samples: times.length };
}

/**
 * Count real MCP response text and request arguments for the pinned TDD GREEN_CODE state, with and without an authored contract.
 * Includes optional inspection cost; excludes JSON-RPC framing, tool definitions, model work and process startup.
 * # Performance & Risk Budget
 * - Tier: P3 (< 2000ms); Complexity: O(f + n * b), copied fixture bytes f, n = 100 bounded timing samples, selected bytes b
 * - Cyclomatic Complexity (CC): 5 (measured with ESLint)
 * - Branch Coverage: offline driver not instrumented; both presentation cases exercised in the probe
 * - CRAP Score: worst-case <= 30 even at 0% coverage; measured CC <= 5
 */
async function benchmark() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-contract-benchmark-'));
  const fixture = fileURLToPath(new URL('./transport-benchmark/fixtures/tdd-refactor/', import.meta.url));
  const results: unknown[] = [];
  try {
    for (const authored of [false, true]) {
      const workspace = path.join(root, String(authored));
      const skillDir = path.join(workspace, 'skills/tdd-refactor');
      fs.cpSync(fixture, skillDir, { recursive: true });
      const manifest = yaml.load(fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf8')) as SkillManifest;
      manifest.initial_state = 'GREEN_CODE';
      const transition = manifest.states.GREEN_CODE.transitions!.TEST_RAN as TransitionDefinition;
      if (authored) transition.payload_contract = contract;
      fs.writeFileSync(path.join(skillDir, 'skill.yaml'), JSON.stringify(manifest));
      const server = createReactiveMcpServer({ workspaceDir: workspace, defaultSkill: 'tdd-refactor' });
      let engine = new FSMEngine({ skillDir, workspaceDir: workspace });
      try {
        const moduleManifest = structuredClone(manifest);
        (moduleManifest.states.GREEN_CODE.transitions!.TEST_RAN as TransitionDefinition).guardFunction = 'guards/inspection.cjs';
        fs.mkdirSync(path.join(skillDir, 'guards'), { recursive: true });
        fs.writeFileSync(path.join(skillDir, 'guards/inspection.cjs'), 'module.exports = ({ event }) => event.payload.exit_code === 0;');
        const tools = (server as any)._registeredTools;
        const stateRequest = { skill: 'tdd-refactor', output: 'compact-v1' };
        const inspectionRequest = { skill: 'tdd-refactor', state: 'GREEN_CODE', signal: 'TEST_RAN' };
        const state = await tools.reactive_state.handler(stateRequest, {});
        const inspection = await tools.reactive_inspect.handler(inspectionRequest, {});
        if (state.isError || inspection.isError) throw new Error('Benchmark interface call refused');
        const runId = engine.getJobId();
        engine.close();
        engine = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: runId });
        const initial = Buffer.byteLength(JSON.stringify(stateRequest)) + Buffer.byteLength(state.content[0].text);
        const inspect = Buffer.byteLength(JSON.stringify(inspectionRequest)) + Buffer.byteLength(inspection.content[0].text);
        results.push({ authored, initial_bytes: initial, inspect_bytes: inspect, total_without_inspection: initial, total_with_inspection: initial + inspect,
          timing: {
            declaration: sample(() => TransitionSchema.parse(transition)),
            validation: sample(() => payloadContractError(transition.payload_contract, { exit_code: 0 })),
            requirements: sample(() => payloadRequirements(transition)),
            inspection: sample(() => inspectTransitionGuard(manifest, skillDir, 'GREEN_CODE', 'TEST_RAN')),
            module_inspection: sample(() => inspectTransitionGuard(moduleManifest, skillDir, 'GREEN_CODE', 'TEST_RAN')),
            mcp_inspection: await sampleAsync(() => tools.reactive_inspect.handler(inspectionRequest, {})),
            slice: sample(() => engine.generatePromptSlice()),
            view: sample(() => createStateView(engine)),
            guarded_evaluation: await sampleAsync(() => evaluatePayloadGuard(transition.payload_contract, transition.guard, undefined, {
              event: { id: 'benchmark', seq: 0, timestamp: '', type: 'SIGNAL', payload: { exit_code: 0 } }, context: {}, currentState: 'GREEN_CODE',
            })),
            refused_signal: await sampleAsync(() => engine.handleSignal('TEST_RAN', { exit_code: '0' })),
          },
        });
      } finally { engine.close(); await server.close(); }
    }
    console.log(JSON.stringify({ node: process.version, platform: process.platform, unit: 'UTF-8 bytes of request arguments plus MCP response text; no JSON-RPC frame or tool definitions', results }, null, 2));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

await benchmark();
