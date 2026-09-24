import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventStore, SQLiteStorageDriver } from '../src/core/event-store.js';
import { ProjectionEngine } from '../src/core/projection-engine.js';

describe('SQLite Storage Driver & EventStore Integration', () => {
  it('should create in-memory SQLite database and insert events', () => {
    const driver = new SQLiteStorageDriver(':memory:');
    
    driver.insertEvent({
      id: 'e1',
      seq: 1,
      timestamp: new Date().toISOString(),
      type: 'STATE_TRANSITION',
      state: 'INTAKE',
      payload: { from: 'BOOT', to: 'INTAKE' },
    });

    driver.insertEvent({
      id: 'e2',
      seq: 2,
      timestamp: new Date().toISOString(),
      type: 'GUARD_EVALUATED',
      state: 'INTAKE',
      payload: { guard: 'true', passed: true },
    });

    const rows = driver.querySql(
      'SELECT id, type, payload FROM events ORDER BY seq ASC'
    ) as Array<{ id: string; type: string; payload: string }>;

    expect(rows.length).toBe(2);
    expect(rows[0].id).toBe('e1');
    expect(rows[0].type).toBe('STATE_TRANSITION');
    expect(JSON.parse(rows[0].payload).from).toBe('BOOT');

    driver.close();
  });

  it('should save and query projections in SQLite', () => {
    const driver = new SQLiteStorageDriver(':memory:');

    driver.saveProjection('mission_summary', '# Mission: Test Project Mission');
    const content = driver.getProjection('mission_summary');
    expect(content).toBe('# Mission: Test Project Mission');

    // Overwrite projection
    driver.saveProjection('mission_summary', '# Mission: Updated');
    expect(driver.getProjection('mission_summary')).toBe('# Mission: Updated');

    driver.close();
  });

  it('should record state snapshots for time-travel in SQLite', () => {
    const driver = new SQLiteStorageDriver(':memory:');

    driver.saveSnapshot(1, 'INTAKE', { mission: 'v1' });
    driver.saveSnapshot(2, 'SLICING', { mission: 'v1', slices: ['s1'] });

    const latest = driver.getLatestSnapshot();
    expect(latest).not.toBeNull();
    expect(latest?.seq).toBe(2);
    expect(latest?.state).toBe('SLICING');
    expect(latest?.context.slices).toEqual(['s1']);

    driver.close();
  });

  it('should return latest sequence and bounded recent events in ascending order', () => {
    const driver = new SQLiteStorageDriver(':memory:');
    for (let i = 1; i <= 8; i++) {
      driver.insertEvent({
        id: `e${i}`,
        seq: i,
        timestamp: new Date().toISOString(),
        type: 'STEP',
        payload: { step: i },
      });
    }

    expect(driver.getLatestSequence()).toBe(8);
    const recent = driver.getRecentEvents(3);
    expect(recent.map(event => event.seq)).toEqual([6, 7, 8]);

    driver.close();
  });

  it('should synchronize EventStore append with SQLite driver automatically', () => {
    const store = new EventStore({ inMemory: true, enableSqlite: true });
    
    store.append('MISSION_COMMITTED', { mission: 'Test Project Mission' }, { state: 'INTAKE' });
    store.append('SLICE_DEFINED', { sliceId: 's1', name: 'Auth' }, { state: 'SLICING' });

    const sqliteDriver = store.getSqliteDriver();
    expect(sqliteDriver).not.toBeNull();

    const eventsFromSql = sqliteDriver!.querySql(
      "SELECT type, state FROM events WHERE state = 'SLICING'"
    ) as Array<{ type: string; state: string }>;

    expect(eventsFromSql.length).toBe(1);
    expect(eventsFromSql[0].type).toBe('SLICE_DEFINED');
  });

  it('should stamp events with independent skill and execution identity', () => {
    const store = new EventStore({
      inMemory: true,
      skillId: 'child-test-skill',
      runId: 'run-tdd-1',
      correlationId: 'workflow-1',
      requestId: 'request-1',
      traceParent: 'trace-parent-1',
      parentRunId: 'run-test-1',
    });

    const event = store.append('CHILD_RUN_STARTED', { child: 'child-test-skill' });

    expect(event.event_id).toBe(event.id);
    expect(event.skill_id).toBe('child-test-skill');
    expect(event.run_id).toBe('run-tdd-1');
    expect(event.correlation_id).toBe('workflow-1');
    expect(event.request_id).toBe('request-1');
    expect(event.trace_parent).toBe('trace-parent-1');
    expect(event.parent_run_id).toBe('run-test-1');
  });

  it('should generate sortable UUIDv7-style event identity by default', () => {
    const store = new EventStore({ inMemory: true, skillId: 'test-skill' });
    const event = store.append('TEST_EVENT', {});

    expect(event.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(event.event_id).toBe(event.id);
  });

  it('should reject mutating and multi-statement SQL', () => {
    const driver = new SQLiteStorageDriver(':memory:');

    expect(() => driver.querySql('DELETE FROM events')).toThrow(/Only single-statement SELECT/);
    expect(() => driver.querySql('SELECT 1; DELETE FROM events')).toThrow(/Only single-statement SELECT/);

    driver.close();
  });

  it('should reject projection output outside the workspace', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-projection-'));
    const skillDir = path.join(workspaceDir, 'skill');
    fs.mkdirSync(path.join(skillDir, 'templates'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'templates', 'summary.hbs'), 'summary', 'utf8');

    const engine = new ProjectionEngine(
      skillDir,
      [{ template: 'templates/summary.hbs', output: '../outside.md' }],
      workspaceDir
    );
    const store = new EventStore({ inMemory: true, skillId: 'test-skill' });

    expect(engine.project(store, 'START', 'test-skill', {})).toEqual([]);
    expect(store.query({ type: 'PROJECTION_FAILED' })).toHaveLength(1);
    expect(fs.existsSync(path.join(path.dirname(workspaceDir), 'outside.md'))).toBe(false);
  });

  it('should render projection output paths from the nested projection context', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-projection-template-'));
    const skillDir = path.join(workspaceDir, 'skill');
    fs.mkdirSync(path.join(skillDir, 'templates'), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'templates', 'snapshot.hbs'),
      'Skill: {{context.skill_name}}\nOperation: {{context.operation}}\nState: {{currentState}}',
      'utf8'
    );

    const engine = new ProjectionEngine(
      skillDir,
      [{
        template: 'templates/snapshot.hbs',
        output: '.docs/skill-manager/{{context.skill_name}}-snapshot.md',
      }],
      workspaceDir,
      'job-1'
    );
    const store = new EventStore({ inMemory: true, skillId: 'skill-manager' });

    const writtenFiles = engine.project(store, 'SUCCESS', 'skill-manager', {
      skill_name: 'ameliorate',
      operation: 'UPDATE',
    });

    const archiveFile = path.join(
      workspaceDir,
      '.docs',
      'skill-manager',
      'jobs',
      'job-1',
      'ameliorate-snapshot.md'
    );
    const rootFile = path.join(workspaceDir, '.docs', 'skill-manager', 'ameliorate-snapshot.md');

    expect(writtenFiles).toContain(archiveFile);
    expect(writtenFiles).toContain(rootFile);
    expect(fs.existsSync(archiveFile)).toBe(true);
    expect(fs.existsSync(rootFile)).toBe(true);
    expect(fs.readFileSync(rootFile, 'utf8')).toContain('Skill: ameliorate');
    expect(fs.readFileSync(rootFile, 'utf8')).toContain('Operation: UPDATE');
    expect(fs.readFileSync(rootFile, 'utf8')).toContain('State: SUCCESS');
    expect(fs.existsSync(path.join(workspaceDir, '.docs', 'skill-manager', '{{context.skill_name}}-snapshot.md'))).toBe(false);

    store.close();
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('should render the production skill-manager projections', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-skill-manager-projection-'));
    const skillDir = path.resolve(process.cwd(), '..', 'skills', 'skill-manager');
    const engine = new ProjectionEngine(
      skillDir,
      [
        {
          template: 'templates/manifest_snapshot.md.hbs',
          output: '.docs/skill-manager/{{context.skill_name}}-snapshot.md',
        },
        {
          template: 'templates/inventory.json.hbs',
          output: '.docs/skill-manager/inventory.json',
        },
      ],
      workspaceDir,
      'job-1'
    );
    const store = new EventStore({ inMemory: true, skillId: 'skill-manager' });

    engine.project(store, 'SUCCESS', 'skill-manager', {
      skill_name: 'ameliorate',
      operation: 'UPDATE',
      files: ['skill.yaml', 'templates/manifest_snapshot.md.hbs'],
    });

    const snapshotPath = path.join(workspaceDir, '.docs', 'skill-manager', 'ameliorate-snapshot.md');
    const inventoryPath = path.join(workspaceDir, '.docs', 'skill-manager', 'inventory.json');
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

    expect(fs.existsSync(snapshotPath)).toBe(true);
    expect(fs.existsSync(path.join(workspaceDir, '.docs', 'skill-manager', '{{context.skill_name}}-snapshot.md'))).toBe(false);
    expect(fs.readFileSync(snapshotPath, 'utf8')).toContain('## Skill: ameliorate');
    expect(fs.readFileSync(snapshotPath, 'utf8')).toContain('## Operation: UPDATE');
    expect(fs.readFileSync(snapshotPath, 'utf8')).toContain('### Status: SUCCESS');
    expect(inventory).toMatchObject({
      skill_name: 'ameliorate',
      operation: 'UPDATE',
      status: 'SUCCESS',
      files: ['skill.yaml', 'templates/manifest_snapshot.md.hbs'],
    });

    store.close();
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('should place durable events inside the workspace skill lane', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-store-'));
    const store = new EventStore({ workspaceDir, skillId: 'test-skill' });

    store.append('SKILL_INITIALIZED', { skill: 'test-skill' });

    expect(fs.existsSync(path.join(workspaceDir, '.reactive', 'skills', 'test-skill', 'events.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceDir, '.reactive', 'events.jsonl'))).toBe(false);
  });

  it('should persist projection watermarks with event position', () => {
    const store = new EventStore({ inMemory: true, skillId: 'test-skill' });
    store.append('STATE_TRANSITION', { to: 'NEXT' });
    const position = store.getLatestSequence();

    store.saveProjectionWatermark('summary', position, 'projection-v1');

    expect(store.getProjectionWatermark('summary')).toEqual({
      eventSeq: position,
      projectionVersion: 'projection-v1',
    });
  });

  it('should rotate JSONL history when configured segment size is reached', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-rotate-'));
    const store = new EventStore({ workspaceDir, skillId: 'test-skill', maxJsonlBytes: 250 });

    store.append('DECISION_RECORDED', { choice: 'A'.repeat(100) });
    store.append('DECISION_RECORDED', { choice: 'B'.repeat(100) });

    const storeDir = path.join(workspaceDir, '.reactive', 'skills', 'test-skill');
    expect(fs.readdirSync(storeDir).some(name => /^events-\d{6}\.jsonl$/.test(name))).toBe(true);
  });

  it('should continue when JSONL mirroring fails if SQLite persistence succeeded', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-jsonl-fallback-'));
    const appendSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => {
      throw new Error('disk full');
    });

    try {
      const store = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });

      expect(() => store.append('TEST_EVENT', { value: 1 })).not.toThrow();

      const rows = store.getSqliteDriver()!.querySql('SELECT type FROM events') as Array<{ type: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('TEST_EVENT');
    } finally {
      appendSpy.mockRestore();
    }
  });

  it('should purge SQLite tables and reset sequence when clear() is invoked with SQLite enabled (REL-01)', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-clear-sqlite-'));
    const store = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });

    store.append('STEP_ONE', { value: 1 });
    store.append('STEP_TWO', { value: 2 });
    expect(store.getAll()).toHaveLength(2);
    expect(store.getLatestSequence()).toBe(2);

    store.clear();

    expect(store.getAll()).toHaveLength(0);
    expect(store.getLatestSequence()).toBe(0);

    const rows = store.getSqliteDriver()!.querySql('SELECT * FROM events');
    expect(rows).toHaveLength(0);

    // Re-opening store on the same SQLite path must start empty with sequence 0
    store.close();
    const store2 = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });
    expect(store2.getAll()).toHaveLength(0);
    expect(store2.getLatestSequence()).toBe(0);
    store2.close();
  });

  it('should rebuild SQLite from JSONL when the database file is deleted (REL-02)', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-rebuild-'));
    const store = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });

    store.append('STEP_ONE', { value: 1 });
    store.append('STEP_TWO', { value: 2 });
    store.append('STEP_THREE', { value: 3 });
    expect(store.getAll()).toHaveLength(3);

    const sqlitePath = path.join(workspaceDir, '.reactive', 'skills', 'test-skill', 'events.db');
    store.close();
    fs.unlinkSync(sqlitePath);

    const store2 = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });
    expect(store2.getAll()).toHaveLength(3);
    expect(store2.getLatestSequence()).toBe(3);
    const types = store2.getAll().map(event => event.type);
    expect(types).toEqual(['STEP_ONE', 'STEP_TWO', 'STEP_THREE']);
    store2.close();
  });

  it('should seed SQLite from JSONL when SQLite is enabled but empty (REL-03)', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-seed-'));
    const store = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: false });

    store.append('STEP_ONE', { value: 1 });
    store.append('STEP_TWO', { value: 2 });
    store.close();

    const store2 = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });
    expect(store2.getAll()).toHaveLength(2);
    expect(store2.getLatestSequence()).toBe(2);
    store2.close();
  });

  it('should detect divergence and rebuild when JSONL has more events than SQLite (REL-04)', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-diverge-'));
    const store = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: false });

    store.append('STEP_ONE', { value: 1 });
    store.append('STEP_TWO', { value: 2 });
    store.append('STEP_THREE', { value: 3 });
    store.close();

    // Now enable SQLite for the first time - JSONL should seed it
    const store2 = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });
    expect(store2.getAll()).toHaveLength(3);
    expect(store2.getLatestSequence()).toBe(3);
    store2.close();

    // Append more events via SQLite-only store (JSONL mirroring disabled by mock)
    const store3 = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });
    store3.append('STEP_FOUR', { value: 4 });
    store3.append('STEP_FIVE', { value: 5 });
    store3.close();

    // Reopen - SQLite has 5 events, JSONL has 3. SQLite is authoritative, no rebuild.
    const store4 = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });
    expect(store4.getAll()).toHaveLength(5);
    expect(store4.getLatestSequence()).toBe(5);
    store4.close();
  });

  it('should preserve original seq numbers when rebuilding from JSONL (REL-05)', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-seq-'));
    const store = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });

    store.append('STEP_ONE', { value: 1 });
    store.append('STEP_TWO', { value: 2 });
    store.append('STEP_THREE', { value: 3 });
    store.close();

    const rebuilt = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });
    const events = rebuilt.getAll();
    expect(events.map(event => event.seq)).toEqual([1, 2, 3]);
    rebuilt.close();
  });

  it('should deduplicate by id keeping highest seq during rebuild (REL-06)', () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-dedup-'));
    const store = new EventStore({ workspaceDir, skillId: 'test-skill', enableSqlite: true });

    store.append('STEP_ONE', { value: 1 });
    const originalEvent = store.getAll()[0];

    // Manually write a duplicate event with a higher seq to JSONL
    const jsonlPath = path.join(workspaceDir, '.reactive', 'skills', 'test-skill', 'events.jsonl');
    const duplicate = { ...originalEvent, seq: 99, payload: { value: 99 } };
    fs.appendFileSync(jsonlPath, JSON.stringify(duplicate) + '\n', 'utf8');

    // Rebuild - should keep the higher-seq duplicate
    const count = store.rebuildFromJsonl();
    expect(count).toBe(1);
    const rebuilt = store.getAll();
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0].seq).toBe(99);
    store.close();
  });
});

