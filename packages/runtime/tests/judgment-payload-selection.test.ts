import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JudgmentEngine } from '../src/core/judgment-engine.js';
import { GuardEvaluator } from '../src/core/guard-evaluator.js';
import { JudgmentDefinitionSchema, SkillManifestSchema } from '../src/core/types.js';
import type { JudgmentDefinition } from '../src/core/types.js';

const sdk = vi.hoisted(() => ({ systemOne: vi.fn() }));
vi.mock('@typesafe-ai/sdk', () => ({
  TypeSafeClient: class { systemOne(...args: unknown[]) { return sdk.systemOne(...args); } },
  noul: (instructions: string) => ({ type: 'noul', instructions }),
  choice: (instructions: string, criteria: unknown) => ({ type: 'choice', instructions, criteria }),
  score: (instructions: string, criteria: unknown) => ({ type: 'score', instructions, criteria }),
}));

const context = {
  event: { id: 'e1', seq: 1, type: 'CHECK', timestamp: '2026-01-01', payload: {
    checks: [{ text: 'unselected' }, { text: 'current evidence', other: 'excluded sibling' }],
    unrelated: 'excluded payload', exit_code: 0,
  } },
  context: { review: { rubric: 'relevant', unused: 'excluded context' } },
  currentState: 'REVIEW',
};
const judgment: JudgmentDefinition = {
  type: 'predicate', criterion: 'Does the evidence satisfy the rubric?', adapter_hint: 'jev',
  context_paths: ['review.rubric'], payload_paths: ['checks.1.text'],
  required_context_paths: ['review.rubric'],
};

beforeEach(() => {
  vi.stubEnv('TYPESAFE_API_KEY', 'fixture-key');
  JudgmentEngine.reset();
  sdk.systemOne.mockReset().mockResolvedValue({ answers: { judgment: { noul: 0.99 } } });
});
afterEach(() => { JudgmentEngine.reset(); vi.unstubAllEnvs(); });

