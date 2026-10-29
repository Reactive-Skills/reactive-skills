import type { GuardEvaluationContext } from './guard-evaluator.js';
import type { CircuitBreaker } from './judgment-engine.js';
import type { JudgmentAdapter, JudgmentAttempt, JudgmentDefinition, JudgmentRequest, JudgmentResult } from './types.js';

export class JudgmentTimeoutError extends Error {
  constructor(public readonly cause: 'total_deadline' | 'attempt_timeout', timeoutMs: number) {
    super(`Judgment ${cause === 'total_deadline' ? 'total deadline' : 'adapter execution'} timed out after ${timeoutMs}ms`);
    this.name = 'JudgmentTimeoutError';
  }
}

/**
 * Invocation-local timers and accounting; never shared across concurrent judgments.
 * # Performance & Risk Budget
 * - Tier: P0 timer/accounting primitives, P2 invocation orchestration; external waiting bounded separately
 * - Complexity: O(a), a <= 2 cascade slots; no history reads
 * - CRAP target: <= 10 for P0, <= 25 for P2 invocation orchestration
 */
export class JudgmentExecution {
  private readonly started = performance.now();
  public readonly attempts: JudgmentAttempt[] = [];
  public readonly bounded: boolean;

  constructor(private readonly judgment: JudgmentDefinition) {
    this.bounded = judgment.total_timeout_ms !== undefined;
  }

  /** Tier: P0 (< 5ms); Complexity: O(1); CRAP target <= 10 (CC <= 8, coverage >= 90%). */
  public remaining(): number | undefined {
    return this.judgment.total_timeout_ms === undefined ? undefined
      : Math.max(0, this.judgment.total_timeout_ms - (performance.now() - this.started));
  }

  /** Tier: P0 bookkeeping; Complexity: O(1); CRAP target <= 10 (CC <= 8, coverage >= 90%). */
  public async wait<T>(operation: (signal?: AbortSignal, timeoutMs?: number) => Promise<T>, limit?: number): Promise<T> {
    const remaining = this.remaining();
    if (remaining === undefined) return operation();
    const budget = Math.min(remaining, limit ?? Infinity);
    const cause = remaining <= (limit ?? Infinity) ? 'total_deadline' : 'attempt_timeout';
    if (budget <= 0) throw new JudgmentTimeoutError(cause, 0);
    const controller = new AbortController();
    const started = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new JudgmentTimeoutError(cause, budget);
        reject(error);
        controller.abort(error);
      }, budget);
    });
    try {
      const result = await Promise.race([operation(controller.signal, budget), timeout]);
      // A synchronous adapter can occupy the event loop past the timer's deadline.
      if (performance.now() - started >= budget) {
        const error = new JudgmentTimeoutError(cause, budget);
        controller.abort(error);
        throw error;
      }
      return result;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  /** Tier: P0 (< 5ms); Complexity: O(a), a <= 2; CRAP target <= 10 (CC <= 8, coverage >= 90%). */
  private skipReason(adapter: JudgmentAdapter, breaker?: CircuitBreaker): string | undefined {
    if (!this.bounded) return undefined;
    if (this.remaining() === 0) return 'total_deadline';
    const count = this.attempts.filter(attempt => attempt.invoked && attempt.adapter === adapter.id).length;
    if (count >= (this.judgment.retry_policy?.max_attempts_per_adapter ?? 1)) return 'adapter_attempt_limit';
    if (breaker && !breaker.canExecute()) return 'circuit_open';
    return undefined;
  }

  /** Tier: P2 orchestration (< 100ms local); Complexity: O(a), a <= 2; CRAP target <= 25 (CC <= 15, coverage >= 70%). */
  public async evaluate(
    adapter: JudgmentAdapter, req: JudgmentRequest, context: GuardEvaluationContext,
    stage: JudgmentAttempt['stage'], breaker?: CircuitBreaker
  ): Promise<JudgmentResult> {
    const reason = this.skipReason(adapter, breaker);
    const attempt: JudgmentAttempt = {
      adapter: adapter.id, stage, invoked: !reason, elapsedMs: 0,
      outcome: 'skipped', breakerBefore: breaker?.getState(),
      ...(reason ? { reason } : {}),
    };
    this.attempts.push(attempt);
    if (reason) {
      attempt.breakerAfter = breaker?.getState();
      if (reason === 'total_deadline') attempt.cancellationCause = 'total_deadline';
      throw new Error(`Adapter ${adapter.id} skipped: ${reason}`);
    }
    const started = performance.now();
    const manageBreaker = stage === 'primary' || this.bounded;
    try {
      const result = await this.wait((signal, budget) => {
        const timeout_ms = this.bounded ? budget : stage === 'primary' ? this.judgment.timeout_ms : context.timeout_ms;
        attempt.timeoutMs = timeout_ms;
        return adapter.evaluate(req, { ...context, ...(signal ? { signal } : {}), timeout_ms });
      }, this.judgment.timeout_ms);
      attempt.outcome = 'success';
      if (manageBreaker) breaker?.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(attempt, error);
      if (manageBreaker && attempt.outcome !== 'authoring') breaker?.recordFailure();
      throw error;
    } finally {
      attempt.elapsedMs = performance.now() - started;
      attempt.breakerAfter = breaker?.getState();
    }
  }

  /** Tier: P1 classification (< 25ms); Complexity: O(1); CRAP target <= 15 (CC <= 12, coverage >= 80%). */
  private recordFailure(attempt: JudgmentAttempt, error: unknown): void {
    const failure = error as { name?: string; status?: number; message?: string } | null;
    attempt.reason = failure?.message ?? String(error);
    if (error instanceof JudgmentTimeoutError) {
      attempt.outcome = 'timeout';
      attempt.cancellationCause = error.cause;
    } else if (failure?.name === 'JudgmentAuthoringError') attempt.outcome = 'authoring';
    else if (failure?.status === 401 || failure?.status === 403) attempt.outcome = 'credentials';
    else attempt.outcome = 'outage';
  }

  /** Tier: P0 (< 5ms); Complexity: O(a), a <= 2; CRAP target <= 10 (CC <= 8, coverage >= 90%). */
  public finish<T extends JudgmentResult>(result: T): T {
    return {
      ...result, latencyMs: performance.now() - this.started,
      attemptCount: this.attempts.filter(attempt => attempt.invoked).length,
      attempts: this.attempts,
    };
  }
}
