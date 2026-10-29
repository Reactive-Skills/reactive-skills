import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { JudgmentEngine } from '../src/core/judgment-engine.js';

describe('Judgment accounting survives durable recovery', () => {
  let directory: string;
  const stores: ReturnType<FSMEngine['getEventStore']>[] = [];
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
    JudgmentEngine.reset();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'judgment-recovery-'));
    vi.stubEnv('HOME', directory);
    vi.stubEnv('USERPROFILE', directory);
    fs.writeFileSync(path.join(directory, 'skill.yaml'), `
schema_version: "2.0.0"
name: judgment-recovery
description: Judgment deadline recovery fixture
initial_state: REVIEW
default_context:
  recorded: original
states:
  REVIEW:
    transitions:
      CHECK:
        target: DONE
        judgment:
          type: predicate
          criterion: Does the evidence support approval?
          adapter_hint: offline-fixture
          total_timeout_ms: 25
          fallback_target: REPAIR
  DONE:
    description: Complete
  REPAIR:
    description: Repair
`);
  });
  afterEach(() => {
    for (const store of stores.splice(0)) store.close();
    JudgmentEngine.reset();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each(['replay', 'snapshot_before', 'snapshot_after'].flatMap(recovery =>
    [false, true].map(accepted => ({ recovery, accepted }))
  ))('restores $recovery with accepted=$accepted without rerunning judgment', async ({ recovery, accepted }) => {
    const evaluate = vi.fn(async () => {
      if (!accepted) return new Promise<never>(() => {});
      await new Promise(resolve => setTimeout(resolve, 10));
      return { verdict: true, passed: true, probability: 0.95, confidence: 0.9, adapterName: 'offline-fixture', latencyMs: 0 };
    });
    JudgmentEngine.registerAdapter({ id: 'offline-fixture', supports: () => true, isAvailable: async () => true, isConfigured: () => true, evaluate });
    const engine = new FSMEngine({ skillDir: directory, workspaceDir: directory });
    const store = engine.getEventStore();
    stores.push(store);
    const snapshot = () => store.saveSnapshot(store.getAll().at(-1)!.seq, engine.getCurrentState(), engine.getContext());
    if (recovery === 'snapshot_before') snapshot();
    const payload = { contextUpdates: { recorded: 'changed' }, success: true };
    const pending = engine.handleSignal('CHECK', payload, { idempotencyKey: 'check-once' });
    await vi.advanceTimersByTimeAsync(25);
    const first = await pending;
    expect(first.transitioned).toBe(accepted);
    if (!accepted) expect(first.refusalReason).toMatch(/waiting for a person/);
    const recorded = store.query({ type: 'GUARD_EVALUATED' })[0].payload.judgment;
    expect(recorded).toMatchObject({ latencyMs: accepted ? 10 : 25, attemptCount: 1, band: accepted ? 'accept' : 'unevaluable' });
    if (recovery === 'snapshot_after') snapshot();
    store.close();

    const restored = new FSMEngine({ skillDir: directory, workspaceDir: directory });
    stores.push(restored.getEventStore());
    expect(restored.getCurrentState()).toBe(accepted ? 'DONE' : 'REVIEW');
    expect(restored.getContext().recorded).toBe(accepted ? 'changed' : 'original');
    const duplicate = await restored.handleSignal('CHECK', payload, { idempotencyKey: 'check-once' });
    expect(duplicate.transitioned).toBe(false);
    expect(duplicate.newState).toBe(accepted ? 'DONE' : 'REVIEW');
    if (accepted) expect(duplicate.refusalReason).toBeUndefined();
    if (!accepted) expect(duplicate.refusalReason).toBe(first.refusalReason);
    expect(evaluate).toHaveBeenCalledOnce();
    expect(restored.getEventStore().query({ type: 'GUARD_EVALUATED' })[0].payload.judgment).toEqual(recorded);
    expect(restored.getEventStore().query({ type: 'GUARD_FALLBACK_TRIGGERED' })).toHaveLength(0);
  });
});
