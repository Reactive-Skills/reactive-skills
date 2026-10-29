import vm from 'node:vm';
import {
  JudgmentType,
  JudgmentDefinition,
  JudgmentRequest,
  JudgmentResult,
  JudgmentAdapter,
  JudgmentContextSent,
} from './types.js';
import { GuardEvaluationContext } from './guard-evaluator.js';
import { decideJudgment, resolveJudgmentThreshold } from './judgment-thresholds.js';
import { scopeJudgmentContext } from './judgment-context.js';
import { JudgmentExecution, JudgmentTimeoutError } from './judgment-execution.js';
import { prepareJudgmentInput, usesJudgmentInputOptions } from './judgment-input.js';

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

/** Tier: P0 (< 5ms); Complexity: O(1); CRAP target <= 10 (CC <= 8, coverage >= 90%). */
function isCredentialsError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}

/** Why no adapter could decide a judgment; selects the agent-facing reason (ADR 0011, ADR 0012). */
type UnevaluableKind = 'outage' | 'credentials' | 'authoring' | 'no_model';

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
  private client?: TypeSafeClientLike;
  private clientConfiguration?: string;

  /** Tier: P0 (< 5ms); Complexity: O(1); CRAP target <= 10 (CC <= 8, coverage >= 90%). */
  private getClient(sdk: TypeSafeSdkModule): TypeSafeClientLike {
    const configuration = JSON.stringify([
      process.env.TYPESAFE_API_KEY, process.env.TYPESAFE_BASE_URL,
      process.env.TYPESAFE_DEFAULT_MODEL, process.env.TYPESAFE_LOG_LEVEL,
    ]);
    if (!this.client || this.clientConfiguration !== configuration) {
      this.client = new sdk.TypeSafeClient();
      this.clientConfiguration = configuration;
    }
    return this.client;
  }

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

  /**
   * Tier: P2 adapter orchestration (< 100ms local); external SDK waiting has its own deadline.
   * Complexity: O(b + p*d), selected context bytes b and paths p/depth d; no ledger reads.
   * CRAP target <= 25 (CC <= 15 per normalization path, branch coverage >= 70%).
   */
  public async evaluate(
    req: JudgmentRequest,
    evalContext: GuardEvaluationContext
  ): Promise<JudgmentResult> {
    const startTime = performance.now();
    const sdk = await loadTypeSafeSdk();
    if (!sdk) {
      throw new Error('TypeSafe SDK is unavailable; install @typesafe-ai/sdk and configure TYPESAFE_API_KEY');
    }

    // A judgment that declares neither field sends the whole run context and the payload.
    const includePayload = req.includePayload !== false;
    const selection = req.contextPaths !== undefined
      ? req.inputPrepared
        ? { context: evalContext.context, sent: Object.keys(evalContext.context), missing: req.contextPaths.filter(path => !Object.hasOwn(evalContext.context, path)) }
        : scopeJudgmentContext(evalContext.context || {}, req.contextPaths)
      : undefined;
    const state: Record<string, unknown> = {
      ...(includePayload ? { event: evalContext.event?.payload || {} } : {}),
      context: selection ? selection.context : evalContext.context || {},
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

    const response = await this.requestWithDeadline(sdk, state, question, evalContext);

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
    const scope = this.contextMetadata(req, response.usage, selection);
    return { ...this.normalizeAnswer(req, answer), adapterName: this.id, latencyMs, raw, ...scope };
  }

  /** Tier: P1 (< 25ms); Complexity: O(p) selected paths; CRAP target <= 15 (CC <= 12, coverage >= 80%). */
  private contextMetadata(req: JudgmentRequest, usage: unknown, selection?: ReturnType<typeof scopeJudgmentContext>) {
    const inputTokens = (usage as { input_tokens?: unknown } | null | undefined)?.input_tokens;
    const contextSent: JudgmentContextSent | undefined = req.contextPaths !== undefined || req.includePayload !== undefined
      ? {
          ...(selection ? { paths: selection.sent } : {}),
          missing: selection ? selection.missing : [],
          includePayload: req.includePayload !== false,
          ...(typeof inputTokens === 'number' && Number.isFinite(inputTokens) ? { inputTokens } : {}),
        }
      : undefined;
    return contextSent ? { contextSent } : {};
  }

  /** Tier: P2 normalization (< 100ms); Complexity: O(options); CRAP target <= 25 (CC <= 15, coverage >= 70%). */
  private normalizeAnswer(req: JudgmentRequest, answer: object): Pick<JudgmentResult, 'verdict' | 'confidence' | 'probability' | 'passed'> {
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
      };
    }

    if (req.type === 'categorical') {
      const choice = (answer as { choice?: unknown; confidence?: unknown }).choice;
      if (typeof choice !== 'string') {
        throw new Error('TypeSafe SDK returned an invalid categorical answer');
      }
      const confidence = this.answerConfidence(answer);
      return {
        verdict: choice,
        confidence,
        probability: pickedProbability(answer, choice),
        passed: req.options ? req.options.includes(choice) : Boolean(choice),
      };
    }

    const score = (answer as { score?: unknown; confidence?: unknown }).score;
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      throw new Error('TypeSafe SDK returned an invalid score answer');
    }
    const confidence = this.answerConfidence(answer);
    return {
      verdict: score,
      confidence,
      passed: score > 0,
    };
  }

  /** Tier: P0 (< 5ms); Complexity: O(1); CRAP target <= 10 (CC <= 8, coverage >= 90%). */
  private answerConfidence(answer: object): number {
    const confidence = (answer as { confidence?: unknown }).confidence;
    return typeof confidence === 'number' ? confidence : 0;
  }

  /**
   * Tier: P0 bookkeeping (< 5ms); SDK waiting is limited to timeout_ms (default 3000ms).
   * Complexity: O(1) timer/listener overhead; CRAP target <= 15 (CC <= 12, coverage >= 80%).
   */
  private async requestWithDeadline(
    sdk: TypeSafeSdkModule, state: Record<string, unknown>, question: unknown,
    evalContext: GuardEvaluationContext
  ) {
    evalContext.signal?.throwIfAborted();
    const timeoutMs = Math.max(1, evalContext.timeout_ms || 3000);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      cancel = () => {
        const error = evalContext.signal?.reason ?? new Error('Judgment cancelled');
        reject(error);
        controller.abort(error);
      };
      evalContext.signal?.addEventListener('abort', cancel, { once: true });
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new JudgmentTimeoutError('attempt_timeout', timeoutMs);
        reject(error);
        controller.abort(error);
      }, timeoutMs);
    });
    try {
      return await Promise.race([
        this.getClient(sdk).systemOne(
          { state, questions: { judgment: question } },
          { signal: controller.signal, timeout: timeoutMs, retry: { maxRetries: 0 } }
        ),
        timeout, cancelled,
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      evalContext.signal?.removeEventListener('abort', cancel);
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
   * Evaluate a transition judgment using the snap-on adapter cascade.
   * Tier: P0 bookkeeping (< 5ms), external waiting uses declared deadlines.
   * Complexity: O(a + p²*d*i + b + e), a <= 2 adapter slots, paths/depth/max array index, selected bytes and non-empty checked string bytes/object keys.
   * CRAP target <= 15 (CC <= 12, branch coverage >= 80%).
   */
  public static async evaluate(
    judgment: JudgmentDefinition,
    evalContext: GuardEvaluationContext
  ): Promise<JudgmentResult & { fallbackTriggered?: boolean; fallbackTarget?: string }> {
    const execution = new JudgmentExecution(judgment);
    const prepared = usesJudgmentInputOptions(judgment) ? prepareJudgmentInput(judgment, evalContext) : undefined;
    const finish = (result: JudgmentResult & { fallbackTriggered?: boolean; fallbackTarget?: string }) => execution.finish({
      ...result, ...(prepared ? { inputInspection: prepared.inspection } : {}),
    });
    if (prepared?.inspection.errors.length) {
      return finish({ verdict: false, passed: false, confidence: 0, adapterName: 'preflight', latencyMs: 0,
        band: 'reject', judgmentSkipped: true, error: prepared.inspection.errors.join('; ') });
    }
    const adapterContext = prepared?.state ? {
      ...evalContext, context: prepared.state.context,
      event: { ...evalContext.event, payload: prepared.state.event ?? {} },
    } : evalContext;
    try {
      if (evalContext.humanDecision) return finish(this.humanResult(judgment, evalContext.humanDecision));
      return finish(await this.evaluateCascade(judgment, adapterContext, execution));
    } catch (error) {
      if (!execution.bounded && !prepared) throw error;
      const adapterId = execution.attempts.at(-1)?.adapter ?? judgment.adapter_hint ?? 'jev';
      const cause = error instanceof Error ? error.message : String(error);
      if (!execution.bounded) {
        return finish({ verdict: false, passed: false, confidence: 0, adapterName: adapterId, latencyMs: 0,
          band: 'reject', error: `Guard evaluation failed: ${cause}` });
      }
      return finish(this.unevaluable(judgment, adapterId, cause, 'bounded_cascade', adapterId));
    }
  }

  /**
   * Tier: P2 cascade orchestration (< 100ms local), external waiting bounded separately.
   * Complexity: O(a + b), a <= 2 adapter slots and b request bytes; no history scans.
   * CRAP target <= 25 (CC <= 15, branch coverage >= 70%).
   */
  private static async evaluateCascade(
    judgment: JudgmentDefinition, evalContext: GuardEvaluationContext, execution: JudgmentExecution
  ): Promise<JudgmentResult & { fallbackTriggered?: boolean; fallbackTarget?: string }> {
    const req: JudgmentRequest = {
      type: judgment.type,
      criterion: judgment.criterion,
      contextSnapshot: evalContext.context || {},
      options: judgment.options,
      rubric: judgment.rubric,
      ...(usesJudgmentInputOptions(judgment) ? { inputPrepared: true } : {}),
      ...(judgment.context_paths !== undefined ? { contextPaths: judgment.context_paths } : {}),
      ...(judgment.include_payload !== undefined ? { includePayload: judgment.include_payload } : {}),
    };

    const { primaryAdapterId, adapterSelectionReason } = await this.selectAdapter(judgment, execution);
    const { result, primaryFailed, authoringError, ...failure } = await this.evaluatePrimary(
      primaryAdapterId, adapterSelectionReason, req, evalContext, execution
    );
    const { credentialsRejected, failureCause } = failure;

    if (execution.bounded && (authoringError || credentialsRejected)) {
      return this.unevaluable(judgment, primaryAdapterId, failureCause, adapterSelectionReason, primaryAdapterId,
        authoringError ? 'authoring' : 'credentials');
    }
    const outageAdapterId = await this.detectOutage(primaryAdapterId, primaryFailed, adapterSelectionReason, execution);
    const { kind, cause } = this.failureReason({ credentialsRejected, authoringError, failureCause }, outageAdapterId);
    // Without a configured model, only an operator grant lets the agent's own payload decide (ADR 0012).
    const needsGrant = (r: JudgmentResult) => Boolean(r.selfReported) && !evalContext.selfReportAllowed;

    if (!result || primaryFailed) {
      return this.evaluateFallback(judgment, req, evalContext, execution, primaryAdapterId,
        adapterSelectionReason, outageAdapterId, cause, kind);
    }

    // An open Jev circuit or a broken Jev install made the script adapter primary; it cannot judge natural language either.
    if (outageAdapterId && result.selfReported) {
      return this.unevaluable(judgment, outageAdapterId, cause, adapterSelectionReason, result.adapterName, kind);
    }
    if (needsGrant(result)) {
      return this.unevaluable(judgment, primaryAdapterId, cause, adapterSelectionReason, result.adapterName, 'no_model');
    }

    // 3. Apply the declared threshold and decision band
    return this.applyDecision(judgment, result, false);
  }

  /** Tier: P1 (< 25ms); Complexity: O(cause bytes); CRAP target <= 15 (CC <= 12, coverage >= 80%). */
  private static failureReason(
    failure: { credentialsRejected: boolean; authoringError: boolean; failureCause: string }, outageAdapterId?: string
  ): { kind: UnevaluableKind; cause: string } {
    let { credentialsRejected, failureCause } = failure;
    const { authoringError } = failure;
    const earlierRejection = outageAdapterId ? this.rejectedCredentials.get(outageAdapterId) : undefined;
    // An authoring error keeps its own cause even after an earlier credentials rejection.
    if (!credentialsRejected && !authoringError && earlierRejection) {
      credentialsRejected = true;
      failureCause = `${earlierRejection}; circuit breaker open`;
    }
    return { kind: authoringError ? 'authoring' : credentialsRejected ? 'credentials' : 'outage', cause: failureCause };
  }

  /** Tier: P0 (< 5ms); Complexity: O(1); CRAP target <= 10 (CC <= 8, coverage >= 90%). */
  private static humanResult(judgment: JudgmentDefinition, decision: 'approve' | 'reject'): JudgmentResult & { fallbackTriggered: boolean; fallbackTarget?: string } {
    const approved = decision === 'approve';
    return {
      verdict: approved,
      confidence: 1,
      probability: approved ? 1 : 0,
      passed: approved,
      adapterName: 'human',
      adapterSelectionReason: 'human_approval',
      latencyMs: 0,
      decidedBy: 'human',
      threshold: resolveJudgmentThreshold(judgment),
      band: approved ? 'accept' : 'reject',
      fallbackTriggered: false,
      ...(approved ? {} : { error: 'A person rejected this gate in an interactive terminal.', fallbackTarget: judgment.fallback_target }),
    };
  }

  /** Tier: P0 bookkeeping (< 5ms); Complexity: O(1); CRAP target <= 10 (CC <= 8, coverage >= 90%). */
  private static async selectAdapter(judgment: JudgmentDefinition, execution: JudgmentExecution): Promise<{
    primaryAdapterId: string; adapterSelectionReason: string;
  }> {
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
      } else if (await execution.wait(() => jevAdapter.isAvailable())) {
        primaryAdapterId = 'jev';
        adapterSelectionReason = 'jev_available';
      } else {
        primaryAdapterId = 'script';
        adapterSelectionReason = 'jev_unavailable';
      }
    }

    return { primaryAdapterId, adapterSelectionReason };
  }

  /** Tier: P2 orchestration (< 100ms local); Complexity: O(b) request bytes; CRAP target <= 25 (CC <= 15, coverage >= 70%). */
  private static async evaluatePrimary(
    primaryAdapterId: string, adapterSelectionReason: string, req: JudgmentRequest,
    evalContext: GuardEvaluationContext, execution: JudgmentExecution
  ) {
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
        result = await execution.evaluate(primaryAdapter, req, evalContext, 'primary', primaryBreaker);
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
          // 401 and 403 mean the adapter rejected its credentials, which retrying cannot fix.
          credentialsRejected = isCredentialsError(err);
          if (credentialsRejected) this.rejectedCredentials.set(primaryAdapterId, failureCause);
          else this.rejectedCredentials.delete(primaryAdapterId);
        }
      }
    } else {
      primaryFailed = true;
      execution.attempts.push({
        adapter: primaryAdapterId, stage: 'primary', invoked: false, elapsedMs: 0,
        outcome: 'skipped', reason: primaryAdapter ? 'circuit_open' : 'unregistered',
        breakerBefore: primaryBreaker?.getState(), breakerAfter: primaryBreaker?.getState(),
      });
    }

    return { result, primaryFailed, credentialsRejected, authoringError, failureCause };
  }

  /** Tier: P2 orchestration (< 100ms local); Complexity: O(b) request bytes; CRAP target <= 25 (CC <= 15, coverage >= 70%). */
  private static async evaluateFallback(
    judgment: JudgmentDefinition, req: JudgmentRequest, evalContext: GuardEvaluationContext,
    execution: JudgmentExecution, primaryAdapterId: string, adapterSelectionReason: string,
    outageAdapterId: string | undefined, failureCause: string, failureKind: UnevaluableKind
  ): Promise<JudgmentResult & { fallbackTriggered?: boolean; fallbackTarget?: string }> {
    const fallbackId = judgment.fallback_adapter || 'script';
    const fallbackAdapter = this.adapters.get(fallbackId) || this.adapters.get('script')!;
    try {
      const fallbackResult = await execution.evaluate(fallbackAdapter, req, evalContext, 'fallback', this.breakers.get(fallbackAdapter.id));
      if (execution.bounded) this.rejectedCredentials.delete(fallbackAdapter.id);
      if (outageAdapterId && fallbackResult.selfReported) {
        return this.unevaluable(judgment, outageAdapterId, failureCause, adapterSelectionReason, fallbackResult.adapterName, failureKind);
      }
      if (fallbackResult.selfReported && !evalContext.selfReportAllowed) {
        return this.unevaluable(judgment, primaryAdapterId, failureCause, adapterSelectionReason, fallbackResult.adapterName, 'no_model');
      }
      return this.applyDecision(
        judgment,
        { ...fallbackResult, adapterSelectionReason: `${adapterSelectionReason}:fallback` },
        true
      );
    } catch (err: unknown) {
      return this.fallbackFailure(judgment, execution, fallbackAdapter, err,
        { primaryAdapterId, adapterSelectionReason, outageAdapterId, failureCause, failureKind, fallbackId });
    }
  }

  /** Tier: P0 (< 5ms); Complexity: O(1); CRAP target <= 10 (CC <= 8, coverage >= 90%). */
  private static fallbackFailureKind(error: unknown, execution: JudgmentExecution, adapterId: string, previousKind: UnevaluableKind): UnevaluableKind {
    if (isAuthoringError(error)) return 'authoring';
    if (isCredentialsError(error)) return 'credentials';
    if (execution.bounded && execution.attempts.at(-1)?.reason === 'circuit_open' && this.rejectedCredentials.has(adapterId)) return 'credentials';
    return previousKind;
  }

  /** Tier: P2 failure classification (< 100ms); Complexity: O(error bytes); CRAP target <= 25 (CC <= 15, coverage >= 70%). */
  private static fallbackFailure(
    judgment: JudgmentDefinition, execution: JudgmentExecution, fallbackAdapter: JudgmentAdapter, err: unknown,
    source: { primaryAdapterId: string; adapterSelectionReason: string; outageAdapterId?: string;
      failureCause: string; failureKind: UnevaluableKind; fallbackId: string }
  ): JudgmentResult & { fallbackTriggered: boolean; fallbackTarget?: string } {
    const { primaryAdapterId, adapterSelectionReason, outageAdapterId, failureCause, failureKind, fallbackId } = source;
    const message = err instanceof Error ? err.message : String(err);
    const cause = `${failureCause}; fallback ${fallbackId} also failed: ${message}`;
    if (!execution.bounded && outageAdapterId) {
      return this.unevaluable(judgment, outageAdapterId, cause, adapterSelectionReason, fallbackId, failureKind);
    }
    if (execution.bounded) {
      const kind = this.fallbackFailureKind(err, execution, fallbackAdapter.id, failureKind);
      if (kind === 'credentials') this.rejectedCredentials.set(fallbackAdapter.id, message);
      else if (kind !== 'authoring') this.rejectedCredentials.delete(fallbackAdapter.id);
      return this.unevaluable(judgment, kind === 'credentials' ? fallbackAdapter.id : outageAdapterId ?? primaryAdapterId,
        cause, adapterSelectionReason, fallbackAdapter.id, kind);
    }
    return {
      verdict: false,
      confidence: 0.0,
      passed: false,
      adapterName: fallbackId,
      latencyMs: 0,
      error: `Both primary (${primaryAdapterId}) and fallback (${fallbackId}) adapters failed: ${message}`,
      threshold: resolveJudgmentThreshold(judgment),
      band: 'reject',
      fallbackTriggered: true,
      fallbackTarget: judgment.fallback_target,
    };
  }

  /**
   * Returns the model adapter that is configured but cannot answer: the selected primary model
   * adapter failed or is blocked by its circuit, or Jev is configured but its open circuit or
   * broken install forced the script default. An adapter that is not configured is not in an outage.
   * Tier: P1 configuration bookkeeping (< 25ms local); external checks share the total deadline.
   * Complexity: O(1); CRAP target <= 15 (CC <= 12, branch coverage >= 80%).
   */
  private static async detectOutage(
    primaryAdapterId: string,
    primaryFailed: boolean,
    adapterSelectionReason: string,
    execution: JudgmentExecution
  ): Promise<string | undefined> {
    const candidateId = adapterSelectionReason === 'jev_circuit_open' || adapterSelectionReason === 'jev_unavailable'
      ? 'jev'
      : primaryFailed && primaryAdapterId !== 'script'
        ? primaryAdapterId
        : undefined;
    const candidate = candidateId ? this.adapters.get(candidateId) : undefined;
    if (!candidateId || !candidate) return undefined;
    try {
      const configured = await execution.wait(async () => candidate.isConfigured ? candidate.isConfigured() : candidate.isAvailable());
      return configured ? candidateId : undefined;
    } catch (error) {
      return error instanceof JudgmentTimeoutError && candidateId === primaryAdapterId ? candidateId : undefined;
    }
  }

  /**
   * A judgment no adapter could decide. The cascade ran (`fallbackTriggered`), but there is no
   * `fallbackTarget`, so the signal is refused and the run stays put instead of being sent to
   * repair work that was never judged (ADR 0011).
   * Tier: P0 (< 5ms); Complexity: O(cause bytes); CRAP target <= 10 (CC <= 8, coverage >= 90%).
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
      outage: `Judgment could not be evaluated: ${adapterId} is unavailable (${cause}). ${judgment.total_timeout_ms === undefined ? 'The criterion is not an executable expression, so the script fallback cannot judge it.' : 'No adapter completed an independent decision within the declared policy.'} Retry the signal when ${adapterId} is reachable, with a new idempotency key if you set one.`,
      authoring: `Judgment could not be evaluated: the judgment is misconfigured (${cause}). Retrying will not help; tell the user the skill needs fixing.`,
      no_model: 'Judgment could not be evaluated: no model is configured to judge this criterion, and self-reported decisions are not enabled for this workspace.',
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
      decidedBy: result.decidedBy ?? (result.adapterName === 'script' ? (result.selfReported ? 'self_reported' : 'expression') : 'model'),
      passed: decision.passed,
      threshold: decision.threshold,
      band: decision.band,
      error: result.error ?? decision.error,
      fallbackTriggered,
      fallbackTarget: decision.target,
    };
  }
}
