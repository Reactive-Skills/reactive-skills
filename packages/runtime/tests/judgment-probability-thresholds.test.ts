import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { JudgmentEngine } from '../src/core/judgment-engine.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { JudgmentDefinitionSchema, JudgmentAdapter, JudgmentDefinition } from '../src/core/types.js';
import { predicateProbabilityForConfidence } from '../src/core/judgment-thresholds.js';
import { STATIC_RUNTIME_CAPABILITIES } from '../src/core/runtime-capabilities.js';

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

const evalContext = {
  event: { id: 'evt-threshold', seq: 1, timestamp: new Date().toISOString(), type: 'CHECK', payload: {} },
  context: {},
  currentState: 'CHECKING',
};

function mockPredicate(probability: number): void {
  sdkMock.systemOne.mockResolvedValue({
    model: 'jev-test',
    answers: { judgment: { type: 'noul', noul: probability } },
    usage: { input_tokens: 1, output_tokens: 1 },
  });
}

function mockChoice(choice: string, confidence: number, probabilities?: Record<string, number>): void {
  sdkMock.systemOne.mockResolvedValue({
    model: 'jev-test',
    answers: { judgment: { type: 'choice', choice, confidence, ...(probabilities ? { probabilities } : {}) } },
    usage: { input_tokens: 1, output_tokens: 1 },
  });
}

