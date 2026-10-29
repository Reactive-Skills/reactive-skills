import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { JudgmentEngine } from '../src/core/judgment-engine.js';
import { inspectJudgmentInput } from '../src/core/judgment-input.js';
import { JudgmentDefinitionSchema, SkillManifestSchema } from '../src/core/types.js';

const values = [
  { label: 'absent', value: undefined, missing: true },
  { label: 'null', value: null, missing: true },
  { label: 'empty string', value: '', missing: true },
  { label: 'whitespace string', value: ' \t\n\u2003', missing: true },
  { label: 'empty array', value: [], missing: true },
  { label: 'empty object', value: {}, missing: true },
  { label: 'text', value: ' evidence ', missing: false },
  { label: 'array', value: ['evidence'], missing: false },
  { label: 'object', value: { evidence: 'text' }, missing: false },
  { label: 'false', value: false, missing: false },
  { label: 'zero', value: 0, missing: false },
  { label: 'shallow array', value: [null], missing: false },
  { label: 'shallow object', value: { evidence: null }, missing: false },
];
const definition = (source: 'context' | 'payload') => ({
  type: 'predicate' as const, criterion: 'Is the evidence sufficient?',
  adapter_hint: 'fixture', fallback_adapter: 'fallback', fallback_target: 'REPAIR',
  precondition: { payload_schema: {}, non_empty: { [`${source}_paths`]: ['review.evidence'] } },
});
const candidate = (source: 'context' | 'payload', value: unknown) => ({
  event: { id: 'check', seq: 1, type: 'CHECK', timestamp: '2026-01-01',
    payload: source === 'payload' ? { review: { evidence: value } } : {} },
  context: source === 'context' ? { review: { evidence: value } } : {},
  currentState: 'REVIEW',
});

