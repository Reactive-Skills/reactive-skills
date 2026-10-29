import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JudgmentAuthoringError, JudgmentEngine } from '../src/core/judgment-engine.js';
import { JudgmentDefinitionSchema, type JudgmentAdapter, type JudgmentDefinition } from '../src/core/types.js';
import type { GuardEvaluationContext } from '../src/core/guard-evaluator.js';
import { STATIC_RUNTIME_CAPABILITIES } from '../src/core/runtime-capabilities.js';

const context: GuardEvaluationContext = {
  event: { id: 'check', seq: 1, timestamp: '2026-01-01T00:00:00Z', type: 'CHECK', payload: { success: true } },
  context: {},
  currentState: 'REVIEW',
};
const judgment = {
  type: 'predicate', criterion: 'Does the evidence support approval?',
  adapter_hint: 'primary', fallback_adapter: 'backup', fallback_target: 'REPAIR',
  total_timeout_ms: 100,
} satisfies JudgmentDefinition & { total_timeout_ms: number };

function register(id: string, evaluate: JudgmentAdapter['evaluate']) {
  const adapter = { id, supports: () => true, isAvailable: async () => true, isConfigured: () => true, evaluate: vi.fn(evaluate) };
  JudgmentEngine.registerAdapter(adapter);
  return adapter;
}

function success(id: string) {
  return { verdict: true, confidence: 0.9, probability: 0.95, passed: true, adapterName: id, latencyMs: 0 };
}

