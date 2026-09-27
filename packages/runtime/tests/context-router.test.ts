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
    vi.useRealTimers();
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

  it.each([
    { confidence: 0.46, expectedRoute: 'skill' },
    { confidence: 0.40, expectedRoute: 'skill' },
    { confidence: 0.39, expectedRoute: 'none' },
  ])('applies the context route floor at confidence $confidence', async ({ confidence, expectedRoute }) => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    sdkMock.systemOne.mockResolvedValue({
      model: 'jev-test',
      answers: { judgment: { type: 'choice', choice: 'route_0_active_state_standard', confidence } },
    });

    const result = await new ContextRouter().route({
      userMessage: 'Use interface-craft to build a polished React marketing page',
      candidates: [{
        id: 'interface-craft',
        skill: 'interface-craft',
        summary: 'Universal UI/UX and frontend engineering',
        keywords: ['UI', 'frontend', 'design'],
      }],
    });

    expect(result.route).toBe(expectedRoute);
    expect(result.confidence).toBe(confidence);
    if (expectedRoute === 'skill') {
      expect(result.skill).toBe('interface-craft');
      expect(result.context_mode).toBe('active_state');
      expect(result.context_budget_tokens).toBe(4_096);
    } else {
      expect(result.context_budget_tokens).toBe(0);
    }
  });

  it('fails closed when Jev evaluation errors and Script fallback selects route_none', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    sdkMock.systemOne.mockRejectedValue(new Error('TypeSafe service unavailable'));

    const result = await new ContextRouter().route({
      userMessage: 'Use interface-craft to build a polished React marketing page',
      candidates: [{ id: 'interface-craft', skill: 'interface-craft', summary: 'Frontend design and engineering' }],
    });

    expect(result.route).toBe('none');
    expect(result.adapter).toBe('script');
    expect(result.fallback_triggered).toBe(true);
    expect(result.context_budget_tokens).toBe(0);
  });

  it('fails closed when Jev evaluation times out and Script fallback selects route_none', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    vi.useFakeTimers();
    let markRequestStarted!: () => void;
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    sdkMock.systemOne.mockImplementation((_request: unknown, options: { signal: AbortSignal }) => {
      markRequestStarted();
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    });

    const routePromise = new ContextRouter().route({
      userMessage: 'Use interface-craft to build a polished React marketing page',
      candidates: [{ id: 'interface-craft', skill: 'interface-craft', summary: 'Frontend design and engineering' }],
    });
    await requestStarted;
    await vi.advanceTimersByTimeAsync(3_000);
    const result = await routePromise;

    expect(result.route).toBe('none');
    expect(result.adapter).toBe('script');
    expect(result.fallback_triggered).toBe(true);
    expect(result.context_budget_tokens).toBe(0);
  });

  it('returns none without calling Jev when there are no candidates', async () => {
    const result = await new ContextRouter().route({
      userMessage: 'Help me choose a next step',
      candidates: [],
    });

    expect(result.route).toBe('none');
    expect(result.adapter_selection_reason).toBe('no_candidates');
    expect(result.context_budget_tokens).toBe(0);
    expect(sdkMock.systemOne).not.toHaveBeenCalled();
  });

  it('fails closed when Jev returns an invalid route choice', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    sdkMock.systemOne.mockResolvedValue({
      model: 'jev-test',
      answers: { judgment: { type: 'choice', choice: 'not-a-route-key', confidence: 0.99 } },
    });

    const result = await new ContextRouter().route({
      userMessage: 'Use interface-craft to build a polished React marketing page',
      candidates: [{ id: 'interface-craft', skill: 'interface-craft', summary: 'Frontend design and engineering' }],
    });

    expect(result.route).toBe('none');
    expect(result.context_budget_tokens).toBe(0);
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
