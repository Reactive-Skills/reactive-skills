import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FSMEngine } from '../src/core/fsm-engine.js';

describe('Accepted context updates across runtime recovery', () => {
  let workspaceDir: string;
  let skillDir: string;
  let engines: FSMEngine[];

  beforeEach(() => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-accepted-replay-'));
    skillDir = path.join(workspaceDir, 'skill');
    engines = [];
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), `
schema_version: "2.1.0"
name: "accepted-replay"
description: "Synthetic recovery regression fixture"
initial_state: ACTIVE
context_keys: []
default_context:
  contract: approved-original
states:
  ACTIVE:
    initial_substate: RUN
    transitions:
      CANCEL:
        target: COMPLETE
        guard: "payload.approved === true"
    substates:
      RUN:
        transitions:
          UPDATE:
            target: ACTIVE.RUN
            guard: "payload.approved === true"
  COMPLETE: {}
`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const engine of engines) engine.getEventStore().close();
    const target = fs.realpathSync(workspaceDir);
    expect(path.dirname(target)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(target)).toMatch(/^reactive-accepted-replay-/);
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  });

  function open() {
    const engine = new FSMEngine({ skillDir, workspaceDir, jobId: 'synthetic-regression' });
    engines.push(engine);
    return engine;
  }

  for (const useSnapshot of [true, false]) {
    for (const signal of ['UPDATE', 'UNKNOWN']) {
      it(`ignores ${signal} rejected nested updates on ${useSnapshot ? 'snapshot' : 'full history'} recovery`, async () => {
        const engine = open();
        await engine.handleSignal('UPDATE', { approved: true, contextUpdates: { contract: 'accepted-revision' } });
        const result = await engine.handleSignal(signal, { approved: false, contextUpdates: { contract: 'rejected-replacement', injected: true } });
        expect(result.transitioned).toBe(false);
        expect(engine.getContext().contract).toBe('accepted-revision');
        expect(engine.getContext().injected).toBeUndefined();
        if (!useSnapshot) vi.spyOn(engine.getEventStore(), 'getLatestSnapshot').mockReturnValue(null);
        engine.rehydrate(engine.getEventStore().getAll(), useSnapshot ? undefined : null);
        expect(engine.getContext().contract).toBe('accepted-revision');
        expect(engine.getContext().injected).toBeUndefined();
        const restored = open();
        expect(restored.getContext().contract).toBe('accepted-revision');
        expect(restored.getContext().injected).toBeUndefined();
        expect(restored.getJobId()).toBe(engine.getJobId());
      });
    }
  }

  it('applies accepted updates in transition order and preserves explicit context patches without a snapshot', async () => {
    const engine = open();
    await engine.handleSignal('UPDATE', { approved: true, contextUpdates: { contract: 'first', valid: 1 } });
    await engine.handleSignal('UPDATE', { approved: false, contextUpdates: { contract: 'rejected', valid: 99 } });
    await engine.handleSignal('UPDATE', { approved: true, contextUpdates: { contract: 'second', valid: 2 } });
    engine.getEventStore().append('CONTEXT_PATCH', { contextUpdates: { note: 'explicit-patch' } });
    engine.rehydrate(engine.getEventStore().getAll(), null);
    expect(engine.getContext()).toMatchObject({ contract: 'second', valid: 2, note: 'explicit-patch' });
  });

  it('does not apply a signal whose transition never committed', () => {
    const engine = open();
    engine.getEventStore().append('SIGNAL_EMITTED', { signal: 'UPDATE', approved: true, contextUpdates: { contract: 'uncommitted' } });
    expect(open().getContext().contract).toBe('approved-original');
  });

  it('recovers accepted updates after transition commit but before snapshot persistence', () => {
    const engine = open();
    const signal = engine.getEventStore().append('SIGNAL_EMITTED', { signal: 'UPDATE', contextUpdates: { contract: 'committed' } });
    engine.getEventStore().append('STATE_TRANSITION', { from: 'ACTIVE.RUN', to: 'ACTIVE.RUN' }, { causationId: signal.id });
    expect(open().getContext().contract).toBe('committed');
  });

  it('dispatches an ancestor handler without mistaking its own bubble event for a concurrent writer', async () => {
    const engine = open();
    expect((await engine.handleSignal('CANCEL', { approved: false })).transitioned).toBe(false);
    const result = await engine.handleSignal('CANCEL', { approved: true, contextUpdates: { disposition: 'cancelled' } });
    expect(result.transitioned).toBe(true);
    expect(result.handledAtDepth).toBe(1);
    expect(engine.getCurrentState()).toBe('COMPLETE');
    expect(engine.getEventStore().query({ type: 'EVENT_BUBBLED' })).toHaveLength(2);
    expect(open().getContext().disposition).toBe('cancelled');
  });
});
