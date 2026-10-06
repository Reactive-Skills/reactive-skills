import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { EventStore, EventStoreOpenError, SQLiteStorageDriver } from '../src/core/event-store.js';
import { JobManager } from '../src/core/job-manager.js';

/** Schema-v2 ledger: run_id is a plain column and the derived tables carry no run_id (#43). */
function seedLegacyV2Db(file: string, eventRunIds: Array<string | null>): void {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE events (
      id TEXT PRIMARY KEY, event_id TEXT, seq INTEGER NOT NULL, timestamp TEXT NOT NULL, occurred_at TEXT,
      type TEXT NOT NULL, event_type TEXT, state TEXT, source TEXT, causation_id TEXT, correlation_id TEXT,
      request_id TEXT, trace_parent TEXT, skill_id TEXT, run_id TEXT, parent_run_id TEXT, schema_version TEXT,
      payload TEXT NOT NULL
    );
    CREATE TABLE projections (name TEXT PRIMARY KEY, content TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE state_snapshots (seq INTEGER PRIMARY KEY, state TEXT NOT NULL, context TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE projection_watermarks (name TEXT PRIMARY KEY, event_seq INTEGER NOT NULL, projection_version TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    INSERT INTO schema_version (version, applied_at) VALUES (2, '2026-01-01T00:00:00.000Z');
    INSERT INTO state_snapshots VALUES (1, 'INIT', '{"mission":"legacy"}', '2026-01-01T00:00:00.000Z');
    INSERT INTO projections VALUES ('PROGRESS.md', 'legacy', '2026-01-01T00:00:00.000Z');
    INSERT INTO projection_watermarks VALUES ('PROGRESS.md', 1, '1', '2026-01-01T00:00:00.000Z');
  `);
  eventRunIds.forEach((runId, index) => {
    db.prepare(`
      INSERT INTO events (id, event_id, seq, timestamp, type, run_id, payload)
      VALUES (?, ?, ?, '2026-01-01T00:00:00.000Z', 'SKILL_INITIALIZED', ?, '{}')
    `).run(`legacy-${index}`, `legacy-${index}`, index + 1, runId);
  });
  db.close();
}

describe('legacy schema migration of the skill ledger', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-legacy-migration-'));
    dbPath = path.join(dir, 'events.db');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('attaches snapshots, projections and watermarks to the run that owns the legacy events', () => {
    seedLegacyV2Db(dbPath, ['default']);

    const driver = new SQLiteStorageDriver(dbPath, { runId: 'fresh-run' });
    try {
      expect(driver.getLatestSnapshot('default')?.context).toEqual({ mission: 'legacy' });
      expect(driver.getProjection('PROGRESS.md', 'default')).toBe('legacy');
      expect(driver.getProjectionWatermark('PROGRESS.md', 'default')).toEqual({ eventSeq: 1, projectionVersion: '1' });
      expect(driver.getLatestSnapshot('fresh-run')).toBeNull();
      expect(driver.getProjection('PROGRESS.md', 'fresh-run')).toBeNull();
    } finally {
      driver.close();
    }
  });

  it('drops derived rows instead of guessing when the legacy events span several runs', () => {
    seedLegacyV2Db(dbPath, ['run-a', 'run-b']);

    const driver = new SQLiteStorageDriver(dbPath, { runId: 'fresh-run' });
    try {
      expect(driver.getEventCount('run-a')).toBe(1);
      expect(driver.getEventCount('run-b')).toBe(1);
      expect(driver.querySql('SELECT COUNT(*) AS count FROM state_snapshots')).toEqual([{ count: 0 }]);
      expect(driver.querySql('PRAGMA foreign_key_check')).toEqual([]);
    } finally {
      driver.close();
    }
  });

  it('keeps adopting run-less legacy rows into the run being opened', () => {
    seedLegacyV2Db(dbPath, [null]);

    const driver = new SQLiteStorageDriver(dbPath, { runId: 'fresh-run' });
    try {
      expect(driver.getEventCount('fresh-run')).toBe(1);
      expect(driver.getLatestSnapshot('fresh-run')?.context).toEqual({ mission: 'legacy' });
    } finally {
      driver.close();
    }
  });
});

describe('EventStore open failures', () => {
  let workspace: string;
  let store: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-store-open-'));
    store = path.join(workspace, '.reactive', 'skills', 'broken');
    fs.mkdirSync(store, { recursive: true });
    fs.writeFileSync(path.join(store, 'events.db'), 'not a sqlite database '.repeat(64));
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('names the ledger path and a recovery command, and leaves no run directory behind', () => {
    const attempt = () => new EventStore({ workspaceDir: workspace, skillId: 'broken', jobId: 'new-run', enableSqlite: true });

    expect(attempt).toThrow(EventStoreOpenError);
    try {
      attempt();
    } catch (error) {
      const dbPath = path.join(store, 'events.db');
      expect((error as EventStoreOpenError).code).toBe('EVENT_STORE_OPEN_FAILED');
      expect((error as EventStoreOpenError).storePath).toBe(dbPath);
      expect((error as Error).message).toContain(dbPath);
      expect((error as EventStoreOpenError).recovery).toContain(`mv "${dbPath}" "${dbPath}.bak"`);
    }
    expect(fs.existsSync(path.join(store, 'runs'))).toBe(false);
    expect(new JobManager(workspace).listJobs('broken')).toEqual([]);
  });
});

describe('EventStore lock contention', () => {
  it('keeps the holder\'s lock when another opener is refused', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-lock-contention-'));
    const open = () => new EventStore({ workspaceDir: workspace, skillId: 'locked', jobId: 'shared-run', enableSqlite: true, acquireLock: true });
    const holder = open();
    try {
      expect(open).toThrow(/JOB_LOCKED/);
      // A refused opener must not delete the lock it never took, or a third opener would get in.
      expect(open).toThrow(/JOB_LOCKED/);
    } finally {
      holder.close();
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe('JobManager.listJobs over a mixed legacy store', () => {
  it('lists a legacy job once even when runs/ also holds a directory with its legacy name', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-list-jobs-'));
    try {
      const store = path.join(workspace, '.reactive', 'skills', 'mixed');
      const legacyJob = path.join(store, 'jobs', 'default');
      fs.mkdirSync(legacyJob, { recursive: true });
      fs.writeFileSync(path.join(legacyJob, 'job.json'), JSON.stringify({
        id: 'default', name: 'default', skillId: 'mixed', status: 'active', currentState: 'INIT',
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }));
      fs.mkdirSync(path.join(store, 'runs', 'default'), { recursive: true });

      const manager = new JobManager(workspace);
      manager.migrateLegacyRuns('mixed');
      const ids = manager.listJobs('mixed').map(job => job.id);

      expect(ids).toHaveLength(1);
      expect(new Set(ids).size).toBe(1);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