describe('Judgment probability thresholds', () => {
  let originalTypesafeApiKey: string | undefined;

  beforeEach(() => {
    originalTypesafeApiKey = process.env.TYPESAFE_API_KEY;
    process.env.TYPESAFE_API_KEY = 'test-key';
    sdkMock.systemOne.mockReset();
    JudgmentEngine.reset();
  });

  afterEach(() => {
    JudgmentEngine.reset();
    if (originalTypesafeApiKey === undefined) {
      delete process.env.TYPESAFE_API_KEY;
    } else {
      process.env.TYPESAFE_API_KEY = originalTypesafeApiKey;
    }
  });

  describe('schema', () => {
    it.each(['predicate', 'categorical'] as const)('accepts min_probability on %s judgments', (type) => {
      const result = JudgmentDefinitionSchema.safeParse({ type, criterion: 'Is it done?', min_probability: 0.85 });
      expect(result.success).toBe(true);
    });

    it('rejects min_probability together with min_confidence', () => {
      const result = JudgmentDefinitionSchema.safeParse({
        type: 'predicate',
        criterion: 'Is it done?',
        min_probability: 0.85,
        min_confidence: 0.7,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('not both');
    });

    it('rejects min_probability on evaluation judgments', () => {
      const result = JudgmentDefinitionSchema.safeParse({
        type: 'evaluation',
        criterion: 'How good is it?',
        rubric: ['weak', 'strong'],
        min_probability: 0.8,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('predicate and categorical');
    });

    it('rejects a predicate min_probability below 0.5', () => {
      const result = JudgmentDefinitionSchema.safeParse({ type: 'predicate', criterion: 'Is it done?', min_probability: 0.49 });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('at least 0.5');
    });

    it('rejects escalate without min_probability', () => {
      const result = JudgmentDefinitionSchema.safeParse({
        type: 'predicate',
        criterion: 'Is it done?',
        min_confidence: 0.7,
        escalate: { min_probability: 0.3, target: 'HUMAN_REVIEW' },
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues.some((issue) => issue.message === 'escalate requires min_probability')).toBe(true);
    });

    it('rejects an escalate bound that is not lower than min_probability', () => {
      const result = JudgmentDefinitionSchema.safeParse({
        type: 'predicate',
        criterion: 'Is it done?',
        min_probability: 0.85,
        escalate: { min_probability: 0.85, target: 'HUMAN_REVIEW' },
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('lower than min_probability');
    });

    it('accepts escalate below min_probability', () => {
      const result = JudgmentDefinitionSchema.safeParse({
        type: 'predicate',
        criterion: 'Is it done?',
        min_probability: 0.85,
        escalate: { min_probability: 0.3, target: 'HUMAN_REVIEW' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Jev predicate thresholds', () => {
    it.each([
      { probability: 0.85, passed: true },
      { probability: 0.84, passed: false },
    ])('min_probability 0.85 at P(yes) $probability passes: $passed', async ({ probability, passed }) => {
      mockPredicate(probability);
      const result = await JudgmentEngine.evaluate(
        { type: 'predicate', criterion: 'Is it done?', min_probability: 0.85, fallback_target: 'REVISE' },
        evalContext
      );

      expect(result.adapterName).toBe('jev');
      expect(result.probability).toBe(probability);
      expect(result.threshold).toEqual({ field: 'min_probability', value: 0.85 });
      expect(result.passed).toBe(passed);
      expect(result.band).toBe(passed ? 'accept' : 'reject');
      expect(result.fallbackTarget).toBe(passed ? undefined : 'REVISE');
    });

    it.each([
      { probability: 0.85, passed: true },
      { probability: 0.84, passed: false },
    ])('min_confidence 0.70 keeps its meaning at P(yes) $probability', async ({ probability, passed }) => {
      mockPredicate(probability);
      const result = await JudgmentEngine.evaluate(
        { type: 'predicate', criterion: 'Is it done?', min_confidence: 0.7 },
        evalContext
      );

      expect(result.threshold).toEqual({ field: 'min_confidence', value: 0.7 });
      expect(result.passed).toBe(passed);
    });

    it.each([
      { probability: 0.875, passed: true },
      { probability: 0.87, passed: false },
    ])('a judgment with no threshold keeps the 0.75 confidence default at P(yes) $probability', async ({ probability, passed }) => {
      mockPredicate(probability);
      const result = await JudgmentEngine.evaluate({ type: 'predicate', criterion: 'Is it done?' }, evalContext);

      expect(result.threshold).toEqual({ field: 'min_confidence', value: 0.75 });
      expect(result.passed).toBe(passed);
    });

    it('maps min_confidence to the P(yes) it requires', () => {
      expect(predicateProbabilityForConfidence(0.7)).toBe(0.85);
      expect(predicateProbabilityForConfidence(0.75)).toBe(0.875);
    });
  });

  describe('Jev categorical thresholds', () => {
    const judgment: JudgmentDefinition = {
      type: 'categorical',
      criterion: 'What kind of change is this?',
      options: ['bug', 'feature', 'chore'],
      min_probability: 0.8,
      fallback_target: 'TRIAGE',
    };

    it('passes on the picked label probability even when Jev confidence is low', async () => {
      mockChoice('feature', 0.3, { bug: 0.1, feature: 0.8, chore: 0.1 });
      const result = await JudgmentEngine.evaluate(judgment, evalContext);

      expect(result.verdict).toBe('feature');
      expect(result.probability).toBe(0.8);
      expect(result.passed).toBe(true);
      expect(result.band).toBe('accept');
    });

    it('rejects on the picked label probability even when Jev confidence is high', async () => {
      mockChoice('feature', 0.99, { bug: 0.11, feature: 0.79, chore: 0.1 });
      const result = await JudgmentEngine.evaluate(judgment, evalContext);

      expect(result.probability).toBe(0.79);
      expect(result.passed).toBe(false);
      expect(result.band).toBe('reject');
      expect(result.fallbackTarget).toBe('TRIAGE');
    });

    it('fails closed when the picked label has no probability', async () => {
      mockChoice('feature', 0.99);
      const result = await JudgmentEngine.evaluate(judgment, evalContext);

      expect(result.probability).toBeUndefined();
      expect(result.passed).toBe(false);
      expect(result.band).toBe('reject');
      expect(result.error).toContain('returned no probability');
    });

    it('does not accept a picked label outside the declared options', async () => {
      mockChoice('refactor', 0.99, { refactor: 0.95 });
      const result = await JudgmentEngine.evaluate(judgment, evalContext);

      expect(result.passed).toBe(false);
      expect(result.band).toBe('reject');
    });
  });

  describe('Script adapter exact checks', () => {
    it.each([
      { clean: true, passed: true, probability: 1 },
      { clean: false, passed: false, probability: 0 },
    ])('passes only a true predicate with min_probability (clean: $clean)', async ({ clean, passed, probability }) => {
      const result = await JudgmentEngine.evaluate(
        { type: 'predicate', criterion: 'payload.clean === true', adapter_hint: 'script', min_probability: 0.9 },
        { ...evalContext, event: { ...evalContext.event, payload: { clean } } }
      );

      expect(result.adapterName).toBe('script');
      expect(result.probability).toBe(probability);
      expect(result.passed).toBe(passed);
    });
  });

  describe('FSM escalation routing and event evidence', () => {
    let tmpDir: string;
    let probability: number | undefined;

    const fixedProbabilityAdapter: JudgmentAdapter = {
      id: 'fixed_probability',
      supports: () => true,
      isAvailable: async () => true,
      evaluate: async () => ({
        verdict: (probability ?? 0) >= 0.5,
        confidence: Math.abs((probability ?? 0) - 0.5) * 2,
        probability,
        passed: (probability ?? 0) >= 0.5,
        adapterName: 'fixed_probability',
        latencyMs: 0,
      }),
    };

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-threshold-test-'));
      JudgmentEngine.registerAdapter(fixedProbabilityAdapter);
      fs.writeFileSync(
        path.join(tmpDir, 'skill.yaml'),
        `schema_version: "2.1.0"
name: threshold-routing
description: "Probability threshold routing"
initial_state: REVIEW
states:
  REVIEW:
    description: "Review"
    transitions:
      SUBMIT:
        target: MERGE
        judgment:
          type: predicate
          criterion: "Is the change ready?"
          adapter_hint: fixed_probability
          min_probability: 0.85
          escalate:
            min_probability: 0.3
            target: HUMAN_REVIEW
          fallback_target: REVISE
  MERGE:
    description: "Merged"
  HUMAN_REVIEW:
    description: "Human review"
  REVISE:
    description: "Revise"
`
      );
    });

    afterEach(() => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    });

    it.each([
      { p: 0.9, state: 'MERGE', band: 'accept' },
      { p: 0.5, state: 'HUMAN_REVIEW', band: 'escalate' },
      { p: 0.2, state: 'REVISE', band: 'reject' },
    ])('routes P(yes) $p to $state', async ({ p, state, band }) => {
      probability = p;
      const engine = new FSMEngine({ skillDir: tmpDir, workspaceDir: tmpDir });

      await engine.handleSignal('SUBMIT', {});

      expect(engine.getCurrentState()).toBe(state);
      const evaluated = engine.getEventStore().query({ type: 'GUARD_EVALUATED' });
      expect(evaluated).toHaveLength(1);
      expect(evaluated[0].payload.judgment).toMatchObject({
        probability: p,
        threshold: { field: 'min_probability', value: 0.85 },
        band,
      });

      const fallbacks = engine.getEventStore().query({ type: 'GUARD_FALLBACK_TRIGGERED' });
      if (band === 'accept') {
        expect(fallbacks).toHaveLength(0);
      } else {
        expect(fallbacks).toHaveLength(1);
        expect(fallbacks[0].payload).toMatchObject({ to: state, band });
      }
    });

    it('rejects when the adapter returns no probability', async () => {
      probability = undefined;
      const engine = new FSMEngine({ skillDir: tmpDir, workspaceDir: tmpDir });

      await engine.handleSignal('SUBMIT', {});

      expect(engine.getCurrentState()).toBe('REVISE');
      const fallbacks = engine.getEventStore().query({ type: 'GUARD_FALLBACK_TRIGGERED' });
      expect(fallbacks[0].payload.band).toBe('reject');
      expect(fallbacks[0].payload.reason).toContain('returned no probability');
    });
  });

  it('advertises the probability thresholds capability', () => {
    expect(STATIC_RUNTIME_CAPABILITIES).toContain('judgment.probability_thresholds');
  });
});
