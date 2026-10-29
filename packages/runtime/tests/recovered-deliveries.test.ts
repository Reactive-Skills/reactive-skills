import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { EventStore, SQLiteStorageDriver } from '../src/core/event-store.js';

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('Recovered view delivery metadata', () => {
  it.each([false, true])('deduplicates credits, absorbs original deliveries and resets with SQLite=%s', enableSqlite => {
    const store = new EventStore({ inMemory: true, enableSqlite, runId: 'run' });
    try {
      const signal = store.append('SIGNAL_EMITTED', { signal: 'CHECK' });
      const version = store.getRunVersion();
      store.recordRecoveredDelivery(signal.seq, 'original:DELIVERY');
      store.recordRecoveredDelivery(signal.seq, 'retry:DELIVERY');
      expect(store.getRecoveredDelivery(signal.seq)).toBe('original:DELIVERY');
      expect(store.countRecoveredDeliveries(3)).toBe(1);
      expect(store.getRunVersion()).toBe(version);
      store.append('AGENT_TURN_STARTED', {}, { idempotencyKey: 'original:DELIVERY', deliveryViewSeq: signal.seq });
      expect(store.getRecoveredDelivery(signal.seq)).toBeUndefined();
      expect(store.countRecoveredDeliveries(3)).toBe(0);
      store.recordRecoveredDelivery(signal.seq, 'late:DELIVERY');
      expect(store.countRecoveredDeliveries(3)).toBe(0);
      const next = store.append('SIGNAL_EMITTED', { signal: 'NEXT' });
      store.recordRecoveredDelivery(next.seq, 'next:DELIVERY');
      expect(store.countRecoveredDeliveries(3)).toBe(1);
      store.append('STATE_TRANSITION', { to: 'NEXT' });
      expect(store.countRecoveredDeliveries(3)).toBe(0);
      store.clear();
      expect(store.getRecoveredDelivery(next.seq)).toBeUndefined();
    } finally {
      store.close();
    }
  });

  it('persists credits in the selected run and leaves read-only legacy stores untouched', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-deliveries-'));
    scratch.push(dir);
    const dbPath = path.join(dir, 'events.db');
    const writer = new EventStore({ workspaceDir: dir, sqlitePath: dbPath, runId: 'one' });
    const other = new EventStore({ workspaceDir: dir, sqlitePath: dbPath, runId: 'two' });
    const event = writer.append('SIGNAL_EMITTED', {});
    writer.recordRecoveredDelivery(event.seq, 'one:DELIVERY');
    expect(other.countRecoveredDeliveries(3)).toBe(0);
    expect(other.getRecoveredDelivery(event.seq)).toBeUndefined();
    writer.close();
    other.close();
    const reader = new EventStore({ workspaceDir: dir, sqlitePath: dbPath, runId: 'one', readOnly: true });
    expect(reader.getRecoveredDelivery(event.seq)).toBe('one:DELIVERY');
    expect(reader.countRecoveredDeliveries(3)).toBe(1);
    expect(() => reader.recordRecoveredDelivery(event.seq, 'forbidden')).toThrow('read-only');
    reader.close();
    const db = new DatabaseSync(dbPath);
    db.exec('DROP TABLE recovered_deliveries');
    db.close();
    const legacy = new SQLiteStorageDriver(dbPath, { readOnly: true, runId: 'one' });
    expect(legacy.countRecoveredDeliveries(3)).toBe(0);
    expect(legacy.getRecoveredDelivery(event.seq)).toBeUndefined();
    legacy.close();
    const upgraded = new SQLiteStorageDriver(dbPath, { runId: 'one' });
    expect(upgraded.countRecoveredDeliveries(3)).toBe(0);
    upgraded.recordRecoveredDelivery(event.seq, 'upgraded:DELIVERY');
    expect(upgraded.countRecoveredDeliveries(3)).toBe(1);
    upgraded.clearAll();
    expect(upgraded.countRecoveredDeliveries(3)).toBe(0);
    upgraded.close();
  });
});
