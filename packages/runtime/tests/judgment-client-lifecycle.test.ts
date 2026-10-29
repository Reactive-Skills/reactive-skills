import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JevJudgmentAdapter } from '../src/core/judgment-engine.js';

const sdk = vi.hoisted(() => ({ constructed: vi.fn(), systemOne: vi.fn() }));
vi.mock('@typesafe-ai/sdk', () => ({
  TypeSafeClient: class {
    constructor() { sdk.constructed(); }
    systemOne(...args: unknown[]) { return sdk.systemOne(...args); }
  },
  noul: (instructions: string) => ({ instructions }),
}));
const request = { type: 'predicate' as const, criterion: 'Does the evidence support approval?', contextSnapshot: {} };
const context = {
  event: { id: 'check', seq: 1, timestamp: '2026-01-01T00:00:00Z', type: 'CHECK', payload: {} },
  context: {}, currentState: 'REVIEW',
};

describe('Jev client lifetime and cascade cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
    vi.clearAllMocks();
    sdk.systemOne.mockResolvedValue({ answers: { judgment: { noul: 0.9 } } });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it('reuses a client on one adapter instance with the same configuration', async () => {
    const adapter = new JevJudgmentAdapter();
    await Promise.all([adapter.evaluate(request, context), adapter.evaluate(request, context)]);
    expect(sdk.constructed).toHaveBeenCalledOnce();
    expect(sdk.systemOne).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['TYPESAFE_API_KEY', 'TYPESAFE_BASE_URL', 'TYPESAFE_DEFAULT_MODEL', 'TYPESAFE_LOG_LEVEL'])(
    'replaces the cached client when %s changes', async variable => {
      const adapter = new JevJudgmentAdapter();
      await adapter.evaluate(request, context);
      vi.stubEnv(variable, 'test-changed');
      await adapter.evaluate(request, context);
      expect(sdk.constructed).toHaveBeenCalledTimes(2);
    }
  );

  it('cancels and clears the adapter timer when the enclosing cascade aborts', async () => {
    const started = new Promise<void>(resolve => {
      sdk.systemOne.mockImplementation(() => { resolve(); return new Promise(() => {}); });
    });
    const controller = new AbortController();
    const pending = new JevJudgmentAdapter().evaluate(request, { ...context, signal: controller.signal, timeout_ms: 500 });
    const assertion = expect(pending).rejects.toThrow('cascade cancelled');
    await started;
    controller.abort(new Error('cascade cancelled'));
    await assertion;
    expect(sdk.systemOne.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never starts SDK work with a signal already cancelled', async () => {
    const controller = new AbortController();
    controller.abort(new Error('already cancelled'));
    await expect(new JevJudgmentAdapter().evaluate(request, { ...context, signal: controller.signal })).rejects.toThrow('already cancelled');
    expect(sdk.systemOne).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
