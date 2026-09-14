import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

describe('Performance Budget & Metrics Telemetry', () => {
  const skillDir = path.resolve(process.cwd(), 'skills', '_test_fsm_skill');
  let tempDbDir: string;
  let tempDbPath: string;
  let eventStore: EventStore;
  let engine: FSMEngine;

  beforeEach(async () => {
    tempDbDir = path.resolve(process.cwd(), '.reactive/test-perf');
    if (!fs.existsSync(tempDbDir)) {
      fs.mkdirSync(tempDbDir, { recursive: true });
    }
    tempDbPath = path.resolve(tempDbDir, `perf-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

    eventStore = new EventStore({
      sqlitePath: tempDbPath,
      enableSqlite: true,
    });

    engine = new FSMEngine({
      skillDir,
      eventStore,
      perfThresholds: {
        maxTransitionDurationMs: (process.env.CI || process.platform === 'win32') ? 1000 : 25,
      },
      initialContext: {
        target_file: 'src/calc.ts',
        test_file: 'tests/calc.test.ts',
      },
    });

    await engine.handleSignal('RUNTIME_READY');
  });

  afterEach(() => {
    engine.close();
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      if (fs.existsSync(`${tempDbPath}-wal`)) fs.unlinkSync(`${tempDbPath}-wal`);
      if (fs.existsSync(`${tempDbPath}-shm`)) fs.unlinkSync(`${tempDbPath}-shm`);
      if (fs.existsSync(tempDbDir) && fs.readdirSync(tempDbDir).length === 0) {
        fs.rmdirSync(tempDbDir);
      }
    } catch {
      // Best-effort cleanup
    }
  });

  it('should satisfy P0 latency budget (< 5ms) for generatePromptSlice() and record metrics', () => {
    // Warm up
    engine.generatePromptSlice();

    const maxP0 = (process.env.CI || process.platform === 'win32') ? 50 : 5;
    const start = performance.now();
    const slice = engine.generatePromptSlice();
    const duration = performance.now() - start;

    // Assert P0 budget
    expect(duration).toBeLessThan(maxP0);

    // Verify metrics payload
    expect(slice.metrics).toBeDefined();
    expect(slice.metrics!.slice_duration_ms).toBeGreaterThanOrEqual(0);
    expect(slice.metrics!.slice_duration_ms).toBeLessThan(maxP0);
    expect(slice.metrics!.slice_tokens_est).toBeGreaterThan(0);
    expect(slice.metrics!.allowed_tools_count).toBe(slice.allowedTools.length);

    // Verify engine helper
    expect(engine.getLastMetrics()).toEqual(slice.metrics);
  });

  it('should satisfy P1 latency budget (< 25ms) for handleSignal() with SQLite persistence', async () => {
    // In RED_SPEC, failing test transitions to GREEN_CODE
    // Allow higher budget on virtualized CI environments and Windows NTFS due to disk sync jitter and CPU throttling
    const maxP1 = (process.env.CI || process.platform === 'win32') ? 1000 : 25;
    const start = performance.now();
    const res = await engine.handleSignal('TEST_RAN', { exit_code: 1 });
    const duration = performance.now() - start;

    // Assert P1 budget
    expect(duration).toBeLessThan(maxP1);
    expect(res.transitioned).toBe(true);

    // Verify transition metrics returned
    expect(res.metrics).toBeDefined();
    expect(res.metrics!.transition_duration_ms).toBeGreaterThanOrEqual(0);
    expect(res.metrics!.transition_duration_ms).toBeLessThan(maxP1);

    // Verify STATE_TRANSITION event payload includes metrics
    const events = eventStore.getAll();
    const transitionEvent = events.find(e => e.type === 'STATE_TRANSITION');
    expect(transitionEvent).toBeDefined();
    expect(transitionEvent!.payload.metrics).toBeDefined();
    expect(transitionEvent!.payload.metrics.transition_duration_ms).toBeDefined();
  });

  it('should record PERF_DEGRADATION event when operation breaches configured threshold', async () => {
    // Instantiate engine with near-zero threshold (0.0001ms) to force degradation event
    const strictEngine = new FSMEngine({
      skillDir,
      eventStore,
      perfThresholds: {
        maxSliceDurationMs: 0.0001,
        maxTransitionDurationMs: 0.0001,
      },
    });

    strictEngine.generatePromptSlice();
    await strictEngine.handleSignal('RUNTIME_READY');

    const events = eventStore.getAll();
    const degradationEvents = events.filter(e => e.type === 'PERF_DEGRADATION');
    expect(degradationEvents.length).toBeGreaterThanOrEqual(1);

    const firstDegradation = degradationEvents[0].payload;
    expect(['generatePromptSlice', 'handleSignal']).toContain(firstDegradation.operation);
    expect(firstDegradation.duration_ms).toBeGreaterThan(0);
    expect(firstDegradation.threshold_ms).toBe(0.0001);

    strictEngine.close();
  });

  it('should demonstrate token savings: sliced prompt vs full manifest instructions', () => {
    const slice = engine.generatePromptSlice();
    const fullYamlPath = path.join(skillDir, 'skill.yaml');
    const fullYamlSize = fs.readFileSync(fullYamlPath, 'utf8').length;
    const estFullTokens = Math.ceil(fullYamlSize / 4);

    expect(slice.metrics!.slice_tokens_est).toBeLessThan(estFullTokens);
  });
});
