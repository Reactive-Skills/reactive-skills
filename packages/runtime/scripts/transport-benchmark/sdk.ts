import path from 'node:path';
import { FSMEngine } from '../../src/core/fsm-engine.js';
import { EventStore } from '../../src/core/event-store.js';
import { LegacySkillAdapter } from '../../src/core/legacy-adapter.js';
import { bytes, normalizeValue } from './accounting.js';

/** Selects the engine's existing full replay path without deleting durable snapshots. */
class ReplayStore extends EventStore {
  /** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): 1 (measured; threshold <= 20)
 * - Branch Coverage: 100% (1/1 V8 branches measured; target >= 60%)
 * - CRAP Score: 1.0 (measured; threshold <= 30.0) */
  public override getLatestSnapshot(): null { return null; }
}

/** Exercises actual SDK state delivery, transitions and both recovery paths.
 * # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(e+b) fixture events and view bytes
 * - Cyclomatic Complexity (CC): target <= 20
 * - Branch Coverage: target >= 60%
 * - CRAP Score: target <= 30.0
 */
export async function measureSdk(workspace: string) {
  const skillDir = path.join(workspace, 'skills', 'tdd-refactor');
  const engine = new FSMEngine({ workspaceDir: workspace, skillDir, jobId: 'sdk-a' });
  const rows: Array<Record<string, unknown>> = [];
  const transitions: unknown[] = [];
  const findings: Array<Record<string, unknown>> = [];
  const recovery: Array<Record<string, unknown>> = [];

  /** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(b) view bytes
 * - Cyclomatic Complexity (CC): 2 (measured; threshold <= 20)
 * - Branch Coverage: 100% (1/1 V8 branches measured; target >= 60%)
 * - CRAP Score: 2.0 (measured; threshold <= 30.0) */
  function view(current: FSMEngine, label: string, resumed = false) {
    const start = performance.now();
    const slice = current.generatePromptSlice();
    const duration = performance.now() - start;
    const normalized = normalizeValue(slice, [workspace]);
    rows.push({
      transport: 'sdk', operation: 'generatePromptSlice', label, resumed_state_fetch: resumed,
      timing: { mode: 'persistent_handler', handler_ms: duration },
      raw: { result_bytes: bytes(JSON.stringify(slice)), rendered_prompt_bytes: bytes(slice.rawPrompt), xml_bytes: bytes(slice.formattedXml) },
      normalized: { result_bytes: bytes(JSON.stringify(normalized)) },
      protocol_envelope_bytes: null,
      view: normalized,
    });
    return slice;
  }

  try {
    view(engine, 'initial');
    for (const [signal, payload] of [
      ['RUNTIME_READY', {}],
      ['TEST_RAN', { exit_code: 0 }],
      ['TEST_RAN', { exit_code: 1 }],
      ['TEST_RAN', { exit_code: 0 }],
    ] as Array<[string, Record<string, unknown>]>) {
      const start = performance.now();
      const result = await engine.handleSignal(signal, payload);
      const duration = performance.now() - start;
      transitions.push({
        signal, payload, transitioned: result.transitioned, state: result.newState,
        // Keep the engine metric names verbatim. Only a declared post-persistence metric may be used as such.
        returned_metrics: result.metrics ?? null,
        benchmark_awaited_handle_signal_ms: duration,
      });
    }
    const clean = view(engine, 'clean');
    const runId = engine.getJobId()!;
    const baseline = {
      state: engine.getCurrentState(),
      rendered_prompt_bytes: bytes(clean.rawPrompt),
      xml_bytes: bytes(clean.formattedXml),
      scoped_context_bytes: bytes(JSON.stringify(clean.scopedContext)),
      allowed_tools: clean.allowedTools,
      contracts: clean.exitConditions,
    };
    const eventCount = engine.getEventStore().getAll().length;
    engine.close();
    for (const [label, Store] of [['snapshot', EventStore], ['replay', ReplayStore]] as const) {
      const store = new Store({ workspaceDir: workspace, skillId: 'tdd-refactor', jobId: runId, enableSqlite: true, readOnly: true });
      const resumed = new FSMEngine({ workspaceDir: workspace, skillDir, jobId: runId, eventStore: store });
      try {
        const restored = view(resumed, label, true);
        if (resumed.getCurrentState() !== baseline.state || restored.rawPrompt !== clean.rawPrompt
          || store.getAll().length !== eventCount) throw new Error(`Recovery changed state, prompt or events: ${label}`);
        const contextMatches = JSON.stringify(restored.scopedContext) === JSON.stringify(clean.scopedContext);
        recovery.push({ path: label, context_matches_live: contextMatches, refactor_cycles: restored.scopedContext.refactor_cycles, events: eventCount });
        if (!contextMatches) {
          throw new Error(`Recovery changed accepted context: ${label}`);
        }
      } finally { resumed.close(); }
    }
    const concurrent = ['sdk-b', 'sdk-c'].map((jobId) => new FSMEngine({ workspaceDir: workspace, skillDir, jobId }));
    try {
      await Promise.all(concurrent.map((current) => current.handleSignal('RUNTIME_READY')));
      concurrent.forEach((current, index) => view(current, `concurrent-${index}`));
    } finally { concurrent.forEach((current) => current.close()); }
    const legacyDir = path.join(workspace, 'skills', 'benchmark-legacy');
    LegacySkillAdapter.upgradeToModular(legacyDir);
    const legacy = new FSMEngine({ workspaceDir: workspace, skillDir: legacyDir });
    try { view(legacy, 'legacy'); } finally { legacy.close(); }
    return { rows, transitions, baseline, recovery, findings };
  } finally { engine.close(); }
}
