import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextRouter } from '../src/core/context-router.js';
import { JudgmentEngine } from '../src/core/judgment-engine.js';

const sdkMock = vi.hoisted(() => ({
  systemOne: vi.fn(),
  choice: vi.fn((instructions: unknown, criteria: unknown) => ({ type: 'choice', instructions, criteria })),
}));

vi.mock('@typesafe-ai/sdk', () => ({
  TypeSafeClient: class {
    public systemOne(...args: unknown[]) {
      return sdkMock.systemOne(...args);
    }
  },
  choice: sdkMock.choice,
}));

describe('ContextRouter', () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    sdkMock.systemOne.mockReset();
    sdkMock.choice.mockClear();
    JudgmentEngine.reset();
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalApiKey;
  });

  it('fails closed without Jev and does not select a skill', async () => {
    const result = await new ContextRouter().route({
      userMessage: 'Help me decide what to do next',
      candidates: [{ id: 'synthesis', skill: 'synthesis', summary: 'Turn ambiguous inputs into a decision' }],
    });

    expect(result.route).toBe('none');
    expect(result.adapter).toBe('script');
    expect(result.context_budget_tokens).toBe(0);
    expect(sdkMock.systemOne).not.toHaveBeenCalled();
  });

  it('uses one Jev decision to select skill, context depth, and risk', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    sdkMock.systemOne.mockResolvedValue({
      model: 'jev-test',
      answers: { judgment: { type: 'choice', choice: 'route_0_targeted_reference_human_review', confidence: 0.94 } },
      usage: { input_tokens: 42, output_tokens: 0 },
    });

    const result = await new ContextRouter().route({
      userMessage: 'Review this high-impact decision and cite the relevant policy',
      tokenBudget: 6_000,
      stateHints: { phase: 'review' },
      candidates: [{
        id: 'policy-review',
        skill: 'policy-review',
        summary: 'Review high-impact decisions against policy',
        keywords: ['policy', 'approval'],
      }],
    });

    expect(result.route).toBe('skill');
    expect(result.skill).toBe('policy-review');
    expect(result.context_mode).toBe('targeted_reference');
    expect(result.context_budget_tokens).toBe(6_000);
    expect(result.needs_deep_reasoning).toBe(true);
    expect(result.needs_human_review).toBe(true);
    expect(result.adapter).toBe('jev');
    expect(result.usage).toEqual({ input_tokens: 42, output_tokens: 0 });
    expect(sdkMock.systemOne).toHaveBeenCalledOnce();
  });

  it('rejects duplicate candidate ids before calling Jev', async () => {
    await expect(new ContextRouter().route({
      userMessage: 'Choose a skill',
      candidates: [
        { id: 'same', skill: 'one', summary: 'First' },
        { id: 'same', skill: 'two', summary: 'Second' },
      ],
    })).rejects.toThrow('Duplicate context route candidate id');
    expect(sdkMock.systemOne).not.toHaveBeenCalled();
  });
});
