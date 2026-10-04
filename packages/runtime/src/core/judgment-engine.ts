import vm from 'node:vm';
import {
  JudgmentType,
  JudgmentDefinition,
  JudgmentRequest,
  JudgmentResult,
  JudgmentAdapter,
} from './types.js';
import { GuardEvaluationContext } from './guard-evaluator.js';
import { decideJudgment, resolveJudgmentThreshold } from './judgment-thresholds.js';

interface TypeSafeClientLike {
  systemOne(
    request: {
      state: Record<string, unknown>;
      questions: Record<string, unknown>;
    },
    options?: {
      signal?: AbortSignal;
      timeout?: number;
      retry?: { maxRetries: number };
    }
  ): Promise<{
    model?: string;
    answers?: Record<string, unknown>;
    usage?: unknown;
  }>;
}

interface TypeSafeSdkModule {
  TypeSafeClient: new () => TypeSafeClientLike;
  noul(instructions: string): unknown;
  choice(instructions: string, criteria: Record<string, null>): unknown;
  score(instructions: string, criteria: string[]): unknown;
}

async function loadTypeSafeSdk(): Promise<TypeSafeSdkModule | null> {
  try {
    return (await import('@typesafe-ai/sdk')) as unknown as TypeSafeSdkModule;
  } catch {
    return null;
  }
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

/**
 * Circuit Breaker for external decision adapters
 * Prevents cascading timeouts and system hangs during third-party outages
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(private options: CircuitBreakerOptions = {}) {}

  public canExecute(): boolean {
    const threshold = this.options.failureThreshold ?? 2;
    const resetTimeout = this.options.resetTimeoutMs ?? 60_000;

    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > resetTimeout) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true;
  }

  public recordSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  public recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= (this.options.failureThreshold ?? 2)) {
      this.state = 'OPEN';
    }
  }

  public getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  public reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }
}

/**
 * A judgment configuration problem an adapter detects before asking its model, such as an
 * evaluation rubric with fewer than two criteria. It is not an outage, so it never counts against
 * the circuit breaker, and retrying cannot fix it (spec 0019, #47).
 */
export class JudgmentAuthoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JudgmentAuthoringError';
  }
}

function isAuthoringError(err: unknown): boolean {
  return err instanceof JudgmentAuthoringError || (err as { name?: string } | null)?.name === 'JudgmentAuthoringError';
}

/** Why no adapter could decide a judgment; selects the agent-facing reason (ADR 0011). */
type UnevaluableKind = 'outage' | 'credentials' | 'authoring';

/** Names a lone word may use and still count as an expression rather than natural language. */
const EXPRESSION_WORDS = new Set(['payload', 'context', 'event', 'state', 'req', 'true', 'false', 'null', 'undefined']);

/**
 * True when a judgment criterion compiles as a JavaScript expression and is not a lone word such
 * as `approved`. Compiles only; never runs it. The script adapter evaluates executable criteria
 * exactly and has no way to judge any other text.
 */
