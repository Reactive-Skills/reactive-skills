import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { EventStore, SQLiteStorageDriver, createSortableId } from '../src/core/event-store.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { CHECKPOINT_CHUNK_BYTES } from '../src/core/jsonl-checkpoint.js';

const workspaces: string[] = [];
function fixture(maxJsonlBytes = 100_000) {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-open-checkpoint-'));
  workspaces.push(workspaceDir);
  const options = { workspaceDir, skillId: 'checkpoint', runId: createSortableId(), enableSqlite: true, maxJsonlBytes };
  const dir = path.join(workspaceDir, '.reactive', 'skills', 'checkpoint');
  const current = path.join(dir, 'events.jsonl');
  const open = () => new EventStore(options);
  const files = () => fs.readdirSync(dir).filter(name => /^events(-\d{6})?\.jsonl$/.test(name))
    .sort((a, b) => a === 'events.jsonl' ? 1 : b === 'events.jsonl' ? -1 : a.localeCompare(b))
    .map(name => path.join(dir, name));
  const seed = open();
  for (let index = 0; index < 16; index++) seed.append('STEP', { index, text: 'original' });
  const canonical = seed.query({ allRuns: true });
  seed.close();
  return { options, dir, current, checkpoint: `${current}.checkpoint.json`, open, files, canonical };
}
function mirror(files: string[]) {
  return files.flatMap(file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  }));
}
function bytes(files: string[]) {
  return files.map(file => [path.basename(file), fs.readFileSync(file, 'utf8')]);
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of workspaces.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('verified ledger open', () => {
  it('skips object reconciliation only after verifying the certified inventory', () => {
    const f = fixture(2_000);
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    const store = f.open();
    store.close();
    expect(reconcile).not.toHaveBeenCalled();
    expect(mirror(f.files())).toEqual(f.canonical);
    expect(fs.existsSync(f.checkpoint)).toBe(true);
  });

  it.each([
    'missing checkpoint', 'truncated checkpoint', 'missing current', 'truncated current',
    'missing rotated', 'truncated rotated', 'interior hole', 'stale boundary', 'changed generation',
  ])('fully repairs %s, including damage below the checkpoint', damage => {
    const f = fixture(2_000);
    const first = f.files()[0];
    const text = fs.readFileSync(first, 'utf8');
    switch (damage) {
      case 'missing checkpoint': fs.rmSync(f.checkpoint, { force: true }); break;
      case 'truncated checkpoint': fs.writeFileSync(f.checkpoint, '{'); break;
      case 'missing current': fs.unlinkSync(f.current); break;
      case 'truncated current': fs.truncateSync(f.current, 15); break;
      case 'missing rotated': fs.unlinkSync(first); break;
      case 'truncated rotated': fs.truncateSync(first, 15); break;
      case 'interior hole': fs.writeFileSync(first, text.split('\n').slice(1).join('\n')); break;
      case 'stale boundary':
      case 'changed generation': {
        const checkpoint = JSON.parse(fs.readFileSync(f.checkpoint, 'utf8'));
        if (damage === 'stale boundary') checkpoint.ledgerSeq += 100;
        else checkpoint.generation = 'unknown';
        fs.writeFileSync(f.checkpoint, JSON.stringify(checkpoint));
      }
    }
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    const store = f.open();
    store.close();
    expect(reconcile).toHaveBeenCalledOnce();
    expect(mirror(f.files())).toEqual(f.canonical);
    reconcile.mockClear();
    f.open().close();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it.each(['same-length replacement', 'extra segment', 'duplicate line', 'foreign line', 'reordered lines'])(
    'delegates %s to the full reconciler, which keeps JSONL-only rows and certifies the result', damage => {
      const f = fixture(2_000);
      const first = f.files()[0];
      const text = fs.readFileSync(first, 'utf8');
      switch (damage) {
        case 'same-length replacement': fs.writeFileSync(first, text.replace('original', 'modified')); break;
        case 'extra segment': fs.writeFileSync(path.join(f.dir, 'events-999999.jsonl'), text); break;
        case 'duplicate line': fs.appendFileSync(f.current, `${text.split('\n')[0]}\n`); break;
        case 'foreign line': fs.appendFileSync(f.current, `${JSON.stringify({ ...f.canonical[0], id: 'foreign' })}\n`); break;
        case 'reordered lines': fs.writeFileSync(first, `${text.trim().split('\n').reverse().join('\n')}\n`); break;
      }
      const damaged = bytes(f.files());
      const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
      f.open().close();
      expect(reconcile).toHaveBeenCalledOnce();
      expect(bytes(f.files())).toEqual(damaged);
      reconcile.mockClear();
      f.open().close();
      expect(reconcile).not.toHaveBeenCalled();
    });

  it('keeps newer JSONL-only rows when an older events.db backup is restored', () => {
    const f = fixture();
    const db = new DatabaseSync(path.join(f.dir, 'events.db'));
    db.exec('DELETE FROM events WHERE ledger_seq > 10');
    db.close();
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    const store = f.open();
    expect(reconcile).toHaveBeenCalledOnce();
    expect(store.getSqliteDriver()!.getLedgerBoundary().ledgerSeq).toBe(10);
    expect(mirror(f.files())).toEqual(f.canonical);
    expect(store.rebuildFromJsonl()).toBe(16);
    expect(store.getSqliteDriver()!.queryEvents({ allRuns: true }).map(event => event.id)).toEqual(f.canonical.map(event => event.id));
    store.close();
  });

  it('imports a populated JSONL mirror into a migrated old-schema store with an empty events table', () => {
    const f = fixture();
    const db = new DatabaseSync(path.join(f.dir, 'events.db'));
    db.exec('DELETE FROM events; DELETE FROM schema_version; INSERT INTO schema_version (version, applied_at) VALUES (2, CURRENT_TIMESTAMP)');
    db.close();
    const store = f.open();
    const canonical = store.getSqliteDriver()!.queryEvents({ allRuns: true });
    expect(canonical.map(event => event.id)).toEqual(f.canonical.map(event => event.id));
    expect(mirror(f.files()).map(event => event.id)).toEqual(f.canonical.map(event => event.id));
    store.close();
  });

  it('reads only the canonical tail after a certified boundary across multiple runs', () => {
    const f = fixture();
    const writer = f.open();
    writer.getSqliteDriver()!.appendEvent({ id: createSortableId(), seq: 0, timestamp: new Date().toISOString(), type: 'OTHER', payload: {}, run_id: createSortableId() });
    const expected = writer.getSqliteDriver()!.queryEvents({ allRuns: true });
    writer.close();
    const query = vi.spyOn(SQLiteStorageDriver.prototype, 'queryEvents');
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    f.open().close();
    expect(reconcile).not.toHaveBeenCalled();
    expect(query.mock.calls.filter(([options]) => options?.allRuns)).toEqual([[{ allRuns: true, sinceLedgerSeq: 16, untilLedgerSeq: 17 }]]);
    expect(mirror(f.files())).toEqual(expected);
  });

  it('rejects a valid but stale certificate after more bytes were mirrored', () => {
    const f = fixture();
    const stale = fs.readFileSync(f.checkpoint, 'utf8');
    const store = f.open();
    store.append('NEWER', {});
    const canonical = store.getAll();
    store.close();
    fs.writeFileSync(f.checkpoint, stale);
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    f.open().close();
    expect(reconcile).toHaveBeenCalledOnce();
    expect(mirror(f.files())).toEqual(canonical);
  });

  it('invalidates a certificate when migrating the canonical schema', () => {
    const f = fixture();
    const oldGeneration = JSON.parse(fs.readFileSync(f.checkpoint, 'utf8')).generation;
    const db = new DatabaseSync(path.join(f.dir, 'events.db'));
    db.exec('DELETE FROM schema_version; INSERT INTO schema_version (version, applied_at) VALUES (2, CURRENT_TIMESTAMP)');
    db.close();
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    const store = f.open();
    expect(reconcile).toHaveBeenCalledOnce();
    expect(store.getSqliteDriver()!.getLedgerBoundary().generation).not.toBe(oldGeneration);
    expect(mirror(f.files())).toEqual(store.getAll());
    store.close();
  });

  it.each(['before JSONL', 'partial JSONL', 'before publication', 'after publication'])('recovers a failure %s without losing canonical events', failure => {
    const f = fixture();
    const store = f.open();
    const append = fs.appendFileSync;
    const rename = fs.renameSync;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const appendSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation(((file: string, data: string, ...args: any[]) => {
      if (file === f.current && (failure === 'before JSONL' || failure === 'partial JSONL')) {
        if (failure === 'partial JSONL') append(file, data.slice(0, 30), 'utf8');
        throw new Error('simulated mirror failure');
      }
      return (append as any)(file, data, ...args);
    }) as any);
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation((source, target) => {
      if (target === f.checkpoint) {
        if (failure === 'after publication') rename(source, target);
        throw new Error('simulated checkpoint publication failure');
      }
      rename(source, target);
    });
    const event = store.append('COMMITTED', { text: 'retained' });
    expect(store.getAll().at(-1)?.id).toBe(event.id);
    const canonical = store.getAll();
    store.close();
    appendSpy.mockRestore();
    renameSpy.mockRestore();
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    f.open().close();
    expect(reconcile.mock.calls.length).toBe(failure === 'partial JSONL' || failure === 'before publication' ? 1 : 0);
    expect(mirror(f.files())).toEqual(canonical);
    reconcile.mockClear();
    f.open().close();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it.each(['partial chunk', 'completed chunk', 'rotated segment'])('does not certify an earlier external edit during append in a %s', location => {
    const f = fixture(location === 'rotated segment' ? 2_000 : 1_000_000);
    const store = f.open();
    if (location === 'completed chunk') store.append('LARGE', { text: 'x'.repeat(CHECKPOINT_CHUNK_BYTES * 2) });
    const file = f.files()[0];
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('original', 'modified'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.append('AFTER_EDIT', {});
    const canonical = store.getAll();
    store.close();
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    f.open().close();
    expect(reconcile).toHaveBeenCalledOnce();
    expect(mirror(f.files()).map(event => event.id)).toEqual(canonical.map(event => event.id));
    expect(fs.readFileSync(file, 'utf8')).toContain('modified');
  });

  it.each(['clear', 'clearAll', 'rebuildEvents', 'empty rebuild', 'rebuildFromJsonl', 'replacement'])('invalidates certification on %s', operation => {
    const f = fixture();
    const store = f.open();
    const before = JSON.parse(fs.readFileSync(f.checkpoint, 'utf8'));
    const driver = store.getSqliteDriver()!;
    if (operation === 'clear') store.clear();
    if (operation === 'clearAll') driver.clearAll();
    if (operation === 'rebuildEvents') driver.rebuildEvents(f.canonical);
    if (operation === 'empty rebuild') driver.rebuildEvents([]);
    if (operation === 'rebuildFromJsonl') store.rebuildFromJsonl();
    store.close();
    if (operation === 'replacement') fs.unlinkSync(path.join(f.dir, 'events.db'));
    const reopened = f.open();
    const boundary = reopened.getSqliteDriver()!.getLedgerBoundary();
    expect(boundary.generation).not.toBe(before.generation);
    expect(reopened.getEventCount()).toBe(operation === 'clear' ? 0 : 16);
    expect(mirror(f.files())).toEqual(reopened.getSqliteDriver()!.queryEvents({ allRuns: true }));
    reopened.close();
    expect(JSON.parse(fs.readFileSync(f.checkpoint, 'utf8')).generation).toBe(boundary.generation);
  });

  it('certifies legacy run import once and preserves the clean-open fast path thereafter', () => {
    const f = fixture();
    const legacy = path.join(f.dir, 'jobs', 'old');
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, 'events.jsonl'), `${JSON.stringify({ id: createSortableId(), seq: 1,
      timestamp: '2026-01-01T00:00:00.000Z', type: 'LEGACY', payload: {} })}\n`);
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    const imported = f.open();
    expect(reconcile).toHaveBeenCalledOnce();
    const canonical = imported.getSqliteDriver()!.queryEvents({ allRuns: true });
    expect(canonical).toHaveLength(17);
    expect(mirror(f.files())).toEqual(canonical);
    imported.close();
    reconcile.mockClear();
    f.open().close();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('keeps explicit repair full and read-only open free of certificate writes', () => {
    const f = fixture();
    const content = fs.readFileSync(f.checkpoint, 'utf8');
    new EventStore({ ...f.options, readOnly: true }).close();
    expect(fs.readFileSync(f.checkpoint, 'utf8')).toBe(content);
    const store = f.open();
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    store.syncJsonlFromSqlite();
    expect(reconcile).toHaveBeenCalledOnce();
    store.close();
  });

  it('bounds append reads to new bytes and one partial chunk as certified history grows', () => {
    const f = fixture(1_000_000);
    const store = f.open();
    store.append('LARGE', { text: 'x'.repeat(CHECKPOINT_CHUNK_BYTES * 20) });
    const read = vi.spyOn(fs, 'readSync');
    store.append('SMALL', {});
    const bytes = read.mock.calls.reduce((sum, args) => sum + Number(args[3] || 0), 0);
    expect(bytes).toBeLessThan(CHECKPOINT_CHUNK_BYTES * 3);
    store.close();
  });

  it('certifies only the captured boundary when another writer commits during open verification', () => {
    const f = fixture();
    const writer = new SQLiteStorageDriver(path.join(f.dir, 'events.db'), { runId: f.options.runId, skillId: f.options.skillId });
    const read = fs.readSync;
    let committed = false;
    const readSpy = vi.spyOn(fs, 'readSync').mockImplementation(((...args: any[]) => {
      if (!committed) {
        committed = true;
        writer.appendEvent({ id: createSortableId(), seq: 0, timestamp: new Date().toISOString(), type: 'CONCURRENT', payload: {} });
      }
      return (read as any)(...args);
    }) as any);
    f.open().close();
    readSpy.mockRestore();
    expect(JSON.parse(fs.readFileSync(f.checkpoint, 'utf8')).ledgerSeq).toBe(16);
    f.open().close();
    expect(mirror(f.files())).toEqual(writer.queryEvents({ allRuns: true }));
    writer.close();
  });

  it('coordinates concurrent process opens and appends across runs and rotations', async () => {
    const f = fixture(2_000);
    const source = pathToFileURL(path.resolve('packages/runtime/src/core/event-store.ts')).href;
    const worker = (runId: string) => new Promise<void>((resolve, reject) => {
      const script = `import { EventStore } from ${JSON.stringify(source)};
        const options = ${JSON.stringify({ ...f.options, runId })};
        for (let index = 0; index < 12; index++) {
          const store = new EventStore(options); store.append('CONCURRENT', { index }); store.close();
        }`;
      const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: path.resolve('packages/runtime') });
      let stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(stderr)));
    });
    await Promise.all([worker(createSortableId()), worker(createSortableId()), worker(createSortableId())]);
    const store = f.open();
    const canonical = store.getSqliteDriver()!.queryEvents({ allRuns: true });
    expect(canonical).toHaveLength(52);
    expect(mirror(f.files())).toEqual(canonical);
    store.close();
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    f.open().close();
    expect(reconcile).not.toHaveBeenCalled();
  }, 30_000);

  it.each(['before', 'after'])('repairs or verifies after process termination %s checkpoint publication', async position => {
    const f = fixture();
    const source = pathToFileURL(path.resolve('packages/runtime/src/core/event-store.ts')).href;
    const script = `import fs from 'node:fs'; import { EventStore } from ${JSON.stringify(source)};
      const store = new EventStore(${JSON.stringify(f.options)});
      const rename = fs.renameSync;
      fs.renameSync = (source, target) => {
        if (target === ${JSON.stringify(f.checkpoint)}) {
          if (${JSON.stringify(position)} === 'after') rename(source, target);
          process.exit(0);
        }
        rename(source, target);
      };
      store.append('BEFORE_EXIT', {}); process.exit(1);`;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: path.resolve('packages/runtime') });
      let stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(stderr)));
    });
    const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
    const store = f.open();
    expect(reconcile.mock.calls.length).toBe(position === 'before' ? 1 : 0);
    expect(store.getEventCount()).toBe(17);
    expect(mirror(f.files())).toEqual(store.getAll());
    store.close();
  });

  it('keeps engine-open object work bounded as history grows and verifies all rotated bytes', () => {
    const f = fixture(1_000_000);
    const observations: Array<{ events: number; bytes: number; segments: number; p50ms: number }> = [];
    for (const count of [1_000, 10_000, 50_000]) {
      const seed = f.open();
      const driver = seed.getSqliteDriver()!;
      const start = driver.getLatestLedgerSequence();
      driver.importEvents(Array.from({ length: count - start }, (_, index) => ({
        id: createSortableId(), seq: start + index + 1, timestamp: '2026-01-01T00:00:00.000Z',
        type: 'STEP', payload: { text: 'x'.repeat(240) }, run_id: f.options.runId,
      })));
      seed.saveSnapshot(count, 'INIT', {});
      seed.syncJsonlFromSqlite();
      seed.close();
      const reconcile = vi.spyOn(EventStore.prototype as any, 'reconcileJsonlUnlocked');
      const allJsonl = vi.spyOn(EventStore.prototype as any, 'readAllJsonlEvents');
      const row = vi.spyOn(SQLiteStorageDriver.prototype as any, 'rowToEvent');
      const samples: number[] = [];
      for (let repeat = 0; repeat < 5; repeat++) {
        row.mockClear();
        const start = performance.now();
        const store = new EventStore({ ...f.options, maxInMemoryEvents: 50 });
        const engine = new FSMEngine({ skillDir: path.resolve('skills/_test_fsm_skill'), workspaceDir: f.options.workspaceDir, eventStore: store });
        expect(engine.getCurrentState()).toBe('INIT');
        engine.close();
        samples.push(performance.now() - start);
        expect(row.mock.calls.length).toBeLessThanOrEqual(50);
      }
      expect(reconcile).not.toHaveBeenCalled();
      expect(allJsonl).not.toHaveBeenCalled();
      const files = f.files();
      observations.push({ events: count, bytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0), segments: files.length,
        p50ms: samples.sort((a, b) => a - b)[2] });
      reconcile.mockRestore(); allJsonl.mockRestore(); row.mockRestore();
    }
    expect(observations.at(-1)!.segments).toBeGreaterThan(1);
    console.info('certified engine open (bytes, not tokens)', JSON.stringify(observations));
  }, 120_000);
});
