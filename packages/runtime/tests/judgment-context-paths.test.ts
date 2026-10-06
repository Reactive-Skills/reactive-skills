import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { JudgmentEngine, JevJudgmentAdapter } from '../src/core/judgment-engine.js';
import { scopeJudgmentContext, validateContextPath } from '../src/core/judgment-context.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { JudgmentDefinitionSchema } from '../src/core/types.js';

const sdkMock = vi.hoisted(() => ({
  systemOne: vi.fn(),
  noul: vi.fn((instructions: unknown) => ({ type: 'noul', instructions })),
  choice: vi.fn((instructions: unknown, criteria: unknown) => ({ type: 'choice', instructions, criteria })),
  score: vi.fn((instructions: unknown, criteria: unknown) => ({ type: 'score', instructions, criteria })),
}));

vi.mock('@typesafe-ai/sdk', () => ({
  TypeSafeClient: class {
    public systemOne(...args: unknown[]) {
      return sdkMock.systemOne(...args);
    }
  },
  noul: sdkMock.noul,
  choice: sdkMock.choice,
  score: sdkMock.score,
}));

const RUN_CONTEXT = {
  mission: 'Model the domain',
  glossary: { decider: 'decides' },
  write_side: { deciders: ['Register', 'Cancel'], sampling: 'all' },
  read_projections: ['Orders'],
  nothing: null,
};

const evalContext = {
  event: {
    id: 'evt-1',
    seq: 1,
    timestamp: new Date().toISOString(),
    type: 'MODEL_SUBMITTED',
    payload: { model: 'coherent' },
  },
  context: RUN_CONTEXT,
  currentState: 'DOMAIN_MODELING',
};

function sentState(): Record<string, unknown> {
  return sdkMock.systemOne.mock.calls[0][0].state;
}

