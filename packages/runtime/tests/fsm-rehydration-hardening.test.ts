import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';
import { GuardEvaluator } from '../src/core/guard-evaluator.js';

describe('Principal Engineer Hardening & Rehydration Suites', () => {
  let tempDir: string;
  let skillDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-hardening-test-'));
    skillDir = path.join(tempDir, 'skill');
    fs.mkdirSync(skillDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore Windows file lock during test cleanup
    }
  });

  it('should rehydrate active state and context from EventStore history on boot (Fixing P0 #1)', async () => {
    // 1. Setup Skill with 3 states
    const skillYaml = `
schema_version: "reactive/v1"
name: "rehydration-skill"
description: "Test state rehydration"
initial_state: "STAGE_ONE"
states:
  STAGE_ONE:
    transitions:
      ADVANCE: "STAGE_TWO"
  STAGE_TWO:
    transitions:
      FINISH: "STAGE_THREE"
  STAGE_THREE:
    description: "Done"
`;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), skillYaml, 'utf8');

    const eventDbPath = path.join(tempDir, 'events.db');
    const eventJsonlPath = path.join(tempDir, 'events.jsonl');
    const store = new EventStore({
      sqlitePath: eventDbPath,
      storagePath: eventJsonlPath,
      enableSqlite: true,
    });

    // 2. Boot first engine and advance to STAGE_TWO
    const engine1 = new FSMEngine({ skillDir, eventStore: store });
    expect(engine1.getCurrentState()).toBe('STAGE_ONE');

    const res = await engine1.handleSignal('ADVANCE', { contextUpdates: { counter: 42 } });
    expect(res.transitioned).toBe(true);
    expect(engine1.getCurrentState()).toBe('STAGE_TWO');
    expect(engine1.getContext().counter).toBe(42);

    // 3. Boot second engine pointing to same persistent EventStore (simulating process restart)
    const store2 = new EventStore({
      sqlitePath: eventDbPath,
      storagePath: eventJsonlPath,
      enableSqlite: true,
    });
    const engine2 = new FSMEngine({ skillDir, eventStore: store2 });

    // 4. Verify engine2 booted directly into STAGE_TWO with restored context
    expect(engine2.getCurrentState()).toBe('STAGE_TWO');
    expect(engine2.getContext().counter).toBe(42);

    // 5. Can step from STAGE_TWO to STAGE_THREE seamlessly
    const res2 = await engine2.handleSignal('FINISH');
    expect(res2.transitioned).toBe(true);
    expect(engine2.getCurrentState()).toBe('STAGE_THREE');

    store.close();
    store2.close();
  });

  it('should queue and drain lifecycle hook signal emissions (Fixing P0 #2)', async () => {
    const skillYaml = `
schema_version: "reactive/v1"
name: "lifecycle-queue-skill"
description: "Test auto-stepping via on_enter emit_signal"
initial_state: "INITIAL"
states:
  INITIAL:
    transitions:
      START: "VALIDATING"
  VALIDATING:
    on_enter:
      - emit_signal: "VALIDATED"
    transitions:
      VALIDATED: "SUCCESS"
  SUCCESS:
    description: "Auto reached"
`;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), skillYaml, 'utf8');

    const engine = new FSMEngine({ skillDir, eventStore: new EventStore({ inMemory: true }) });
    expect(engine.getCurrentState()).toBe('INITIAL');

    // Emitting START enters VALIDATING, which emits VALIDATED in on_enter, auto-stepping to SUCCESS
    const result = await engine.handleSignal('START');
    expect(result.transitioned).toBe(true);
    expect(engine.getCurrentState()).toBe('SUCCESS');
  });

  it('should sandbox guard evaluations with node:vm and block malicious code injection (Fixing P1 #4)', async () => {
    // Malicious attempts to escape sandbox
    const maliciousExpr = `process.exit(1)`;
    const result = await GuardEvaluator.evaluate(maliciousExpr, undefined, {
      event: { id: '1', seq: 1, timestamp: '', type: 'TEST', payload: {} },
      context: {},
      currentState: 'TEST_STATE',
    });

    expect(result.passed).toBe(false);
    expect(result.error).toBeDefined();

    // Valid evaluation passes
    const validExpr = `event.payload.value > 10`;
    const validResult = await GuardEvaluator.evaluate(validExpr, undefined, {
      event: { id: '1', seq: 1, timestamp: '', type: 'TEST', payload: { value: 15 } },
      context: {},
      currentState: 'TEST_STATE',
    });
    expect(validResult.passed).toBe(true);
  });

  it('should reject guard function paths that escape the skill directory', async () => {
    const guardsDir = path.join(skillDir, 'guards');
    fs.mkdirSync(guardsDir, { recursive: true });
    fs.writeFileSync(path.join(guardsDir, 'ok.js'), 'export default () => true;\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'outside.js'), 'export default () => true;\n', 'utf8');

    const blocked = await GuardEvaluator.evaluate(undefined, '../outside.js', {
      event: { id: '1', seq: 1, timestamp: '', type: 'TEST', payload: {} },
      context: {},
      currentState: 'TEST_STATE',
      skillDir,
    });

    expect(blocked.passed).toBe(false);
    expect(blocked.error).toContain('escapes skill directory');

    const allowed = await GuardEvaluator.evaluate(undefined, 'guards/ok.js', {
      event: { id: '2', seq: 2, timestamp: '', type: 'TEST', payload: {} },
      context: {},
      currentState: 'TEST_STATE',
      skillDir,
    });

    expect(allowed.passed).toBe(true);
  });

  it('should reject guard function paths with unpermitted file extensions or symlink escapes (SEC-01)', async () => {
    const guardsDir = path.join(skillDir, 'guards');
    fs.mkdirSync(guardsDir, { recursive: true });
    fs.writeFileSync(path.join(guardsDir, 'invalid.json'), '{"guard": true}\n', 'utf8');

    // 1. Non-JS extension must be rejected
    const invalidExt = await GuardEvaluator.evaluate(undefined, 'guards/invalid.json', {
      event: { id: '3', seq: 3, timestamp: '', type: 'TEST', payload: {} },
      context: {},
      currentState: 'TEST_STATE',
      skillDir,
    });

    expect(invalidExt.passed).toBe(false);
    expect(invalidExt.error).toContain('JavaScript file (.js, .mjs, .cjs)');

    // 2. Symlink escaping skill directory must be rejected
    const outsideJs = path.join(tempDir, 'outside-symlink.js');
    fs.writeFileSync(outsideJs, 'export default () => true;\n', 'utf8');
    const symlinkPath = path.join(guardsDir, 'escaped-link.js');
    try {
      fs.symlinkSync(outsideJs, symlinkPath, 'file');
      const symlinkBlocked = await GuardEvaluator.evaluate(undefined, 'guards/escaped-link.js', {
        event: { id: '4', seq: 4, timestamp: '', type: 'TEST', payload: {} },
        context: {},
        currentState: 'TEST_STATE',
        skillDir,
      });

      expect(symlinkBlocked.passed).toBe(false);
      expect(symlinkBlocked.error).toContain('escapes skill directory');
    } catch (e: any) {
      // If Windows user privileges restrict symlink creation, skip symlink assertion
      if (e.code !== 'EPERM') throw e;
    }
  });

  it('should enforce bounded in-memory sliding buffer while preserving all events in SQLite (Fixing P2 #6)', () => {
    const store = new EventStore({
      inMemory: true,
      enableSqlite: true,
      maxInMemoryEvents: 5, // Ring buffer of 5
    });

    // Append 15 events
    for (let i = 1; i <= 15; i++) {
      store.append('STEP', { step: i });
    }

    // SQLite driver holds all 15 events
    const allEvents = store.getAll();
    expect(allEvents.length).toBe(15);
    expect(allEvents[0].payload.step).toBe(1);
    expect(allEvents[14].payload.step).toBe(15);

    // In-memory events array only holds the 5 most recent events
    const memoryEvents = (store as any).events;
    expect(memoryEvents.length).toBe(5);
    expect(memoryEvents[0].payload.step).toBe(11);
    expect(memoryEvents[4].payload.step).toBe(15);
  });

  it('should restore state from latest snapshot and only replay subsequent events on cold boot (PERF-02 / INV-08)', async () => {
    const skillYaml = `
schema_version: "reactive/v1"
name: "snapshot-rehydration-skill"
description: "Test snapshot-aware rehydration"
initial_state: "S1"
states:
  S1:
    transitions:
      GO_TO_S2: "S2"
  S2:
    transitions:
      GO_TO_S3: "S3"
  S3:
    transitions:
      GO_TO_S4: "S4"
  S4:
    description: "Final state"
`;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), skillYaml, 'utf8');

    const eventDbPath = path.join(tempDir, 'snapshot-events.db');
    const store1 = new EventStore({
      sqlitePath: eventDbPath,
      enableSqlite: true,
    });

    // 1. Boot engine1 and transition across multiple states
    const engine1 = new FSMEngine({ skillDir, eventStore: store1 });
    expect(engine1.getCurrentState()).toBe('S1');

    await engine1.handleSignal('GO_TO_S2', { contextUpdates: { step: 2 } });
    expect(engine1.getCurrentState()).toBe('S2');

    await engine1.handleSignal('GO_TO_S3', { contextUpdates: { step: 3, flag: true } });
    expect(engine1.getCurrentState()).toBe('S3');

    // 2. Verify snapshot was recorded in store
    const snapshot = store1.getLatestSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.state).toBe('S3');
    expect(snapshot?.context.step).toBe(3);
    expect(snapshot?.context.flag).toBe(true);

    // 3. Perform another step to S4
    await engine1.handleSignal('GO_TO_S4', { contextUpdates: { step: 4 } });
    expect(engine1.getCurrentState()).toBe('S4');

    const latestSnapshot = store1.getLatestSnapshot();
    expect(latestSnapshot?.state).toBe('S4');
    expect(latestSnapshot?.context.step).toBe(4);

    // Also append an event after the transition that updates context
    store1.append('CONTEXT_PATCH', { contextUpdates: { note: 'post-snapshot-data' } });

    store1.close();

    // 4. Cold boot engine2 pointing to the same SQLite database
    const store2 = new EventStore({
      sqlitePath: eventDbPath,
      enableSqlite: true,
    });

    // Spy on store2.getAll() vs getSince()
    const getAllSpy = vi.spyOn(store2, 'getAll');
    const getSinceSpy = vi.spyOn(store2, 'getSince');

    const engine2 = new FSMEngine({ skillDir, eventStore: store2 });

    // 5. Verify engine2 restored into S4 with full context (including the post-snapshot event)
    expect(engine2.getCurrentState()).toBe('S4');
    expect(engine2.getContext().step).toBe(4);
    expect(engine2.getContext().flag).toBe(true);
    expect(engine2.getContext().note).toBe('post-snapshot-data');

    // Verify snapshot-aware retrieval was used instead of full log scan
    expect(getSinceSpy).toHaveBeenCalledWith(latestSnapshot!.seq);
    expect(getAllSpy).not.toHaveBeenCalled();

    store2.close();
  });
});
