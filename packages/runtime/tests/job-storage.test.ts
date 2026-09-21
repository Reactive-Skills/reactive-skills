import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventStore } from '../src/core/event-store.js';

describe('Job Storage & Concurrency Locks (Leaf 2)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-job-storage-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('run-scoped paths: resolves to .reactive/skills/<skill>/runs/<runId>/', () => {
    const store = new EventStore({
      workspaceDir: tmpDir,
      skillId: 'synthesis',
      jobId: 'auth-slice-1',
      enableSqlite: true,
    });

    store.append('TEST_SIGNAL', { value: 42 });
    store.close();

    const skillDir = path.join(tmpDir, '.reactive', 'skills', 'synthesis');
    const expectedRunDir = path.join(skillDir, 'runs', 'auth-slice-1');
    expect(fs.existsSync(path.join(skillDir, 'events.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'events.db'))).toBe(true);
    expect(fs.existsSync(path.join(expectedRunDir, 'artifacts'))).toBe(true);
    expect(fs.existsSync(path.join(expectedRunDir, 'logs'))).toBe(true);
  });

  it('legacy store fallback: uses skill root when legacy events.jsonl exists without jobs/ directory', () => {
    const legacyDir = path.join(tmpDir, '.reactive', 'skills', 'synthesis');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'events.jsonl'), '{"id":"legacy-1","seq":1,"type":"INIT","timestamp":"2026-01-01T00:00:00Z","payload":{}}\n');

    const store = new EventStore({
      workspaceDir: tmpDir,
      skillId: 'synthesis',
      jobId: 'default',
      enableSqlite: true,
    });

    const events = store.getAll();
    expect(events.length).toBe(1);
    expect(events[0].id).toBe('legacy-1');
    store.close();
  });

  it('concurrency lock contention: prevents two instances from writing to the same job concurrently', () => {
    const store1 = new EventStore({
      workspaceDir: tmpDir,
      skillId: 'synthesis',
      jobId: 'concurrent-slice',
      acquireLock: true,
    });

    expect(() => {
      new EventStore({
        workspaceDir: tmpDir,
        skillId: 'synthesis',
        jobId: 'concurrent-slice',
        acquireLock: true,
      });
    }).toThrow(/JOB_LOCKED|locked/i);

    store1.close();

    // After closing store1, acquiring the lock should succeed
    const store2 = new EventStore({
      workspaceDir: tmpDir,
      skillId: 'synthesis',
      jobId: 'concurrent-slice',
      acquireLock: true,
    });
    store2.close();
  });

  it('parallel independent jobs: allows distinct jobs to execute concurrently in the same workspace', () => {
    const storeA = new EventStore({
      workspaceDir: tmpDir,
      skillId: 'synthesis',
      jobId: 'slice-alpha',
      acquireLock: true,
    });

    const storeB = new EventStore({
      workspaceDir: tmpDir,
      skillId: 'synthesis',
      jobId: 'slice-beta',
      acquireLock: true,
    });

    storeA.append('ALPHA_SIGNAL', { slice: 'alpha' });
    storeB.append('BETA_SIGNAL', { slice: 'beta' });

    expect(storeA.getAll().length).toBe(1);
    expect(storeB.getAll().length).toBe(1);
    expect(storeA.getAll()[0].type).toBe('ALPHA_SIGNAL');
    expect(storeB.getAll()[0].type).toBe('BETA_SIGNAL');

    storeA.close();
    storeB.close();
  });
});