describe('Explicit non-empty judgment preconditions', () => {
  const evaluate = vi.fn();
  const isAvailable = vi.fn();
  beforeEach(() => {
    JudgmentEngine.reset();
    evaluate.mockReset().mockResolvedValue({ verdict: true, passed: true, confidence: 1, adapterName: 'fixture', latencyMs: 0 });
    isAvailable.mockReset().mockResolvedValue(true);
    for (const id of ['fixture', 'fallback']) JudgmentEngine.registerAdapter({
      id, supports: () => true, isAvailable, isConfigured: () => true, evaluate,
    });
  });
  afterEach(() => JudgmentEngine.reset());

  it.each(['context', 'payload'] as const)('checks %s evidence before adapter selection', async source => {
    for (const { label, value, missing } of values) {
      evaluate.mockClear(); isAvailable.mockClear();
      const input = candidate(source, value);
      const judgment = definition(source);
      const inspection = inspectJudgmentInput(judgment, input);
      expect(inspection.missingRequired, label).toEqual(missing ? [`${source}.review.evidence`] : []);
      expect(inspection.preconditionPassed, label).toBe(!missing);
      expect(evaluate, label).not.toHaveBeenCalled();
      expect(isAvailable, label).not.toHaveBeenCalled();
      const result = await JudgmentEngine.evaluate(judgment, input);
      expect(result.inputInspection, label).toEqual(inspection);
      if (missing) {
        expect(result, label).toMatchObject({ passed: false, band: 'reject', judgmentSkipped: true, attemptCount: 0 });
        expect(result.fallbackTarget, label).toBeUndefined();
        expect(inspection.errors, label).toContain(`Missing required judgment input: ${source}.review.evidence`);
        expect(evaluate, label).not.toHaveBeenCalled();
        expect(isAvailable, label).not.toHaveBeenCalled();
      } else {
        expect(result.passed, label).toBe(true);
        expect(evaluate, label).toHaveBeenCalledOnce();
      }
    }
  });

  it('accepts non_empty without payload_schema and validates paths and capability requirements', () => {
    const judgment = { ...definition('context'), precondition: { non_empty: {
      context_paths: ['review.evidence'], payload_paths: ['checks.0.text'],
    } } };
    expect(JudgmentDefinitionSchema.parse(judgment)).toMatchObject(judgment);
    for (const non_empty of [
      { context_paths: ['review..evidence'] }, { payload_paths: ['checks.01'] },
      { context_paths: ['__proto__.evidence'] }, { context_paths: 'review.evidence' },
      { unknown_paths: ['evidence'] },
    ]) expect(JudgmentDefinitionSchema.safeParse({ ...judgment, precondition: { non_empty } }).success).toBe(false);
    expect(JudgmentDefinitionSchema.safeParse({ ...judgment, precondition: {} }).success).toBe(false);
    const manifest = { schema_version: '2', name: 'non-empty', description: 'Non-empty fixture', initial_state: 'REVIEW',
      states: { REVIEW: { transitions: { CHECK: { target: 'REVIEW', judgment } } } } };
    expect(SkillManifestSchema.safeParse(manifest).success).toBe(false);
    expect(SkillManifestSchema.safeParse({ ...manifest,
      runtime_requirements: { required_capabilities: ['judgment.payload_selection'] },
    }).success).toBe(true);
  });

  it('combines non-empty checks with payload type and constant checks', async () => {
    const judgment = { ...definition('context'), precondition: {
      non_empty: { context_paths: ['review.evidence'] },
      payload_schema: { exit_code: { type: 'number' as const, const: 0 } },
    } };
    const input = { ...candidate('context', 'evidence'), event: { ...candidate('context', '').event, payload: { exit_code: 1 } } };
    expect(await JudgmentEngine.evaluate(judgment, input)).toMatchObject({
      passed: false, judgmentSkipped: true, attemptCount: 0,
      inputInspection: { missingRequired: [], preconditionPassed: false },
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect((await JudgmentEngine.evaluate(judgment, { ...input, event: { ...input.event, payload: { exit_code: 0 } } })).passed).toBe(true);
    expect(evaluate).toHaveBeenCalledOnce();
  });

  it('reports absent evidence once when presence-only and non-empty declarations overlap', () => {
    const judgment = { ...definition('context'), required_context_paths: ['review.evidence'],
      payload_paths: ['review.evidence'], precondition: { non_empty: {
        context_paths: ['review.evidence', 'review.evidence'], payload_paths: ['review.evidence'],
      } } };
    expect(inspectJudgmentInput(judgment, { ...candidate('context', undefined), context: {}, event: candidate('payload', undefined).event }))
      .toMatchObject({ missingRequired: ['payload.review.evidence', 'context.review.evidence'], preconditionPassed: false });
  });

  it('checks original evidence without adding unselected values to adapter input or changing values', async () => {
    const input = { ...candidate('context', ' rubric '), event: candidate('payload', ' evidence ').event };
    const judgment = { ...definition('context'), criterion: 'Is the submission sufficient?', context_paths: [], include_payload: false,
      precondition: { non_empty: { context_paths: ['review.evidence'], payload_paths: ['review.evidence'] } } };
    expect((await JudgmentEngine.evaluate(judgment, input)).passed).toBe(true);
    expect(evaluate.mock.calls[0]).toMatchObject([{ contextSnapshot: {} }, { context: {}, event: { payload: {} } }]);
    expect(JSON.stringify(evaluate.mock.calls)).not.toMatch(/rubric|evidence/);
    expect(input.context.review.evidence).toBe(' rubric ');
    expect(input.event.payload.review?.evidence).toBe(' evidence ');
  });

  it('accepts omitted and empty path lists as adding no non-empty checks', async () => {
    for (const non_empty of [{}, { context_paths: [], payload_paths: [] }]) {
      const judgment = { ...definition('context'), precondition: { non_empty } };
      expect((await JudgmentEngine.evaluate(judgment, candidate('context', null))).passed).toBe(true);
    }
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('preserves presence-only declarations including nulls and empty collections', async () => {
    for (const { value } of values.filter(entry => entry.value !== undefined)) {
      const input = candidate('context', value);
      const judgment = { type: 'predicate' as const, criterion: 'Is the evidence sufficient?', adapter_hint: 'fixture',
        required_context_paths: ['review.evidence'] };
      expect((await JudgmentEngine.evaluate(judgment, input)).passed).toBe(true);
    }
    for (const [type, value] of [['null', null], ['array', []], ['object', {}], ['string', '']] as const) {
      const input = candidate('payload', value);
      expect((await JudgmentEngine.evaluate({ type: 'predicate', criterion: 'Is the evidence sufficient?', adapter_hint: 'fixture',
        payload_paths: ['review.evidence'], precondition: { payload_schema: { 'review.evidence': { type } } },
      }, input)).passed).toBe(true);
    }
  });
});

describe('Manifest-seeded non-empty preconditions', () => {
  let directory: string;
  const stores: ReturnType<FSMEngine['getEventStore']>[] = [];
  const evaluate = vi.fn();
  const open = () => {
    const engine = new FSMEngine({ skillDir: directory, workspaceDir: directory });
    stores.push(engine.getEventStore());
    return engine;
  };
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'non-empty-judgment-'));
    vi.stubEnv('HOME', directory); vi.stubEnv('USERPROFILE', directory);
    JudgmentEngine.reset();
    evaluate.mockReset().mockResolvedValue({ verdict: true, passed: true, confidence: 1, adapterName: 'fixture', latencyMs: 0 });
    JudgmentEngine.registerAdapter({ id: 'fixture', supports: () => true, isAvailable: async () => true, isConfigured: () => true, evaluate });
    fs.writeFileSync(path.join(directory, 'skill.yaml'), yaml.dump({
      schema_version: '2', name: 'non-empty-defaults', description: 'Non-empty fixture', initial_state: 'REVIEW',
      runtime_requirements: { required_capabilities: ['judgment.payload_selection'] },
      default_context: { request: null, problem: null, purpose: null, questions: [] },
      states: { REVIEW: { transitions: { CHECK: { target: 'DONE', judgment: {
        ...definition('context'), precondition: { non_empty: { context_paths: ['request', 'problem', 'purpose', 'questions'] } },
      } } } }, DONE: { description: 'Complete' }, REPAIR: { description: 'Repair' } },
    }));
  });
  afterEach(() => {
    for (const store of stores.splice(0)) store.close();
    JudgmentEngine.reset(); vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each(['replay', 'snapshot_before', 'snapshot_after'])('refuses null/[] defaults through %s, then accepts supplied evidence', async recovery => {
    const engine = open();
    const store = engine.getEventStore();
    const snapshot = () => store.saveSnapshot(store.getAll().at(-1)!.seq, engine.getCurrentState(), engine.getContext());
    if (recovery === 'snapshot_before') snapshot();
    const first = await engine.handleSignal('CHECK', {}, { idempotencyKey: 'empty-defaults' });
    expect(first.transitioned).toBe(false);
    expect(engine.getCurrentState()).toBe('REVIEW');
    expect(engine.getPendingApprovals()).toHaveLength(0);
    const recorded = store.query({ type: 'GUARD_EVALUATED' })[0].payload.judgment;
    expect(recorded).toMatchObject({ judgmentSkipped: true, band: 'reject', attemptCount: 0,
      inputInspection: { missingRequired: ['context.request', 'context.problem', 'context.purpose', 'context.questions'], preconditionPassed: false } });
    expect(evaluate).not.toHaveBeenCalled();
    if (recovery === 'snapshot_after') snapshot();
    store.close();
    const restored = open();
    const duplicate = await restored.handleSignal('CHECK', {}, { idempotencyKey: 'empty-defaults' });
    expect(duplicate.refusalReason).toBe(first.refusalReason);
    expect(evaluate).not.toHaveBeenCalled();
    expect(restored.getPendingApprovals()).toHaveLength(0);
    expect(restored.getEventStore().query({ type: 'GUARD_EVALUATED' })).toHaveLength(1);
    expect(restored.getEventStore().query({ type: 'GUARD_EVALUATED' })[0].payload.judgment).toEqual(recorded);
    restored.updateContext({ request: 'Assess evidence', problem: 'A concrete problem', purpose: 'A stated purpose', questions: ['A question?'] });
    expect((await restored.handleSignal('CHECK', {})).transitioned).toBe(true);
    expect(restored.getCurrentState()).toBe('DONE');
    expect(evaluate).toHaveBeenCalledOnce();
  });
});