describe('Judgment context_paths and include_payload (#24)', () => {
  let tmpDir: string;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-context-paths-'));
    originalApiKey = process.env.TYPESAFE_API_KEY;
    process.env.TYPESAFE_API_KEY = 'test-key';
    sdkMock.systemOne.mockReset();
    sdkMock.systemOne.mockResolvedValue({
      model: 'jev-test',
      answers: { judgment: { type: 'noul', noul: 0.9 } },
      usage: { input_tokens: 321, output_tokens: 2 },
    });
    JudgmentEngine.reset();
  });

  afterEach(() => {
    JudgmentEngine.reset();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalApiKey;
  });

  it('sends only the listed context paths and the payload', async () => {
    const result = await new JevJudgmentAdapter().evaluate(
      {
        type: 'predicate',
        criterion: 'Does every decider have a read projection?',
        contextSnapshot: RUN_CONTEXT,
        contextPaths: ['write_side.deciders', 'read_projections'],
      },
      evalContext
    );

    expect(sentState()).toEqual({
      event: { model: 'coherent' },
      context: {
        'write_side.deciders': ['Register', 'Cancel'],
        read_projections: ['Orders'],
      },
      currentState: 'DOMAIN_MODELING',
    });
    expect(result.contextSent).toEqual({
      paths: ['write_side.deciders', 'read_projections'],
      missing: [],
      includePayload: true,
      inputTokens: 321,
    });
  });

  it('leaves the payload out with include_payload: false', async () => {
    const result = await new JevJudgmentAdapter().evaluate(
      {
        type: 'predicate',
        criterion: 'Is the model coherent?',
        contextSnapshot: RUN_CONTEXT,
        contextPaths: ['read_projections'],
        includePayload: false,
      },
      evalContext
    );

    expect(sentState()).toEqual({
      context: { read_projections: ['Orders'] },
      currentState: 'DOMAIN_MODELING',
    });
    expect(sentState()).not.toHaveProperty('event');
    expect(result.contextSent).toMatchObject({ paths: ['read_projections'], includePayload: false });
  });

  it('sends the whole context without the payload when only include_payload is false', async () => {
    const result = await new JevJudgmentAdapter().evaluate(
      { type: 'predicate', criterion: 'Is the model coherent?', contextSnapshot: RUN_CONTEXT, includePayload: false },
      evalContext
    );

    expect(sentState()).toEqual({ context: RUN_CONTEXT, currentState: 'DOMAIN_MODELING' });
    expect(result.contextSent).toEqual({ missing: [], includePayload: false, inputTokens: 321 });
  });

  it('keeps today\'s state and records nothing when neither field is set', async () => {
    const result = await new JevJudgmentAdapter().evaluate(
      { type: 'predicate', criterion: 'Is the model coherent?', contextSnapshot: RUN_CONTEXT },
      evalContext
    );

    expect(sentState()).toEqual({
      event: { model: 'coherent' },
      context: RUN_CONTEXT,
      currentState: 'DOMAIN_MODELING',
    });
    expect(Object.keys(sentState())).toEqual(['event', 'context', 'currentState']);
    expect(result).not.toHaveProperty('contextSent');
  });

  it('sends nothing for a missing path, records it, and still judges', async () => {
    const result = await new JevJudgmentAdapter().evaluate(
      {
        type: 'predicate',
        criterion: 'Is the model coherent?',
        contextSnapshot: RUN_CONTEXT,
        contextPaths: ['read_projections', 'write_side.projections', 'missing_key', 'nothing', 'nothing.deeper'],
      },
      evalContext
    );

    expect(sentState().context).toEqual({ read_projections: ['Orders'], nothing: null });
    expect(result.passed).toBe(true);
    expect(result.contextSent).toMatchObject({
      paths: ['read_projections', 'nothing'],
      missing: ['write_side.projections', 'missing_key', 'nothing.deeper'],
    });
  });

  it('scopes categorical and evaluation judgments the same way', async () => {
    const adapter = new JevJudgmentAdapter();
    sdkMock.systemOne.mockResolvedValueOnce({
      model: 'jev-test',
      answers: { judgment: { type: 'choice', choice: 'a', confidence: 0.9, probabilities: {} } },
    });
    const categorical = await adapter.evaluate(
      { type: 'categorical', criterion: 'Which?', options: ['a', 'b'], contextSnapshot: RUN_CONTEXT, contextPaths: ['mission'] },
      evalContext
    );
    expect(sentState().context).toEqual({ mission: 'Model the domain' });
    expect(categorical.contextSent).toEqual({ paths: ['mission'], missing: [], includePayload: true });

    sdkMock.systemOne.mockResolvedValueOnce({
      model: 'jev-test',
      answers: { judgment: { type: 'score', score: 2, confidence: 0.9, legend: {}, probabilities: {} } },
    });
    const evaluation = await adapter.evaluate(
      { type: 'evaluation', criterion: 'How good?', rubric: ['weak', 'strong'], contextSnapshot: RUN_CONTEXT, contextPaths: ['glossary'] },
      evalContext
    );
    expect(sdkMock.systemOne.mock.calls[1][0].state.context).toEqual({ glossary: RUN_CONTEXT.glossary });
    expect(evaluation.contextSent).toMatchObject({ paths: ['glossary'] });
  });

  it('passes a judgment\'s context_paths and include_payload through the engine', async () => {
    const result = await JudgmentEngine.evaluate(
      {
        type: 'predicate',
        criterion: 'Is the model coherent?',
        adapter_hint: 'jev',
        min_probability: 0.8,
        context_paths: ['write_side'],
        include_payload: false,
      },
      evalContext
    );

    expect(sentState()).toEqual({ context: { write_side: RUN_CONTEXT.write_side }, currentState: 'DOMAIN_MODELING' });
    expect(result.passed).toBe(true);
    expect(result.contextSent).toEqual({ paths: ['write_side'], missing: [], includePayload: false, inputTokens: 321 });
  });

  it('records the paths sent in GUARD_EVALUATED', async () => {
    fs.writeFileSync(path.join(tmpDir, 'skill.yaml'), `
schema_version: "2.0.0"
name: context-paths-skill
description: "Scoped judgment context"
initial_state: modeling
states:
  modeling:
    description: "Modeling"
    transitions:
      SUBMIT:
        target: DONE
        judgment:
          type: predicate
          criterion: "Does every decider have a projection?"
          adapter_hint: jev
          min_probability: 0.8
          context_paths: [write_side.deciders, missing_key]
          include_payload: false
  DONE:
    description: "Done"
`);
    const engine = new FSMEngine({ skillDir: tmpDir, workspaceDir: tmpDir });
    engine.updateContext({ ...RUN_CONTEXT });

    await engine.handleSignal('SUBMIT', { model: 'coherent' });

    expect(engine.getCurrentState()).toBe('DONE');
    expect(sentState()).toEqual({
      context: { 'write_side.deciders': ['Register', 'Cancel'] },
      currentState: 'modeling',
    });
    const [evaluated] = engine.getEventStore().query({ type: 'GUARD_EVALUATED' });
    expect(evaluated.payload.judgment.contextSent).toEqual({
      paths: ['write_side.deciders'],
      missing: ['missing_key'],
      includePayload: false,
      inputTokens: 321,
    });
  });

  describe('schema and path syntax', () => {
    const base = { type: 'predicate', criterion: 'Is it ready?' } as const;

    it('accepts dotted paths, array indexes, and include_payload', () => {
      const parsed = JudgmentDefinitionSchema.parse({
        ...base,
        context_paths: ['write_side.deciders', 'plans.0.name', 'read-projections'],
        include_payload: false,
      });
      expect(parsed.context_paths).toEqual(['write_side.deciders', 'plans.0.name', 'read-projections']);
      expect(parsed.include_payload).toBe(false);
    });

    it.each([
      ['', 'cannot be empty'],
      ['write_side.', 'empty segment'],
      ['.write_side', 'empty segment'],
      ['a..b', 'empty segment'],
      ['plans[0]', 'whitespace or brackets'],
      ['write side', 'whitespace or brackets'],
      ['a.__proto__.b', "cannot use '__proto__'"],
      ['constructor', "cannot use 'constructor'"],
    ])('rejects the path %j', (contextPath, message) => {
      const result = JudgmentDefinitionSchema.safeParse({ ...base, context_paths: [contextPath] });
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain(message);
      expect(validateContextPath(contextPath)).toContain(message);
    });

    it('rejects a non-boolean include_payload and a non-list context_paths', () => {
      expect(JudgmentDefinitionSchema.safeParse({ ...base, include_payload: 'no' }).success).toBe(false);
      expect(JudgmentDefinitionSchema.safeParse({ ...base, context_paths: 'write_side' }).success).toBe(false);
    });
  });

  describe('scopeJudgmentContext', () => {
    it('does not read inherited properties and drops duplicate paths', () => {
      const scoped = scopeJudgmentContext({ a: { b: 1 } }, ['a.b', 'a.b', 'a.toString', 'a.hasOwnProperty']);
      expect(scoped).toEqual({ context: { 'a.b': 1 }, sent: ['a.b'], missing: ['a.toString', 'a.hasOwnProperty'] });
    });

    it('indexes arrays and treats an empty list as sending no context', () => {
      expect(scopeJudgmentContext({ plans: [{ name: 'x' }] }, ['plans.0.name', 'plans.1'])).toEqual({
        context: { 'plans.0.name': 'x' },
        sent: ['plans.0.name'],
        missing: ['plans.1'],
      });
      expect(scopeJudgmentContext({ a: 1 }, [])).toEqual({ context: {}, sent: [], missing: [] });
    });
  });
});
