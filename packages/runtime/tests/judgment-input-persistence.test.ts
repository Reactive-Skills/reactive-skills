import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { JudgmentEngine } from '../src/core/judgment-engine.js';

describe('Judgment input durability and approval identity', () => {
  let directory: string;
  const stores: ReturnType<FSMEngine['getEventStore']>[] = [];
  const evaluate = vi.fn();
  const definition = () => ({
    schema_version: '2.0.0', name: 'input-recovery', description: 'Judgment input fixture', initial_state: 'REVIEW',
    runtime_requirements: { required_capabilities: ['judgment.payload_selection'] },
    default_context: { rubric: 'original' },
    states: { REVIEW: { transitions: { CHECK: { target: 'DONE', judgment: {
      type: 'predicate', criterion: 'Does the selected evidence satisfy the rubric?', adapter_hint: 'fixture',
      context_paths: ['rubric'], payload_paths: ['check'], required_context_paths: ['rubric'],
      precondition: { payload_schema: { exit_code: { type: 'number', const: 0 } } },
    } } } }, DONE: { description: 'Complete' } },
  });
  const open = () => {
    const engine = new FSMEngine({ skillDir: directory, workspaceDir: directory });
    stores.push(engine.getEventStore());
    return engine;
  };
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'judgment-input-'));
    vi.stubEnv('HOME', directory);
    vi.stubEnv('USERPROFILE', directory);
    vi.stubEnv('TYPESAFE_API_KEY', '');
    JudgmentEngine.reset();
    evaluate.mockReset().mockResolvedValue({ verdict: true, passed: true, confidence: 1, adapterName: 'fixture', latencyMs: 0 });
    JudgmentEngine.registerAdapter({ id: 'fixture', supports: () => true, isAvailable: async () => true, isConfigured: () => true, evaluate });
    fs.writeFileSync(path.join(directory, 'skill.yaml'), yaml.dump(definition()));
  });
  afterEach(() => {
    for (const store of stores.splice(0)) store.close();
    JudgmentEngine.reset(); vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each(['replay', 'snapshot_before', 'snapshot_after'].flatMap(recovery =>
    ['accept', 'precondition', 'outage'].map(outcome => ({ recovery, outcome }))
  ))('restores $recovery/$outcome without reevaluation or extra audit copies', async ({ recovery, outcome }) => {
    if (outcome === 'outage') evaluate.mockRejectedValue(new Error('offline'));
    const engine = open();
    const store = engine.getEventStore();
    const snapshot = () => store.saveSnapshot(store.getAll().at(-1)!.seq, engine.getCurrentState(), engine.getContext());
    if (recovery === 'snapshot_before') snapshot();
    const payload = { check: { text: 'current evidence', revision: 'v1' }, unrelated: 'excluded', exit_code: outcome === 'precondition' ? 1 : 0 };
    const first = await engine.handleSignal('CHECK', payload, { idempotencyKey: 'once' });
    expect(first.transitioned).toBe(outcome === 'accept');
    const recorded = store.query({ type: 'GUARD_EVALUATED' })[0].payload.judgment;
    expect(recorded.inputInspection).toMatchObject({ fullEvent: false, payloadPaths: ['check'], missingRequired: [] });
    expect(recorded.judgmentSkipped === true).toBe(outcome === 'precondition');
    expect(JSON.stringify(recorded.inputInspection)).not.toMatch(/current evidence|excluded/);
    if (recovery === 'snapshot_after') snapshot();
    store.close();
    const restored = open();
    const duplicate = await restored.handleSignal('CHECK', payload, { idempotencyKey: 'once' });
    expect(duplicate.transitioned).toBe(false);
    expect(duplicate.refusalReason).toBe(first.refusalReason);
    expect(evaluate).toHaveBeenCalledTimes(outcome === 'precondition' ? 0 : 1);
    expect(restored.getEventStore().query({ type: 'GUARD_EVALUATED' })[0].payload.judgment).toEqual(recorded);
    if (outcome === 'precondition') expect(restored.getPendingApprovals()).toHaveLength(0);
  });

  it.each(['unchanged', 'evidence', 'criterion', 'options', 'threshold', 'adapter', 'model', 'base_url', 'revision',
    'key_missing', 'key_rotated', 'log_level'])
  ('binds human approval to the current input/configuration: %s', async change => {
    evaluate.mockRejectedValue(new Error('offline'));
    vi.stubEnv('TYPESAFE_API_KEY', 'agent-key');
    vi.stubEnv('TYPESAFE_LOG_LEVEL', 'info');
    if (change === 'revision') {
      const manifest = definition();
      manifest.states.REVIEW.transitions.CHECK.target = 'REVIEW';
      fs.writeFileSync(path.join(directory, 'skill.yaml'), yaml.dump(manifest));
    }
    let engine = open();
    await engine.handleSignal('CHECK', { check: { text: 'evidence', revision: 'v1' }, exit_code: 0 });
    const [request] = engine.getPendingApprovals();
    expect(request.judgmentIdentity).toMatch(/^[a-f0-9]{64}$/);
    if (change === 'evidence') engine.updateContext({ rubric: 'revised' });
    if (change === 'model') vi.stubEnv('TYPESAFE_DEFAULT_MODEL', 'revised-model');
    if (change === 'base_url') vi.stubEnv('TYPESAFE_BASE_URL', 'https://revised.example');
    vi.stubEnv('TYPESAFE_API_KEY', change === 'key_rotated' ? 'rotated-key' : '');
    if (change === 'log_level') vi.stubEnv('TYPESAFE_LOG_LEVEL', 'debug');
    if (['criterion', 'options', 'threshold', 'adapter'].includes(change)) {
      const manifest = definition();
      Object.assign(manifest.states.REVIEW.transitions.CHECK.judgment, {
        criterion: { criterion: 'Is the revised criterion satisfied?' },
        options: { options: ['yes', 'no'] }, threshold: { min_probability: 0.95 }, adapter: { adapter_hint: 'unknown-adapter' },
      }[change]);
      fs.writeFileSync(path.join(directory, 'skill.yaml'), yaml.dump(manifest));
      engine.getEventStore().close(); engine = open();
    }
    const result = await engine.decideApproval(request.id, 'approve', 'test');
    expect(result.transitioned).toBe(['unchanged', 'revision', 'key_missing', 'key_rotated', 'log_level'].includes(change));
    if (change === 'revision') {
      // A fresh submission after explicit approval never inherits that decision.
      const revision = await engine.handleSignal('CHECK', { check: { text: 'revised evidence', revision: 'v2' }, exit_code: 0 });
      expect(revision.transitioned).toBe(false);
      expect(revision.judgmentBasis).toBeUndefined();
    }
  });

  it.each([undefined, ['signal']])('uses the same complete signal shape for approval identity: %j', async paths => {
    evaluate.mockRejectedValue(new Error('offline'));
    const manifest = definition();
    Object.assign(manifest.states.REVIEW.transitions.CHECK.judgment, { payload_paths: paths });
    fs.writeFileSync(path.join(directory, 'skill.yaml'), yaml.dump(manifest));
    const engine = open();
    await engine.handleSignal('CHECK', { check: 'evidence', exit_code: 0 });
    const [request] = engine.getPendingApprovals();
    expect((await engine.decideApproval(request.id, 'approve', 'test')).transitioned).toBe(true);
  });
});
