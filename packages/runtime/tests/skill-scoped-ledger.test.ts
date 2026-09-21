import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventStore, SQLiteStorageDriver, createSortableId } from '../src/core/event-store.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { JobManager } from '../src/core/job-manager.js';

function tempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-skill-ledger-'));
}

describe('skill-scoped event ledger', () => {
  it('shares one database while keeping independent per-run streams and sequences', () => {
    const workspaceDir = tempWorkspace();
    const runA = createSortableId();
    const runB = createSortableId();
    const first = new EventStore({ workspaceDir, skillId: 'demo', runId: runA, enableSqlite: true });
    const second = new EventStore({ workspaceDir, skillId: 'demo', runId: runB, enableSqlite: true });

    first.append('A_ONE', {});
    second.append('B_ONE', {});
    first.append('A_TWO', {});

    expect(first.getAll().map(event => event.seq)).toEqual([1, 2]);
    expect(second.getAll().map(event => event.seq)).toEqual([1]);
    expect(first.getSqliteDriver()!.querySql('SELECT COUNT(*) AS count FROM events')[0].count).toBe(3);
    expect(fs.existsSync(path.join(workspaceDir, '.reactive', 'skills', 'demo', 'events.db'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceDir, '.reactive', 'skills', 'demo', 'runs', runA, 'artifacts'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceDir, '.reactive', 'skills', 'demo', 'runs', runB, 'logs'))).toBe(true);

    first.close();
    second.close();
  });

  it('keeps aliases separate from immutable UUID-backed run IDs', () => {
    const workspaceDir = tempWorkspace();
    const manager = new JobManager(workspaceDir);
    const job = manager.createJob('demo', { name: 'Friendly Label' });

    expect(job.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(job.runId).toBe(job.id);
    expect(manager.getJob('demo', 'friendly-label')?.id).toBe(job.id);
    expect(fs.existsSync(path.join(workspaceDir, '.reactive', 'skills', 'demo', 'runs', job.id, 'job.json'))).toBe(true);
    const metadata = JSON.parse(fs.readFileSync(path.join(workspaceDir, '.reactive', 'skills', 'demo', 'runs', job.id, 'job.json'), 'utf8'));
    expect(metadata.runId).toBe(job.id);
    expect(metadata.name).toBe('friendly-label');
    expect(fs.existsSync(path.join(workspaceDir, '.reactive', 'skills', 'demo', 'runs', job.id, 'artifacts'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceDir, '.reactive', 'skills', 'demo', 'runs', job.id, 'logs'))).toBe(true);

    manager.updateJob('demo', job.id, { name: 'Renamed Label' });
    expect(manager.resolveRunId('demo', 'renamed-label')).toBe(job.id);
  });

  it('serializes concurrent appends and enables foreign keys', async () => {
    const workspaceDir = tempWorkspace();
    const runId = createSortableId();
    const stores = Array.from({ length: 4 }, () => new EventStore({ workspaceDir, skillId: 'demo', runId, enableSqlite: true }));

    await Promise.all(stores.map((store, index) => Promise.resolve().then(() => store.append(`STEP_${index}`, {}))));

    const driver = stores[0].getSqliteDriver()!;
    const events = driver.queryEvents({ runId });
    expect(events.map(event => event.seq)).toEqual([1, 2, 3, 4]);
    expect(driver.querySql('PRAGMA foreign_keys')[0].foreign_keys).toBe(1);
    expect(driver.querySql("SELECT sql FROM sqlite_master WHERE name = 'events'")[0].sql).toContain('UNIQUE(run_id, seq)');
    stores.forEach(store => store.close());
  });

  it('treats duplicate idempotency keys as one append', () => {
    const workspaceDir = tempWorkspace();
    const store = new EventStore({ workspaceDir, skillId: 'demo', runId: createSortableId(), enableSqlite: true });

    const first = store.append('SIGNAL_EMITTED', { signal: 'GO' }, { idempotencyKey: 'request-1' });
    const second = store.append('SIGNAL_EMITTED', { signal: 'GO' }, { idempotencyKey: 'request-1' });

    expect(second.id).toBe(first.id);
    expect(store.getEventCount()).toBe(1);
    store.close();
  });

  it('retries transient SQLITE_BUSY failures before appending', () => {
    const driver = new SQLiteStorageDriver(':memory:', { runId: 'run-busy' });
    const operation = vi.fn()
      .mockImplementationOnce(() => { const error: any = new Error('database is locked'); error.code = 'SQLITE_BUSY'; throw error; })
      .mockImplementationOnce(() => { const error: any = new Error('SQLITE_BUSY'); error.code = 'SQLITE_BUSY'; throw error; })
      .mockReturnValue('completed');

    expect((driver as any).withBusyRetry(operation)).toBe('completed');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(driver.querySql('PRAGMA busy_timeout')[0].timeout).toBe(5000);
    driver.close();
  });

  it('rolls back a failed append transaction and remains usable', () => {
    const driver = new SQLiteStorageDriver(':memory:', { runId: 'run-recovery' });
    const originalInsert = (driver as any).insertEventInternal.bind(driver);
    const insertSpy = vi.spyOn(driver as any, 'insertEventInternal')
      .mockImplementationOnce(() => { throw new Error('simulated append failure'); })
      .mockImplementation(originalInsert);

    expect(() => driver.appendEvent({
      id: 'failed-event',
      event_id: 'failed-event',
      seq: 0,
      timestamp: new Date().toISOString(),
      type: 'FAILED_APPEND',
      run_id: 'run-recovery',
      payload: {},
    })).toThrow('simulated append failure');
    expect(driver.getEventCount('run-recovery')).toBe(0);

    const recovered = driver.appendEvent({
      id: 'recovered-event',
      event_id: 'recovered-event',
      seq: 0,
      timestamp: new Date().toISOString(),
      type: 'RECOVERED_APPEND',
      run_id: 'run-recovery',
      payload: {},
    });
    expect(recovered.seq).toBe(1);
    insertSpy.mockRestore();
    driver.close();
  });

  it('serializes concurrent signals targeting one run and makes duplicate signals idempotent', async () => {
    const workspaceDir = tempWorkspace();
    const engine = new FSMEngine({
      skillDir: path.resolve('skills/_test_hsm_skill'),
      workspaceDir,
      jobId: createSortableId(),
    });

    const results = await Promise.all([
      engine.handleSignal('START_WORK', {}, { idempotencyKey: 'start-1' }),
      engine.handleSignal('START_WORK', {}, { idempotencyKey: 'start-1' }),
    ]);

    expect(results.filter(result => result.transitioned)).toHaveLength(1);
    expect(results[1].event.id).toBe(results[0].event.id);
    expect(engine.getCurrentState()).toBe('ACTIVE_WORK.TASK_A');
    engine.close();
  });

  it('repairs JSONL from SQLite after a projection write failure', () => {
    const workspaceDir = tempWorkspace();
    const runId = createSortableId();
    const store = new EventStore({ workspaceDir, skillId: 'demo', runId, enableSqlite: true });
    store.append('ONE', {});
    const jsonlPath = path.join(workspaceDir, '.reactive', 'skills', 'demo', 'events.jsonl');
    fs.unlinkSync(jsonlPath);
    expect(store.syncJsonlFromSqlite()).toBe(1);
    expect(JSON.parse(fs.readFileSync(jsonlPath, 'utf8').trim()).run_id).toBe(runId);
    store.close();
  });

  it('imports legacy per-job JSONL into a UUID-backed run without deleting source data', () => {
    const workspaceDir = tempWorkspace();
    const legacyDir = path.join(workspaceDir, '.reactive', 'skills', 'demo', 'jobs', 'old-alias');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.mkdirSync(path.join(legacyDir, 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(legacyDir, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'artifacts', 'result.txt'), 'artifact-body', 'utf8');
    fs.writeFileSync(path.join(legacyDir, 'logs', 'run.log'), 'log-body', 'utf8');
    fs.writeFileSync(path.join(legacyDir, 'events.jsonl'), JSON.stringify({
      id: 'legacy-event',
      seq: 1,
      timestamp: new Date().toISOString(),
      type: 'LEGACY',
      payload: {},
    }) + '\n', 'utf8');

    const runId = createSortableId();
    const store = new EventStore({ workspaceDir, skillId: 'demo', runId, enableSqlite: true });
    const allRuns = store.getSqliteDriver()!.queryEvents({ allRuns: true });
    expect(allRuns).toHaveLength(1);
    expect(allRuns[0].run_id).not.toBe('old-alias');
    expect(fs.existsSync(path.join(legacyDir, 'events.jsonl'))).toBe(true);
    const manager = new JobManager(workspaceDir);
    expect(manager.resolveRunId('demo', 'old-alias')).toBe(allRuns[0].run_id);
    expect(fs.readFileSync(path.join(workspaceDir, '.reactive', 'skills', 'demo', 'runs', allRuns[0].run_id, 'artifacts', 'result.txt'), 'utf8'))
      .toBe('artifact-body');
    expect(fs.readFileSync(path.join(workspaceDir, '.reactive', 'skills', 'demo', 'runs', allRuns[0].run_id, 'logs', 'run.log'), 'utf8'))
      .toBe('log-body');
    expect(fs.existsSync(path.join(legacyDir, 'artifacts', 'result.txt'))).toBe(true);
    store.close();
  });
});
