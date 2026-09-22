import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SQLiteStorageDriver } from '../src/core/event-store.js';

describe('SQLite read-only compatibility', () => {
  it('reads snapshots from a legacy schema without run_id', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-readonly-legacy-'));
    const dbPath = path.join(workspaceDir, 'events.db');
    const seed = new DatabaseSync(dbPath);

    seed.exec(`
      CREATE TABLE state_snapshots (
        seq INTEGER NOT NULL,
        state TEXT NOT NULL,
        context TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO state_snapshots (seq, state, context, created_at)
      VALUES (1, 'ACTIVE', '{}', '2026-01-01T00:00:00.000Z');
    `);
    seed.close();

    const driver = new SQLiteStorageDriver(dbPath, { readOnly: true, runId: 'run-legacy' });
    try {
      expect(driver.getLatestSnapshot('run-legacy')).toEqual({
        seq: 1,
        state: 'ACTIVE',
        context: {},
      });
    } finally {
      driver.close();
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  });
});
