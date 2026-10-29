import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { EventStore, createSortableId } from '../src/core/event-store.js';
import { FSMEngine } from '../src/core/fsm-engine.js';

const skillDir = path.resolve(process.cwd(), 'skills', '_test_fsm_skill');
const workspaces: string[] = [];

function tempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-append-scaling-'));
  workspaces.push(dir);
  return dir;
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

function readSqliteIds(storeDir: string): string[] {
  const db = new DatabaseSync(path.join(storeDir, 'events.db'), { readOnly: true } as any);
  try {
    return (db.prepare('SELECT id FROM events ORDER BY ledger_seq').all() as Array<{ id: string }>).map(row => row.id);
  } finally {
    db.close();
  }
}

function readJsonlIds(storeDir: string): string[] {
  return fs.readdirSync(storeDir)
    .filter(name => /^events(-\d{6})?\.jsonl$/.test(name))
    .sort((a, b) => (a === 'events.jsonl' ? 1 : b === 'events.jsonl' ? -1 : a.localeCompare(b)))
    .flatMap(name => fs.readFileSync(path.join(storeDir, name), 'utf8').split('\n').filter(Boolean))
    .map(line => JSON.parse(line).id as string);
}

afterEach(() => {
  for (const dir of workspaces.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('ledger append scaling', () => {
  it('keeps transition latency flat as runs accumulate in one workspace', async () => {
    const workspaceDir = tempWorkspace();
    const runs = 200;
    const window = 20;
    const perRun: number[][] = [];

    for (let run = 0; run < runs; run++) {
      const eventStore = new EventStore({ workspaceDir, skillId: 'test-fsm', runId: createSortableId(), enableSqlite: true });
      const engine = new FSMEngine({ skillDir, eventStore, workspaceDir });
      const durations: number[] = [];
      try {
        for (const [signal, payload] of [['RUNTIME_READY', {}], ['TEST_RAN', { exit_code: 1 }], ['TEST_RAN', { exit_code: 0 }]] as const) {
          const start = performance.now();
          const result = await engine.handleSignal(signal, payload);
          durations.push(performance.now() - start);
          expect(result.transitioned).toBe(true);
        }
      } finally {
        engine.close();
      }
      perRun.push(durations);
    }

    const early = p95(perRun.slice(0, window).flat());
    const late = p95(perRun.slice(-window).flat());
    // A ratio, not absolute milliseconds, so host speed and CI noise cancel; the floor keeps a sub-ms baseline from amplifying jitter.
    const ratio = late / Math.max(early, 2);
    expect(ratio, `early p95 ${early.toFixed(2)}ms, late p95 ${late.toFixed(2)}ms`).toBeLessThan(3);

    // The incremental mirror still lands every SQLite event in JSONL exactly once.
    const storeDir = path.join(workspaceDir, '.reactive', 'skills', 'test-fsm');
    expect(readJsonlIds(storeDir)).toEqual(readSqliteIds(storeDir));
  }, 300_000);

  it('mirrors appends across rotated JSONL segments without gaps or duplicates', () => {
    const workspaceDir = tempWorkspace();
    const store = new EventStore({ workspaceDir, skillId: 'rotating', runId: createSortableId(), enableSqlite: true, maxJsonlBytes: 2_000 });
    for (let index = 0; index < 60; index++) store.append('STEP', { index, filler: 'x'.repeat(80) });
    const storeDir = path.join(workspaceDir, '.reactive', 'skills', 'rotating');
    expect(fs.readdirSync(storeDir).some(name => /^events-\d{6}\.jsonl$/.test(name))).toBe(true);
    expect(readJsonlIds(storeDir)).toEqual(readSqliteIds(storeDir));
    store.close();
  });

  it('mirrors rows another writer appended to the same ledger', () => {
    const workspaceDir = tempWorkspace();
    const first = new EventStore({ workspaceDir, skillId: 'shared', runId: createSortableId(), enableSqlite: true });
    const second = new EventStore({ workspaceDir, skillId: 'shared', runId: createSortableId(), enableSqlite: true });
    first.append('A1', {});
    second.append('B1', {});
    first.append('A2', {});
    // A writer whose mirror step failed leaves a SQLite row the next append must still mirror.
    second.getSqliteDriver()!.appendEvent({ id: createSortableId(), seq: 0, timestamp: new Date().toISOString(), type: 'B_UNMIRRORED', payload: {}, run_id: second.getEventContext().run_id } as any);
    first.append('A3', {});
    second.append('B2', {});
    const storeDir = path.join(workspaceDir, '.reactive', 'skills', 'shared');
    expect(readJsonlIds(storeDir)).toEqual(readSqliteIds(storeDir));
    first.close();
    second.close();
  });

  it('falls back to a full repair when the JSONL mirror was removed', () => {
    const workspaceDir = tempWorkspace();
    const store = new EventStore({ workspaceDir, skillId: 'repair', runId: createSortableId(), enableSqlite: true });
    store.append('ONE', {});
    store.append('TWO', {});
    const storeDir = path.join(workspaceDir, '.reactive', 'skills', 'repair');
    fs.unlinkSync(path.join(storeDir, 'events.jsonl'));
    store.append('THREE', {});
    expect(readJsonlIds(storeDir)).toEqual(readSqliteIds(storeDir));
    store.close();
  });

  it('repairs a gap below the JSONL tail on open without duplicating rows on the next append', () => {
    const workspaceDir = tempWorkspace();
    const runId = createSortableId();
    const first = new EventStore({ workspaceDir, skillId: 'gap', runId, enableSqlite: true });
    for (let index = 0; index < 8; index++) first.append('STEP', { index });
    first.close();
    const storeDir = path.join(workspaceDir, '.reactive', 'skills', 'gap');
    const jsonlPath = path.join(storeDir, 'events.jsonl');
    const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean);
    lines.splice(3, 1);
    fs.writeFileSync(jsonlPath, `${lines.join('\n')}\n`);

    const reopened = new EventStore({ workspaceDir, skillId: 'gap', runId, enableSqlite: true });
    reopened.append('AFTER_REPAIR', {});
    expect(readJsonlIds(storeDir)).toEqual(readSqliteIds(storeDir));
    reopened.close();
  });
});

describe('transition_total_ms', () => {
  it('covers persistence, the snapshot save and projections that transition_duration_ms excludes', async () => {
    const workspaceDir = tempWorkspace();
    const eventStore = new EventStore({ workspaceDir, skillId: 'test-fsm', runId: createSortableId(), enableSqlite: true });
    const engine = new FSMEngine({ skillDir, eventStore, workspaceDir });
    try {
      await engine.handleSignal('RUNTIME_READY');

      // Time every append, the snapshot save and the projection pass up to the end of projections;
      // later appends belong to queued lifecycle signals drained after the metric is stamped.
      let persistenceMs = 0;
      let projected = false;
      const time = <T>(operation: () => T, delayMs = 0): T => {
        const start = performance.now();
        try {
          const result = operation();
          // A slow step the total must absorb, so the assertion cannot pass on rounding alone.
          while (performance.now() - start < delayMs) { /* spin */ }
          return result;
        } finally {
          if (!projected) persistenceMs += performance.now() - start;
        }
      };
      const append = eventStore.append.bind(eventStore);
      const saveSnapshot = eventStore.saveSnapshot.bind(eventStore);
      const projectionEngine = (engine as any).projectionEngine;
      const project = projectionEngine.project.bind(projectionEngine);
      (eventStore as any).append = (...args: Parameters<typeof append>) => time(() => append(...args));
      (eventStore as any).saveSnapshot = (...args: Parameters<typeof saveSnapshot>) => time(() => saveSnapshot(...args), 20);
      projectionEngine.project = (...args: any[]) => {
        try { return time(() => project(...args)); } finally { projected = true; }
      };

      const result = await engine.handleSignal('TEST_RAN', { exit_code: 1 });
      expect(result.transitioned).toBe(true);
      const metrics = result.metrics!;
      expect(metrics.transition_total_ms).toBeGreaterThanOrEqual(persistenceMs);
      expect(metrics.transition_total_ms).toBeGreaterThan(metrics.transition_duration_ms! + 20);

      const [completed] = eventStore.query({ type: 'TRANSITION_COMPLETED', causationId: result.event.id });
      expect(completed.payload.metrics).toEqual(metrics);
      expect(completed.payload.metrics.transition_total_ms).toBeGreaterThanOrEqual(persistenceMs);
    } finally {
      engine.close();
    }
  });

  it('trips PERF_DEGRADATION on a transition slowed by its snapshot save', async () => {
    const workspaceDir = tempWorkspace();
    const eventStore = new EventStore({ workspaceDir, skillId: 'test-fsm', runId: createSortableId(), enableSqlite: true });
    const engine = new FSMEngine({ skillDir, eventStore, workspaceDir, perfThresholds: { maxTransitionDurationMs: 30 } });
    try {
      await engine.handleSignal('RUNTIME_READY');
      const before = eventStore.query({ type: 'PERF_DEGRADATION' }).length;

      const saveSnapshot = eventStore.saveSnapshot.bind(eventStore);
      (eventStore as any).saveSnapshot = (...args: Parameters<typeof saveSnapshot>) => {
        const start = performance.now();
        saveSnapshot(...args);
        while (performance.now() - start < 60) { /* spin */ }
      };

      const result = await engine.handleSignal('TEST_RAN', { exit_code: 1 });
      expect(result.transitioned).toBe(true);
      const alarms = eventStore.query({ type: 'PERF_DEGRADATION' }).slice(before);
      expect(alarms).toHaveLength(1);
      expect(alarms[0].payload).toMatchObject({ operation: 'handleSignal', threshold_ms: 30, signal: 'TEST_RAN' });
      expect(alarms[0].payload.duration_ms).toBe(result.metrics!.transition_total_ms);
      expect(alarms[0].payload.duration_ms).toBeGreaterThanOrEqual(60);
    } finally {
      engine.close();
    }
  });
});