describe('Whole judgment deadline and failure accounting', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
    JudgmentEngine.reset();
  });
  afterEach(() => { JudgmentEngine.reset(); vi.useRealTimers(); });

  it('cancels a custom adapter and refuses at the total deadline even if it ignores cancellation', async () => {
    let signal: AbortSignal | undefined;
    const primary = register('primary', async (_req, ctx) => {
      signal = ctx.signal;
      return new Promise(() => {});
    });
    const backup = register('backup', async () => success('backup'));
    const pending = JudgmentEngine.evaluate(judgment, context);
    await vi.advanceTimersByTimeAsync(100);
    const result = await pending;
    expect(signal?.aborted).toBe(true);
    expect(primary.evaluate).toHaveBeenCalledOnce();
    expect(backup.evaluate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ band: 'unevaluable', passed: false, latencyMs: 100, attemptCount: 1 });
    expect(result.fallbackTarget).toBeUndefined();
    expect(result).toHaveProperty('attempts.0', expect.objectContaining({ adapter: 'primary', elapsedMs: 100, outcome: 'timeout', cancellationCause: 'total_deadline', breakerAfter: 'CLOSED' }));
    expect(result).toHaveProperty('attempts.1', expect.objectContaining({ adapter: 'backup', invoked: false, reason: 'total_deadline' }));
    expect(result.adapterSelectionReason).toBe('adapter_hint:primary:unevaluable');
    expect(result.error).toContain('primary is unavailable (Judgment total deadline timed out after 100ms;');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes only the remaining total budget to a distinct fallback', async () => {
    register('primary', async () => { await new Promise(resolve => setTimeout(resolve, 35)); throw new Error('offline'); });
    const backup = register('backup', async (_req, ctx) => {
      expect(ctx.timeout_ms).toBe(65);
      return new Promise(() => {});
    });
    const pending = JudgmentEngine.evaluate(judgment, context);
    await vi.advanceTimersByTimeAsync(100);
    const result = await pending;
    expect(backup.evaluate).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ band: 'unevaluable', latencyMs: 100, attemptCount: 2 });
    expect(result).toHaveProperty('attempts.0.elapsedMs', 35);
    expect(result).toHaveProperty('attempts.1.elapsedMs', 65);
  });

  it.each([false, true])('requires an explicit policy for the same-adapter fallback retry (%s)', async retry => {
    const primary = register('primary', async () => { await new Promise(resolve => setTimeout(resolve, 10)); throw new Error('offline'); });
    const pending = JudgmentEngine.evaluate({ ...judgment, fallback_adapter: 'primary', ...(retry ? { retry_policy: { max_attempts_per_adapter: 2 } } : {}) }, context);
    await vi.advanceTimersByTimeAsync(20);
    const result = await pending;
    expect(primary.evaluate).toHaveBeenCalledTimes(retry ? 2 : 1);
    expect(result).toMatchObject({ band: 'unevaluable', latencyMs: retry ? 20 : 10, attemptCount: retry ? 2 : 1 });
    expect(result.fallbackTarget).toBeUndefined();
  });

  it('retains legacy duplicate fallback and timeout propagation while measuring refusal time', async () => {
    const primary = register('primary', async () => { await new Promise(resolve => setTimeout(resolve, 10)); throw new Error('offline'); });
    const { total_timeout_ms: _deadline, ...legacy } = judgment;
    const pending = JudgmentEngine.evaluate({ ...legacy, fallback_adapter: 'primary', timeout_ms: 50 }, context);
    await vi.advanceTimersByTimeAsync(20);
    const result = await pending;
    expect(primary.evaluate).toHaveBeenCalledTimes(2);
    expect(primary.evaluate.mock.calls.map(call => call[1].timeout_ms)).toEqual([50, undefined]);
    expect(result).toMatchObject({ band: 'unevaluable', latencyMs: 20, attemptCount: 2 });
  });

  it.each([
    ['credentials', 'backup', 'backup', Object.assign(new Error('credential rejected'), { status: 401 })],
    ['authoring', 'backup', 'backup', new JudgmentAuthoringError('rubric needs criteria')],
    ['credentials from an unregistered fallback', 'missing', 'script', Object.assign(new Error('credential rejected'), { status: 401 })],
  ])('keeps legacy outage guidance when the fallback throws %s', async (_label, fallbackId, runnerId, error) => {
    register('primary', async () => { throw new Error('offline'); });
    const runner = register(runnerId, async () => { throw error; });
    const { total_timeout_ms: _deadline, ...legacy } = judgment;
    const result = await JudgmentEngine.evaluate({ ...legacy, fallback_adapter: fallbackId }, context);
    expect(runner.evaluate).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ band: 'unevaluable', passed: false, adapterName: fallbackId });
    expect(result.error).toMatch(/primary is unavailable .*Retry the signal when primary is reachable/);
    expect(result.error).not.toMatch(/credentials|misconfigured/);
    expect(result.fallbackTarget).toBeUndefined();
  });

  it.each([
    ['credentials', Object.assign(new Error('credential rejected'), { status: 401 }), /fix the credentials/, 'CLOSED'],
    ['authoring', new JudgmentAuthoringError('rubric needs criteria'), /misconfigured/, 'CLOSED'],
    ['outage', new Error('offline'), /unavailable/, 'CLOSED'],
  ])('records %s failure without semantic rejection or repair routing', async (kind, error, message, breaker) => {
    register('primary', async () => { await new Promise(resolve => setTimeout(resolve, 15)); throw error; });
    const pending = JudgmentEngine.evaluate({ ...judgment, fallback_adapter: 'script' }, context);
    await vi.advanceTimersByTimeAsync(15);
    const result = await pending;
    expect(result).toMatchObject({ band: 'unevaluable', latencyMs: 15, passed: false });
    expect(result.error).toMatch(message);
    expect(result.fallbackTarget).toBeUndefined();
    expect(result).toHaveProperty('attempts.0', expect.objectContaining({ outcome: kind, elapsedMs: 15, breakerAfter: breaker }));
  });

  it('validates the optional deadline and explicit retry policy', () => {
    expect(STATIC_RUNTIME_CAPABILITIES).toContain('judgment.total_deadline');
    expect(JudgmentDefinitionSchema.parse(judgment)).toHaveProperty('total_timeout_ms', 100);
    for (const total_timeout_ms of [0, -1, Infinity, NaN]) {
      expect(JudgmentDefinitionSchema.safeParse({ ...judgment, total_timeout_ms }).success).toBe(false);
    }
    expect(JudgmentDefinitionSchema.safeParse({ ...judgment, retry_policy: { max_attempts_per_adapter: 2 } }).success).toBe(true);
    expect(JudgmentDefinitionSchema.safeParse({ ...judgment, retry_policy: { max_attempts_per_adapter: 0 } }).success).toBe(false);
    const { total_timeout_ms: _deadline, ...legacy } = judgment;
    expect(JudgmentDefinitionSchema.safeParse({ ...legacy, retry_policy: { max_attempts_per_adapter: 2 } }).success).toBe(false);
  });

  it('includes asynchronous adapter selection in the total deadline', async () => {
    const adapter = register('jev', async () => success('jev'));
    adapter.isAvailable = () => new Promise(() => {});
    const pending = JudgmentEngine.evaluate({ ...judgment, adapter_hint: undefined }, context);
    await vi.advanceTimersByTimeAsync(100);
    const result = await pending;
    expect(result).toMatchObject({ band: 'unevaluable', latencyMs: 100, attemptCount: 0 });
    expect(adapter.evaluate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('includes configuration detection in the deadline after an adapter failure', async () => {
    const adapter = register('primary', async () => { throw new Error('offline'); });
    JudgmentEngine.registerAdapter({ ...adapter, isConfigured: () => new Promise(() => {}) });
    const pending = JudgmentEngine.evaluate(judgment, context);
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toMatchObject({ band: 'unevaluable', latencyMs: 100, attemptCount: 1 });
  });

  it('cancels at an adapter timeout and lets a distinct fallback decide inside the remaining budget', async () => {
    let signal: AbortSignal | undefined;
    register('primary', async (_req, ctx) => { signal = ctx.signal; return new Promise(() => {}); });
    register('backup', async (_req, ctx) => {
      expect(ctx.timeout_ms).toBe(30);
      await new Promise(resolve => setTimeout(resolve, 20));
      return success('backup');
    });
    const pending = JudgmentEngine.evaluate({ ...judgment, timeout_ms: 30 }, context);
    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;
    expect(signal?.aborted).toBe(true);
    expect(result).toMatchObject({ band: 'accept', latencyMs: 50, attemptCount: 2, fallbackTriggered: true });
    expect(result).toHaveProperty('attempts.0.cancellationCause', 'attempt_timeout');
    expect(result).toHaveProperty('attempts.1', expect.objectContaining({ adapter: 'backup', outcome: 'success', elapsedMs: 20 }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares the deadline with successful selection rather than restarting the clock', async () => {
    const adapter = register('jev', async (_req, ctx) => { expect(ctx.timeout_ms).toBe(60); return new Promise(() => {}); });
    adapter.isAvailable = async () => { await new Promise(resolve => setTimeout(resolve, 40)); return true; };
    const pending = JudgmentEngine.evaluate({ ...judgment, adapter_hint: undefined }, context);
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toMatchObject({ band: 'unevaluable', latencyMs: 100, attemptCount: 1 });
  });

  it('records an open fallback breaker without invoking that adapter', async () => {
    register('primary', async () => { throw new Error('offline'); });
    const backup = register('backup', async () => success('backup'));
    const breaker = JudgmentEngine.getBreaker('backup')!;
    breaker.recordFailure(); breaker.recordFailure();
    const result = await JudgmentEngine.evaluate(judgment, context);
    expect(result).toMatchObject({ band: 'unevaluable', attemptCount: 1 });
    expect(result).toHaveProperty('attempts.1', expect.objectContaining({ adapter: 'backup', invoked: false, outcome: 'skipped', reason: 'circuit_open', breakerBefore: 'OPEN', breakerAfter: 'OPEN' }));
    expect(backup.evaluate).not.toHaveBeenCalled();
  });

  it('isolates concurrent evaluations and ignores an adapter result arriving after cancellation', async () => {
    let lateResolve: (value: ReturnType<typeof success>) => void = () => {};
    const signals: AbortSignal[] = [];
    register('primary', async (_req, ctx) => {
      signals.push(ctx.signal);
      if (ctx.event.id === 'slow') return new Promise(resolve => { lateResolve = resolve; });
      await new Promise(resolve => setTimeout(resolve, 10));
      return success('primary');
    });
    const slow = JudgmentEngine.evaluate({ ...judgment, total_timeout_ms: 25 }, { ...context, event: { ...context.event, id: 'slow' } });
    const fast = JudgmentEngine.evaluate(judgment, context);
    await vi.advanceTimersByTimeAsync(25);
    const refusal = await slow;
    expect(await fast).toMatchObject({ band: 'accept', latencyMs: 10, attemptCount: 1 });
    expect(refusal).toMatchObject({ band: 'unevaluable', latencyMs: 25, attemptCount: 1 });
    expect(signals.map(signal => signal.aborted)).toEqual([true, false]);
    const recorded = JSON.stringify(refusal);
    lateResolve(success('primary'));
    await vi.advanceTimersByTimeAsync(200);
    expect(JSON.stringify(refusal)).toBe(recorded);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps authoring failures out of the circuit breaker across repeated evaluations', async () => {
    register('primary', async () => { throw new JudgmentAuthoringError('invalid rubric'); });
    for (let i = 0; i < 3; i++) {
      const result = await JudgmentEngine.evaluate(judgment, context);
      expect(result).toMatchObject({ band: 'unevaluable', attemptCount: 1 });
      expect(JudgmentEngine.getBreaker('primary')?.getState()).toBe('CLOSED');
    }
  });

  it.each([401, 403])('keeps Jev credential guidance after a %s opens its circuit', async status => {
    const primary = register('jev', async () => { throw Object.assign(new Error('credential rejected'), { status }); });
    for (let i = 0; i < 3; i++) {
      const result = await JudgmentEngine.evaluate({ ...judgment, adapter_hint: 'jev', fallback_adapter: 'script' }, context);
      expect(result).toMatchObject({ band: 'unevaluable', passed: false });
      expect(result.error).toMatch(/Stop and ask the user to fix or replace TYPESAFE_API_KEY; do not unset it/);
      expect(result.fallbackTarget).toBeUndefined();
    }
    expect(primary.evaluate).toHaveBeenCalledTimes(2);
    expect(JudgmentEngine.getBreaker('jev')?.getState()).toBe('OPEN');
  });

  it.each([
    [0.95, 'accept', undefined], [0.8, 'escalate', 'HUMAN'], [0.4, 'reject', 'REPAIR'],
  ])('retains probability bands with a bounded policy at probability %s', async (probability, band, target) => {
    register('primary', async () => ({ ...success('primary'), probability }));
    const result = await JudgmentEngine.evaluate({ ...judgment, min_probability: 0.9, escalate: { min_probability: 0.7, target: 'HUMAN' } }, context);
    expect(result.band).toBe(band);
    expect(result.fallbackTarget).toBe(target);
    expect(result.passed).toBe(band === 'accept');
  });

  it.each(['approve', 'reject'] as const)('retains validated human %s without adapter work', async humanDecision => {
    const adapter = register('primary', async () => success('primary'));
    const result = await JudgmentEngine.evaluate(judgment, { ...context, humanDecision });
    expect(result).toMatchObject({ decidedBy: 'human', band: humanDecision === 'approve' ? 'accept' : 'reject', attemptCount: 0 });
    expect(adapter.evaluate).not.toHaveBeenCalled();
  });

  it.each([false, true])('retains the self-report grant requirement with bounded policy (grant=%s)', async selfReportAllowed => {
    const result = await JudgmentEngine.evaluate({ ...judgment, adapter_hint: 'script' }, { ...context, selfReportAllowed });
    expect(result.band).toBe(selfReportAllowed ? 'accept' : 'unevaluable');
    expect(result.passed).toBe(selfReportAllowed);
  });

  it.each([
    ['authoring', new JudgmentAuthoringError('invalid rubric'), /misconfigured/],
    ['credentials', Object.assign(new Error('credential rejected'), { status: 403 }), /backup rejected its credentials/],
  ])('records a distinct fallback %s failure as unevaluable', async (kind, error, reason) => {
    register('primary', async () => { throw new Error('offline'); });
    register('backup', async () => { throw error; });
    const result = await JudgmentEngine.evaluate(judgment, context);
    expect(result).toMatchObject({ band: 'unevaluable', attemptCount: 2 });
    expect(result).toHaveProperty('attempts.1.outcome', kind);
    expect(result.error).toMatch(reason);
    expect(result.fallbackTarget).toBeUndefined();
  });

  it('preserves credential guidance while a distinct fallback circuit is open', async () => {
    register('primary', async () => { throw new Error('offline'); });
    const backup = register('backup', async () => { throw Object.assign(new Error('credential rejected'), { status: 401 }); });
    for (let i = 0; i < 4; i++) {
      const result = await JudgmentEngine.evaluate(judgment, context);
      expect(result.band).toBe('unevaluable');
      expect(result.error).toMatch(/backup rejected its credentials/);
    }
    expect(backup.evaluate).toHaveBeenCalledTimes(2);
  });
});
