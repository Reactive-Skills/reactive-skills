import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { GuardEvaluator } from '../src/core/guard-evaluator.js';

const fixtures: { root: string; engine: FSMEngine }[] = [];

afterEach(() => {
  for (const { root, engine } of fixtures.splice(0)) {
    engine.getEventStore().close();
    const target = fs.realpathSync(root);
    expect(path.dirname(target)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(target)).toMatch(/^hsm-sqlite-bubbling-/);
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  }
});

function fixture(leafOverride = false): FSMEngine {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hsm-sqlite-bubbling-'));
  const skillDir = path.join(root, 'skill');
  fs.mkdirSync(skillDir);
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), `schema_version: "2.1.0"
name: hsm-sqlite-bubbling
version: "1.0.0"
type: reactive
description: SQLite ancestor dispatch regression fixture
initial_state: ACTIVE
states:
  ACTIVE:
    initial_substate: ROUTE
    transitions:
      CANCEL:
        target: CANCELLED
        guard: 'typeof payload.reason === "string" && payload.reason.trim().length > 0'
    substates:
      ROUTE:
        initial_substate: LEAF
        substates:
          LEAF:
            transitions: ${leafOverride ? '\n              CANCEL:\n                target: CANCELLED\n                guard: "false"' : '{}'}
  CANCELLED:
    transitions: {}
`);
  const engine = new FSMEngine({ skillDir, workspaceDir: root, jobId: 'sqlite-bubbling' });
  fixtures.push({ root, engine });
  return engine;
}

describe('SQLite ancestor event dispatch', () => {
  it('handles cancellation at the ancestor and records bubbling', async () => {
    const engine = fixture();
    const result = await engine.handleSignal('CANCEL', { reason: 'Explicit user request' });
    expect(result.transitioned).toBe(true);
    expect(engine.getCurrentState()).toBe('CANCELLED');
    const events = engine.getEventStore().query({ type: 'EVENT_BUBBLED' });
    expect(events).toHaveLength(1);
    expect(events[0].payload.handledAt).toBe('ACTIVE');
  });

  it('rejects an invalid ancestor guard without a version conflict', async () => {
    const engine = fixture();
    const result = await engine.handleSignal('CANCEL', {});
    expect(result.transitioned).toBe(false);
    expect(engine.getCurrentState()).toBe('ACTIVE.ROUTE.LEAF');
  });

  it('tries an ancestor after a leaf guard rejects the same event', async () => {
    const engine = fixture(true);
    const result = await engine.handleSignal('CANCEL', { reason: 'Explicit user request' });
    expect(result.transitioned).toBe(true);
    expect(engine.getCurrentState()).toBe('CANCELLED');
    const events = engine.getEventStore().query({ type: 'GUARD_EVALUATED' });
    expect(events.map(event => event.payload.passed)).toEqual([false, true]);
  });

  it('still detects a write during asynchronous guard evaluation', async () => {
    const engine = fixture();
    const evaluate = GuardEvaluator.evaluate;
    GuardEvaluator.evaluate = async (...args) => {
      const result = await evaluate.apply(GuardEvaluator, args);
      engine.getEventStore().append('CONCURRENT_WRITE', {});
      return result;
    };
    try {
      await expect(engine.handleSignal('CANCEL', { reason: 'Explicit user request' }))
        .rejects.toThrow(/RUN_VERSION_CONFLICT/);
      expect(engine.getCurrentState()).toBe('ACTIVE.ROUTE.LEAF');
    } finally {
      GuardEvaluator.evaluate = evaluate;
    }
  });
});