export function isExecutableCriterion(criterion: string): boolean {
  const trimmed = criterion.trim();
  if (/^[\p{L}_$][\p{L}\p{N}\p{M}_$\u200c\u200d]*$/u.test(trimmed) && !EXPRESSION_WORDS.has(trimmed)) return false;
  try {
    new vm.Script(`"use strict"; (${criterion});`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Built-in baseline ScriptJudgmentAdapter (Zero dependencies, deterministic)
 * Always available, runs in sandboxed node:vm
 */
export class ScriptJudgmentAdapter implements JudgmentAdapter {
  public readonly id = 'script';

  public supports(_type: JudgmentType): boolean {
    return true;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async evaluate(
    req: JudgmentRequest,
    evalContext: GuardEvaluationContext
  ): Promise<JudgmentResult> {
    const startTime = performance.now();
    const sandbox = {
      event: JSON.parse(JSON.stringify(evalContext.event || {})),
      context: JSON.parse(JSON.stringify(evalContext.context || {})),
      state: String(evalContext.currentState),
      payload: JSON.parse(JSON.stringify(evalContext.event?.payload || {})),
      req,
      Boolean,
      Number,
      String,
      Array,
      Object,
      Math,
      JSON,
    };

    const vmContext = vm.createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false },
    });

    // An executable criterion is always decided by running it, and fails closed if it throws.
    // Only natural language is decided from the agent's own payload, marked self-reported (ADR 0011).
    const executable = isExecutableCriterion(req.criterion);
    const payload = evalContext.event?.payload;
    const run = (wrapper: 'Boolean' | 'String' | 'Number'): unknown =>
      new vm.Script(`"use strict"; ${wrapper}(${req.criterion})`).runInContext(vmContext, { timeout: 100 });
    const finish = (result: Omit<JudgmentResult, 'adapterName' | 'latencyMs'>): JudgmentResult => ({
      ...result,
      adapterName: this.id,
      latencyMs: Number((performance.now() - startTime).toFixed(2)),
    });
    const selfReported = executable ? {} : { selfReported: true };

    try {
      if (req.type === 'predicate') {
        const isTrue = executable
          ? Boolean(run('Boolean'))
          : typeof payload?.exit_code === 'number' ? payload.exit_code === 0 : payload?.success === true;
        return finish({ verdict: isTrue, confidence: 1.0, probability: isTrue ? 1 : 0, passed: isTrue, ...selfReported });
      }

      if (req.type === 'categorical') {
        const choice = executable ? String(run('String')) : String(payload?.choice || req.options?.[0] || '');
        const passed = req.options ? req.options.includes(choice) : true;
        return finish({ verdict: choice, confidence: 1.0, probability: 1, passed, ...selfReported });
      }

      // Evaluation type (numerical score)
      const score = executable ? Number(run('Number')) || 0 : Number(payload?.score) || 0;
      return finish({ verdict: score, confidence: 1.0, passed: score > 0, ...selfReported });
    } catch (err: any) {
      return finish({ verdict: false, confidence: 0.0, passed: false, error: `Criterion threw: ${err.message}` });
    }
  }
}

/**
 * JevJudgmentAdapter backed by the TypeSafe SDK.
 *
 * The SDK is loaded only when a TypeSafe API key is configured. Script fallback
 * remains available for offline or explicitly script-only environments.
 */
export class JevJudgmentAdapter implements JudgmentAdapter {
  public readonly id = 'jev';

  public supports(type: JudgmentType): boolean {
    return type === 'predicate' || type === 'categorical' || type === 'evaluation';
  }

  public async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    return (await loadTypeSafeSdk()) !== null;
  }

  /** A set key means the user chose Jev, so a missing or broken SDK is an outage, not "no Jev". */
  public isConfigured(): boolean {
    return Boolean(process.env.TYPESAFE_API_KEY?.trim());
  }

  public async evaluate(
    req: JudgmentRequest,
    evalContext: GuardEvaluationContext
  ): Promise<JudgmentResult> {
    const startTime = performance.now();
    const timeoutMs = Math.max(1, (evalContext as GuardEvaluationContext & { timeout_ms?: number }).timeout_ms || 3000);
    const sdk = await loadTypeSafeSdk();
    if (!sdk) {
      throw new Error('TypeSafe SDK is unavailable; install @typesafe-ai/sdk and configure TYPESAFE_API_KEY');
    }

    const state = {
      event: evalContext.event?.payload || {},
      context: evalContext.context || {},
      currentState: evalContext.currentState,
    };

    let question: unknown;
    if (req.type === 'predicate') {
      question = sdk.noul(req.criterion);
    } else if (req.type === 'categorical') {
      const criteria = Object.fromEntries((req.options || []).map((option) => [option, null]));
      question = sdk.choice(req.criterion, criteria);
    } else {
      question = sdk.score(req.criterion, normalizeScoreRubric(req.rubric));
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Jev adapter execution timed out after ${timeoutMs}ms`));
        controller.abort();
      }, timeoutMs);
    });

    try {
      const response = await Promise.race([
        new sdk.TypeSafeClient().systemOne(
          { state, questions: { judgment: question } },
          { signal: controller.signal, timeout: timeoutMs, retry: { maxRetries: 0 } }
        ),
        timeout,
      ]);

      const answer = response.answers?.judgment;
      if (!answer || typeof answer !== 'object') {
        throw new Error('TypeSafe SDK returned no judgment answer');
      }

      const latencyMs = Number((performance.now() - startTime).toFixed(2));
      const raw = {
        model: response.model,
        answers: response.answers,
        usage: response.usage,
      };

      if (req.type === 'predicate') {
        const probability = (answer as { type?: string; noul?: number }).noul;
        if (typeof probability !== 'number' || !Number.isFinite(probability)) {
          throw new Error('TypeSafe SDK returned an invalid predicate answer');
        }
        const boundedProbability = Math.min(1, Math.max(0, probability));
        const verdict = boundedProbability >= 0.5;
        return {
          verdict,
          confidence: Math.abs(boundedProbability - 0.5) * 2,
          probability: boundedProbability,
          passed: verdict,
          adapterName: this.id,
          latencyMs,
          raw,
        };
      }

      if (req.type === 'categorical') {
        const choice = (answer as { choice?: unknown; confidence?: unknown }).choice;
        if (typeof choice !== 'string') {
          throw new Error('TypeSafe SDK returned an invalid categorical answer');
        }
        const confidence = typeof (answer as { confidence?: unknown }).confidence === 'number'
          ? (answer as { confidence: number }).confidence
          : 0;
        return {
          verdict: choice,
          confidence,
          probability: pickedProbability(answer, choice),
          passed: req.options ? req.options.includes(choice) : Boolean(choice),
          adapterName: this.id,
          latencyMs,
          raw,
        };
      }

      const score = (answer as { score?: unknown; confidence?: unknown }).score;
      if (typeof score !== 'number' || !Number.isFinite(score)) {
        throw new Error('TypeSafe SDK returned an invalid score answer');
      }
      const confidence = typeof (answer as { confidence?: unknown }).confidence === 'number'
        ? (answer as { confidence: number }).confidence
        : 0;
      return {
        verdict: score,
        confidence,
        passed: score > 0,
        adapterName: this.id,
        latencyMs,
        raw,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function pickedProbability(answer: object, choice: string): number | undefined {
  const probabilities = (answer as { probabilities?: unknown }).probabilities;
  if (!probabilities || typeof probabilities !== 'object') return undefined;
  const probability = (probabilities as Record<string, unknown>)[choice];
  if (typeof probability !== 'number' || !Number.isFinite(probability)) return undefined;
  return Math.min(1, Math.max(0, probability));
}

function normalizeScoreRubric(rubric: string | string[] | undefined): string[] {
  if (Array.isArray(rubric)) {
    if (rubric.length >= 2) return rubric;
    throw new JudgmentAuthoringError('Jev evaluation requires at least two ordered rubric criteria');
  }

  if (!rubric?.trim()) {
    throw new JudgmentAuthoringError('Jev evaluation requires ordered rubric criteria');
  }

  const trimmed = rubric.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length >= 2 && parsed.every((item) => typeof item === 'string')) {
        return parsed;
      }
    } catch {
      // Fall through to delimiter parsing for a useful validation error.
    }
  }

  const delimiter = trimmed.includes('|') ? '|' : trimmed.includes('\n') ? '\n' : ',';
  const criteria = trimmed.split(delimiter).map((item) => item.trim()).filter(Boolean);
  if (criteria.length < 2) {
    throw new JudgmentAuthoringError('Jev evaluation requires at least two ordered rubric criteria separated by |');
  }
  return criteria;
}

/**
 * Judgment Engine: Decoupled Ports-and-Adapters registry with Circuit Breaking & Fallback Cascade
 */
export class JudgmentEngine {
  private static adapters: Map<string, JudgmentAdapter> = new Map();
  private static breakers: Map<string, CircuitBreaker> = new Map();
  /**
   * Last credential rejection (HTTP 401 or 403) per adapter, kept beside its circuit breaker so a
   * refusal while the circuit is open still says the credentials were rejected.
   */
  private static rejectedCredentials: Map<string, string> = new Map();

  static {
    // Register standard adapters
    this.registerAdapter(new ScriptJudgmentAdapter());
    this.registerAdapter(new JevJudgmentAdapter());
  }

  public static registerAdapter(adapter: JudgmentAdapter, breakerOptions?: CircuitBreakerOptions): void {
    this.adapters.set(adapter.id, adapter);
    this.rejectedCredentials.delete(adapter.id);
    if (!this.breakers.has(adapter.id)) {
      this.breakers.set(adapter.id, new CircuitBreaker(breakerOptions));
    }
  }

  public static getAdapter(id: string): JudgmentAdapter | undefined {
    return this.adapters.get(id);
  }

  public static getBreaker(id: string): CircuitBreaker | undefined {
    return this.breakers.get(id);
  }

  public static reset(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    this.rejectedCredentials.clear();
    this.adapters.clear();
    this.registerAdapter(new ScriptJudgmentAdapter());
    this.registerAdapter(new JevJudgmentAdapter());
  }

  /**
   * Evaluate a transition judgment using the snap-on adapter cascade
   */
  public static async evaluate(
    judgment: JudgmentDefinition,
    evalContext: GuardEvaluationContext
  ): Promise<JudgmentResult & { fallbackTriggered?: boolean; fallbackTarget?: string }> {
    const req: JudgmentRequest = {
      type: judgment.type,
      criterion: judgment.criterion,
      contextSnapshot: evalContext.context || {},
      options: judgment.options,
      rubric: judgment.rubric,
    };

    // Determine target primary adapter
    let primaryAdapterId = judgment.adapter_hint;
    let adapterSelectionReason = judgment.adapter_hint
      ? `adapter_hint:${judgment.adapter_hint}`
      : 'script_default';
    if (!primaryAdapterId) {
      // Default preference: if jev is available & not open, use jev; else script
      const jevAdapter = this.adapters.get('jev');
      const jevBreaker = this.breakers.get('jev');
      if (!jevAdapter) {
        adapterSelectionReason = 'jev_not_registered';
        primaryAdapterId = 'script';
      } else if (!jevBreaker?.canExecute()) {
        adapterSelectionReason = 'jev_circuit_open';
        primaryAdapterId = 'script';
      } else if (await jevAdapter.isAvailable()) {
        primaryAdapterId = 'jev';
        adapterSelectionReason = 'jev_available';
      } else {
        primaryAdapterId = 'script';
        adapterSelectionReason = 'jev_unavailable';
      }
    }

    const primaryAdapter = this.adapters.get(primaryAdapterId);
    const primaryBreaker = this.breakers.get(primaryAdapterId);

    let result: JudgmentResult | null = null;
    let primaryFailed = false;
    let credentialsRejected = false;
    let authoringError = false;
    let failureCause = adapterSelectionReason === 'jev_unavailable'
      ? 'the TypeSafe SDK is missing or failed to load'
      : 'circuit breaker open';

    // 1. Try Primary Adapter if breaker allows
    if (primaryAdapter && primaryBreaker?.canExecute()) {
      try {
        result = await primaryAdapter.evaluate(req, {
          ...evalContext,
          timeout_ms: judgment.timeout_ms,
        } as any);
        primaryBreaker.recordSuccess();
        this.rejectedCredentials.delete(primaryAdapterId);
        result = {
          ...result,
          adapterSelectionReason,
        };
      } catch (err: any) {
        primaryFailed = true;
        failureCause = err?.message || String(err);
        if (isAuthoringError(err)) {
          // A misconfigured judgment is not an outage, so it does not count against the breaker.
          authoringError = true;
        } else {
          primaryBreaker.recordFailure();
          // 401 and 403 mean the adapter rejected its credentials, which retrying cannot fix.
          credentialsRejected = err?.status === 401 || err?.status === 403;
          if (credentialsRejected) this.rejectedCredentials.set(primaryAdapterId, failureCause);
          else this.rejectedCredentials.delete(primaryAdapterId);
        }
      }
    } else {
      primaryFailed = true;
    }

    const outageAdapterId = await this.detectOutage(primaryAdapterId, primaryFailed, adapterSelectionReason);
    // An open circuit throws nothing, so use the rejection that opened it.
    const earlierRejection = outageAdapterId ? this.rejectedCredentials.get(outageAdapterId) : undefined;
    if (!credentialsRejected && earlierRejection) {
      credentialsRejected = true;
      failureCause = `${earlierRejection}; circuit breaker open`;
    }
    const failureKind = (): UnevaluableKind => (authoringError ? 'authoring' : credentialsRejected ? 'credentials' : 'outage');

    // 2. Cascade to Fallback Adapter if primary failed or was blocked by breaker
    if (!result || primaryFailed) {
      const fallbackId = judgment.fallback_adapter || 'script';
      const fallbackAdapter = this.adapters.get(fallbackId) || this.adapters.get('script')!;
      try {
        const fallbackResult = await fallbackAdapter.evaluate(req, evalContext);
        if (outageAdapterId && fallbackResult.selfReported) {
          return this.unevaluable(judgment, outageAdapterId, failureCause, adapterSelectionReason, fallbackResult.adapterName, failureKind());
        }
        return this.applyDecision(
          judgment,
          { ...fallbackResult, adapterSelectionReason: `${adapterSelectionReason}:fallback` },
          true
        );
      } catch (err: any) {
        if (outageAdapterId) {
          const cause = `${failureCause}; fallback ${fallbackId} also failed: ${err.message}`;
          return this.unevaluable(judgment, outageAdapterId, cause, adapterSelectionReason, fallbackId, failureKind());
        }
        return {
          verdict: false,
          confidence: 0.0,
          passed: false,
          adapterName: fallbackId,
          latencyMs: 0,
          error: `Both primary (${primaryAdapterId}) and fallback (${fallbackId}) adapters failed: ${err.message}`,
          threshold: resolveJudgmentThreshold(judgment),
          band: 'reject',
          fallbackTriggered: true,
          fallbackTarget: judgment.fallback_target,
        };
      }
    }

    // An open Jev circuit or a broken Jev install made the script adapter primary; it cannot judge natural language either.
    if (outageAdapterId && result.selfReported) {
      return this.unevaluable(judgment, outageAdapterId, failureCause, adapterSelectionReason, result.adapterName, failureKind());
    }

    // 3. Apply the declared threshold and decision band
    return this.applyDecision(judgment, result, false);
  }

  /**
   * Returns the model adapter that is configured but cannot answer: the selected primary model
   * adapter failed or is blocked by its circuit, or Jev is configured but its open circuit or
   * broken install forced the script default. An adapter that is not configured is not in an outage.
   */
  private static async detectOutage(
    primaryAdapterId: string,
    primaryFailed: boolean,
    adapterSelectionReason: string
  ): Promise<string | undefined> {
    const candidateId = adapterSelectionReason === 'jev_circuit_open' || adapterSelectionReason === 'jev_unavailable'
      ? 'jev'
      : primaryFailed && primaryAdapterId !== 'script'
        ? primaryAdapterId
        : undefined;
    const candidate = candidateId ? this.adapters.get(candidateId) : undefined;
    if (!candidateId || !candidate) return undefined;
    try {
      const configured = candidate.isConfigured ? await candidate.isConfigured() : await candidate.isAvailable();
      return configured ? candidateId : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * A judgment no adapter could decide. The cascade ran (`fallbackTriggered`), but there is no
   * `fallbackTarget`, so the signal is refused and the run stays put instead of being sent to
   * repair work that was never judged (ADR 0011).
   */
  private static unevaluable(
    judgment: JudgmentDefinition,
    adapterId: string,
    cause: string,
    adapterSelectionReason: string,
    attemptedAdapterId: string,
    kind: UnevaluableKind = 'outage'
  ): JudgmentResult & { fallbackTriggered: boolean; fallbackTarget?: string } {
    const reasons: Record<UnevaluableKind, string> = {
      credentials: `Judgment could not be evaluated: ${adapterId === 'jev' ? 'jev rejected TYPESAFE_API_KEY' : `${adapterId} rejected its credentials`} (${cause}). This gate cannot be judged until the credentials work, and retrying with the same credentials will not help. ${adapterId === 'jev' ? 'Stop and ask the user to fix or replace TYPESAFE_API_KEY; do not unset it to get past this gate.' : `Stop and ask the user to fix the credentials for ${adapterId}.`}`,
      outage: `Judgment could not be evaluated: ${adapterId} is unavailable (${cause}). The criterion is not an executable expression, so the script fallback cannot judge it. Retry the signal when ${adapterId} is reachable, with a new idempotency key if you set one.`,
      authoring: `Judgment could not be evaluated: the judgment is misconfigured (${cause}). Retrying will not help; tell the user the skill needs fixing.`,
    };
    return {
      verdict: false,
      confidence: 0,
      passed: false,
      adapterName: attemptedAdapterId,
      adapterSelectionReason: `${adapterSelectionReason}:unevaluable`,
      latencyMs: 0,
      // This reason reaches the agent: it asks for the user and never suggests removing the key (ADR 0011).
      error: reasons[kind],
      threshold: resolveJudgmentThreshold(judgment),
      band: 'unevaluable',
      fallbackTriggered: true,
    };
  }

  private static applyDecision(
    judgment: JudgmentDefinition,
    result: JudgmentResult,
    fallbackTriggered: boolean
  ): JudgmentResult & { fallbackTriggered: boolean; fallbackTarget?: string } {
    const decision = decideJudgment(judgment, result);
    return {
      ...result,
      passed: decision.passed,
      threshold: decision.threshold,
      band: decision.band,
      error: result.error ?? decision.error,
      fallbackTriggered,
      fallbackTarget: decision.target,
    };
  }
}
