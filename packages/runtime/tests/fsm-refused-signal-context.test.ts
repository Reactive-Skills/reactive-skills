import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

const roots: string[] = [];
const engines: FSMEngine[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const engine of engines.splice(0)) engine.getEventStore().close();
  for (const root of roots.splice(0)) {
    const target = fs.realpathSync(root);
    expect(path.dirname(target)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(target)).toMatch(/^refused-signal-context-/);
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  }
});

function workspace(): { open: () => FSMEngine } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'refused-signal-context-'));
  roots.push(root);
  const skillDir = path.join(root, 'skill');
  fs.mkdirSync(skillDir);
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), `schema_version: "2.1.0"
name: refused-signal-context
description: Refused signal context regression fixture
initial_state: AUDIT
context_keys: [note]
states:
  AUDIT:
    transitions:
      PASSED:
        target: DONE
        guard: "context.ready === true"
      NOTED:
        target: DONE
        guard: "context.note === 'ok'"
      SUBMITTED:
        target: AUDIT
        judgment:
          type: predicate
          criterion: "payload.score >= 1"
          adapter_hint: script
          fallback_target: REPAIR
  REPAIR:
    transitions:
      RETRY:
        target: AUDIT
  DONE: {}
`);
  // Each open() mirrors one CLI invocation: a fresh engine rehydrating the same run.
  return {
    open: () => {
      const engine = new FSMEngine({ skillDir, workspaceDir: root, jobId: 'refused-signal-context' });
      engines.push(engine);
      return engine;
    },
  };
}

describe('refused signal context', () => {
  it('does not let a refused signal persist contextUpdates that satisfy a later retry', async () => {
    const { open } = workspace();
    const first = await open().handleSignal('PASSED', { contextUpdates: { ready: true } });
    expect(first.transitioned).toBe(false);

    const restored = open();
    expect(restored.getContext().ready).toBeUndefined();
    const retry = await restored.handleSignal('PASSED', {});
    expect(retry.transitioned).toBe(false);
    expect(restored.getCurrentState()).toBe('AUDIT');
  });

  it('does not persist contextUpdates from a signal no state handles', async () => {
    const { open } = workspace();
    const engine = open();
    const result = await engine.handleSignal('UNKNOWN', { contextUpdates: { injected: true } });
    expect(result.transitioned).toBe(false);
    expect(engine.getContext().injected).toBeUndefined();
    expect(open().getContext().injected).toBeUndefined();
  });

  it('shows context_keys to guards but drops them when the signal is refused', async () => {
    const { open } = workspace();
    const engine = open();
    expect((await engine.handleSignal('NOTED', { note: 'draft' })).transitioned).toBe(false);
    expect(engine.getContext().note).toBeUndefined();
    expect(open().getContext().note).toBeUndefined();

    expect((await engine.handleSignal('NOTED', { note: 'ok' })).transitioned).toBe(true);
    expect(engine.getContext().note).toBe('ok');
    expect(open().getContext().note).toBe('ok');
  });

  it('replays accepted and fallback transition updates with and without snapshots', async () => {
    const { open } = workspace();
    const engine = open();
    const fallback = await engine.handleSignal('SUBMITTED', { score: 0, contextUpdates: { attempt: 1 } });
    expect(fallback.transitioned).toBe(true);
    expect(engine.getCurrentState()).toBe('REPAIR');
    expect(engine.getContext().attempt).toBe(1);

    await engine.handleSignal('RETRY', { contextUpdates: { attempt: 2 } });
    await engine.handleSignal('SUBMITTED', { score: 0, contextUpdates: { attempt: 3, rejected: true } });
    await engine.handleSignal('RETRY', { contextUpdates: { attempt: 4, rejected: false } });
    await engine.handleSignal('PASSED', { contextUpdates: { attempt: 99 } });
    expect(engine.getContext()).toMatchObject({ attempt: 4, rejected: false });

    expect(open().getContext()).toMatchObject({ attempt: 4, rejected: false });
    vi.spyOn(EventStore.prototype, 'getLatestSnapshot').mockReturnValue(null);
    const fromHistory = open();
    expect(fromHistory.getCurrentState()).toBe('AUDIT');
    expect(fromHistory.getContext()).toMatchObject({ attempt: 4, rejected: false });
  });
});