describe('Opt-in judgment input contract', () => {
  it('sends only selected evidence with nested payload and legacy flat context paths', async () => {
    const result = await JudgmentEngine.evaluate(judgment, context);
    const state = sdk.systemOne.mock.calls[0][0].state;
    expect(JSON.parse(JSON.stringify(state))).toEqual({
      event: { checks: [null, { text: 'current evidence' }] },
      context: { 'review.rubric': 'relevant' }, currentState: 'REVIEW',
    });
    expect(JSON.stringify(sdk.systemOne.mock.calls)).not.toMatch(/unselected|excluded/);
    expect(result.inputInspection).toMatchObject({
      payloadPaths: ['checks.1.text'], contextPaths: ['review.rubric'], missingRequired: [],
      fullEvent: false, byteCount: Buffer.byteLength(JSON.stringify(state), 'utf8'),
    });
  });

  it.each(['payload', 'context', 'invalid'])('refuses %s selection before any request or fallback', async kind => {
    const definition = { ...judgment, fallback_adapter: 'jev', fallback_target: 'REPAIR' };
    if (kind === 'payload') definition.payload_paths = ['absent.text'];
    if (kind === 'context') definition.required_context_paths = ['review.absent'];
    if (kind === 'invalid') definition.payload_paths = ['checks.__proto__.text'];
    const result = await JudgmentEngine.evaluate(definition, context);
    expect(result.passed).toBe(false);
    expect(result.band).toBe('reject');
    expect(result.judgmentSkipped).toBe(true);
    expect(result.attemptCount).toBe(0);
    expect(result.fallbackTarget).toBeUndefined();
    expect(result.inputInspection?.errors.length).toBeGreaterThan(0);
    expect(sdk.systemOne).not.toHaveBeenCalled();
  });

  it('uses a pure payload precondition before judgment, preserving legacy guard order', async () => {
    const precondition = { payload_schema: { exit_code: { type: 'number' as const, const: 0 } } };
    const invalid = { ...context, event: { ...context.event, payload: { ...context.event.payload, exit_code: 1 } } };
    const refused = await GuardEvaluator.evaluate('true', undefined, invalid, { ...judgment, precondition });
    expect(refused).toMatchObject({ passed: false, judgmentResult: { judgmentSkipped: true, attemptCount: 0 } });
    expect(sdk.systemOne).not.toHaveBeenCalled();
    expect(await GuardEvaluator.evaluate('false', undefined, context, { ...judgment, precondition })).toMatchObject({ passed: false });
    expect(sdk.systemOne).toHaveBeenCalledOnce();
    await GuardEvaluator.evaluate('false', undefined, invalid, { type: 'predicate', criterion: judgment.criterion, adapter_hint: 'jev' });
    expect(sdk.systemOne).toHaveBeenCalledTimes(2);
  });

  it('bounds custom primary and fallback adapter inputs including contextSnapshot', async () => {
    const requests: unknown[] = [];
    for (const id of ['primary', 'fallback']) JudgmentEngine.registerAdapter({
      id, supports: () => true, isAvailable: async () => true,
      evaluate: async (request, evaluation) => {
        requests.push([request, evaluation]);
        if (id === 'primary') throw new Error('offline');
        return { verdict: true, passed: true, confidence: 1, adapterName: id, latencyMs: 0 };
      },
    });
    const result = await JudgmentEngine.evaluate({ ...judgment, adapter_hint: 'primary', fallback_adapter: 'fallback' }, context);
    expect(result.passed).toBe(true);
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests)).not.toMatch(/unselected|excluded/);
    expect(context.event.payload.checks[1]).toHaveProperty('other', 'excluded sibling');
  });

  it('inspects without invoking adapters and records the same content-free metadata on outage', async () => {
    const input = await import('../src/core/judgment-input.js');
    const inspection = input.inspectJudgmentInput(judgment, context);
    expect(inspection).toMatchObject({ adapter: 'jev', destinationClass: 'remote', fullEvent: false, missingRequired: [], errors: [] });
    expect(JSON.stringify(inspection)).not.toContain('current evidence');
    expect(sdk.systemOne).not.toHaveBeenCalled();
    sdk.systemOne.mockRejectedValue(new Error('offline'));
    const result = await JudgmentEngine.evaluate(judgment, context);
    expect(result.inputInspection).toEqual(inspection);
  });

  it.each([
    { payload_paths: ['checks.1.other'] }, { criterion: 'Is the other evidence adequate?' },
    { options: ['accept', 'reject'] }, { min_probability: 0.95 }, { rubric: ['weak', 'strong'] },
  ])('does not cache when judgment configuration changes: %j', async change => {
    await JudgmentEngine.evaluate(judgment, context);
    await JudgmentEngine.evaluate({ ...judgment, ...change }, context);
    expect(sdk.systemOne).toHaveBeenCalledTimes(2);
  });

  it('does not cache when selected evidence or model configuration changes', async () => {
    await JudgmentEngine.evaluate(judgment, context);
    vi.stubEnv('TYPESAFE_DEFAULT_MODEL', 'changed-model');
    await JudgmentEngine.evaluate(judgment, { ...context, event: { ...context.event, payload: {
      ...context.event.payload, checks: [{ text: 'unused' }, { text: 'revised evidence' }],
    } } });
    expect(sdk.systemOne).toHaveBeenCalledTimes(2);
    expect(sdk.systemOne.mock.calls[1][0].state.event.checks[1].text).toBe('revised evidence');
  });

  it('keeps concurrent input selection and inspection independent', async () => {
    const other = { ...context, event: { ...context.event, payload: { ...context.event.payload, checks: [{ text: 'second' }] } } };
    const results = await Promise.all([
      JudgmentEngine.evaluate(judgment, context),
      JudgmentEngine.evaluate({ ...judgment, payload_paths: ['checks.0.text'] }, other),
    ]);
    expect(sdk.systemOne.mock.calls.map(call => JSON.stringify(call[0].state.event))).toEqual([
      '{"checks":[null,{"text":"current evidence"}]}', '{"checks":[{"text":"second"}]}',
    ]);
    expect(results.map(result => result.inputInspection?.payloadPaths)).toEqual([['checks.1.text'], ['checks.0.text']]);
  });

  it.each(['string', 'number', 'boolean', 'object', 'array', 'null'] as const)('validates %s payload types locally', async type => {
    const values = { string: 'text', number: 1, boolean: true, object: {}, array: [], null: null };
    const definition = { ...judgment, precondition: { payload_schema: { value: { type } } } };
    const candidate = { ...context, event: { ...context.event, payload: { ...context.event.payload, value: values[type] } } };
    expect((await JudgmentEngine.evaluate(definition, candidate)).passed).toBe(true);
    const missing = await JudgmentEngine.evaluate(definition, context);
    expect(missing).toMatchObject({ passed: false, judgmentSkipped: true, attemptCount: 0 });
    expect(sdk.systemOne).toHaveBeenCalledOnce();
  });

  it('preserves overlapping subtrees, nulls and source objects', async () => {
    const original = JSON.stringify(context);
    const result = await JudgmentEngine.evaluate({ ...judgment, payload_paths: ['checks.1.text', 'checks.1', 'checks.1.text'] }, context);
    expect(result.passed).toBe(true);
    expect(sdk.systemOne.mock.calls[0][0].state.event.checks[1]).toEqual(context.event.payload.checks[1]);
    expect(JSON.stringify(context)).toBe(original);
    sdk.systemOne.mockClear();
    await JudgmentEngine.evaluate({ ...judgment, payload_paths: [] }, context);
    expect(sdk.systemOne.mock.calls[0][0].state.event).toEqual({});
  });

  it('omits payload and bounds contextSnapshot even for a custom adapter', async () => {
    const evaluate = vi.fn(async () => ({ verdict: true, passed: true, confidence: 1, adapterName: 'fixture', latencyMs: 0 }));
    JudgmentEngine.registerAdapter({ id: 'fixture', supports: () => true, isAvailable: async () => true, evaluate });
    await JudgmentEngine.evaluate({ ...judgment, adapter_hint: 'fixture', payload_paths: undefined, include_payload: false }, context);
    expect(evaluate.mock.calls[0]).toMatchObject([
      { contextSnapshot: { 'review.rubric': 'relevant' } },
      { event: { payload: {} }, context: { 'review.rubric': 'relevant' } },
    ]);
    expect(JSON.stringify(evaluate.mock.calls)).not.toContain('current evidence');
  });

  it('retains input audit metadata when a subsequent inline guard throws', async () => {
    const result = await GuardEvaluator.evaluate('payload.missing.value === 0', undefined, context, judgment);
    expect(result.passed).toBe(false);
    expect(result.judgmentResult?.inputInspection).toMatchObject({ payloadPaths: ['checks.1.text'] });
  });

  it('records input metadata when automatic adapter availability throws', async () => {
    JudgmentEngine.registerAdapter({ id: 'jev', supports: () => true,
      isAvailable: async () => { throw new Error('availability failed'); },
      evaluate: async () => { throw new Error('must not evaluate'); },
    });
    const result = await GuardEvaluator.evaluate(undefined, undefined, context, { ...judgment, adapter_hint: undefined });
    expect(result.passed).toBe(false);
    expect(result.judgmentResult?.inputInspection).toMatchObject({ payloadPaths: ['checks.1.text'] });
    expect(result.judgmentResult?.attemptCount).toBe(0);
  });

  it('refuses a non-JSON selected value with metadata and no request', async () => {
    const candidate = { ...context, event: { ...context.event, payload: { ...context.event.payload, check: 1n } } };
    const result = await JudgmentEngine.evaluate({ ...judgment, payload_paths: ['check'] }, candidate);
    expect(result).toMatchObject({ passed: false, judgmentSkipped: true, inputInspection: { byteCount: 0 } });
    expect(sdk.systemOne).not.toHaveBeenCalled();
  });

  it('validates selection/preconditions and requires the capability on dependent manifests', () => {
    expect(JudgmentDefinitionSchema.parse(judgment)).toMatchObject(judgment);
    for (const bad of [
      { payload_paths: ['a..b'] }, { payload_paths: ['checks.10001.text'] },
      { payload_paths: ['checks.01.text'] }, { include_payload: false },
      { precondition: { payload_schema: { exit_code: { type: 'unknown' } } } },
    ]) expect(JudgmentDefinitionSchema.safeParse({ ...judgment, ...bad }).success).toBe(false);
    const manifest = { schema_version: '2', name: 'selection', description: 'selection', initial_state: 'REVIEW',
      states: { REVIEW: { transitions: { CHECK: { target: 'REVIEW', judgment } } } } };
    expect(SkillManifestSchema.safeParse(manifest).success).toBe(false);
    expect(SkillManifestSchema.safeParse({ ...manifest,
      runtime_requirements: { required_capabilities: ['judgment.payload_selection'] },
    }).success).toBe(true);
  });
});
