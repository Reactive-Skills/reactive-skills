import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

describe('Performance Budget & Metrics Telemetry', () => {
  const skillDir = path.resolve(process.cwd(), 'skills', '_test_fsm_skill');
  let tempDbDir: string;
  let eventStore: EventStore;
  let engine: FSMEngine;

  async function initializeEngine(workspaceDir: string) {
    eventStore = new EventStore({
      workspaceDir,
      sqlitePath: path.join(workspaceDir, 'perf.db'),
      enableSqlite: true,
    });

    engine = new FSMEngine({
      skillDir,
      eventStore,
      workspaceDir,
      perfThresholds: {
        maxTransitionDurationMs: (process.env.CI || process.platform === 'win32') ? 1000 : 25,
      },
      initialContext: {
        target_file: 'src/calc.ts',
        test_file: 'tests/calc.test.ts',
      },
    });

    await engine.handleSignal('RUNTIME_READY');
  }

  beforeEach(async () => {
    tempDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-perf-test-'));
    await initializeEngine(tempDbDir);
  });

  afterEach(() => {
    engine.close();
    try {
      fs.rmSync(tempDbDir, { recursive: true, force: true });
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

  it('should satisfy the P1 budget relative to interleaved SQLite persistence', async () => {
    const durations: number[] = [];
    const metricDurations: number[] = [];
    const controlDurations: number[] = [];
    const median = (samples: number[]) => [...samples].sort((a, b) => a - b)[3];
    const controlDb = new DatabaseSync(path.join(tempDbDir, 'control.db'));

    try {
      controlDb.exec('PRAGMA journal_mode = WAL');
      controlDb.exec('CREATE TABLE control (payload TEXT)');
      const insert = controlDb.prepare('INSERT INTO control VALUES (?)');
      const controlPath = path.join(tempDbDir, 'control.jsonl');
      const payload = JSON.stringify({ signal: 'TEST_RAN', data: 'x'.repeat(256) });
      const measureControl = () => {
        const start = performance.now();
        // A fixed eight commits plus file writes models a small persisted transition.
        // Use raw SQLite rather than EventStore so runtime regressions cannot inflate the control.
        for (let write = 0; write < 8; write++) {
          insert.run(payload);
          fs.writeFileSync(controlPath, `${payload}\n`.repeat(write + 1));
        }
        controlDurations.push(performance.now() - start);
      };

      // Seven fresh runs tolerate up to three outliers; alternate order to avoid timing bias.
      for (let sample = 0; sample < 7; sample++) {
        if (sample > 0) {
          engine.close();
          await initializeEngine(path.join(tempDbDir, `sample-${sample}`));
        }
        if (sample % 2 === 0) measureControl();
        const start = performance.now();
        const res = await engine.handleSignal('TEST_RAN', { exit_code: 1 });
        durations.push(performance.now() - start);
        if (sample % 2 !== 0) measureControl();

        expect(res.transitioned).toBe(true);
        expect(res.previousState).toBe('RED_SPEC');
        expect(res.newState).toBe('GREEN_CODE');
        expect(res.metrics).toBeDefined();
        expect(res.metrics!.transition_duration_ms).toBeGreaterThanOrEqual(0);
        metricDurations.push(res.metrics!.transition_duration_ms!);

        // Check the measured signal's persisted telemetry, rather than the setup transition.
        const transitionEvent = eventStore.getAll().find(e =>
          e.type === 'STATE_TRANSITION' && e.causationId === res.event.id);
        expect(transitionEvent).toBeDefined();
        expect(transitionEvent!.payload.metrics).toEqual(res.metrics);
      }

      // Keep the 25ms budget on fast hosts; allow at most 2x the control on slow storage.
      // The independent 1s ceiling still catches stalls even when the control is slow.
      const baseline = Math.max(25 / 2, median(controlDurations));
      const diagnostic = `handleSignal ms: ${durations}; control ms: ${controlDurations}`;
      expect(median(durations) / baseline, diagnostic).toBeLessThan(2);
      expect(median(metricDurations) / baseline, diagnostic).toBeLessThan(2);
      expect(median(durations), diagnostic).toBeLessThan(1000);
      expect(median(metricDurations), diagnostic).toBeLessThan(1000);
    } finally {
      controlDb.close();
    }
  }, 15000);

  it('should record PERF_DEGRADATION event when operation breaches configured threshold', async () => {
    // Instantiate engine with near-zero threshold (0.0001ms) to force degradation event
    const strictEngine = new FSMEngine({
      skillDir,
      eventStore,
      workspaceDir: tempDbDir,
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
