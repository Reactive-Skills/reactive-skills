import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import {
  JudgmentType,
  JudgmentDefinition,
  JudgmentRequest,
  JudgmentResult,
  JudgmentAdapter,
} from './types.js';
import { GuardEvaluationContext } from './guard-evaluator.js';

const execAsync = promisify(exec);

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

    try {
      if (req.type === 'predicate') {
        let isTrue = false;
        try {
          const script = new vm.Script(`"use strict"; Boolean(${req.criterion})`);
          isTrue = Boolean(script.runInContext(vmContext, { timeout: 100 }));
        } catch {
          // Heuristic fallback: check if payload has exit_code === 0 or status === 'ok'
          if (typeof evalContext.event?.payload?.exit_code === 'number') {
            isTrue = evalContext.event.payload.exit_code === 0;
          } else if (evalContext.event?.payload?.success === true) {
            isTrue = true;
          }
        }

        const latencyMs = Number((performance.now() - startTime).toFixed(2));
        return {
          verdict: isTrue,
          confidence: 1.0,
          passed: isTrue,
          adapterName: this.id,
          latencyMs,
        };
      }

      if (req.type === 'categorical') {
        let choice = req.options?.[0] || '';
        try {
          const script = new vm.Script(`"use strict"; String(${req.criterion})`);
          choice = String(script.runInContext(vmContext, { timeout: 100 }));
        } catch {
          choice = String(evalContext.event?.payload?.choice || req.options?.[0] || '');
        }

        const latencyMs = Number((performance.now() - startTime).toFixed(2));
        return {
          verdict: choice,
          confidence: 1.0,
          passed: req.options ? req.options.includes(choice) : true,
          adapterName: this.id,
          latencyMs,
        };
      }

      // Evaluation type (numerical score)
      let score = 0;
      try {
        const script = new vm.Script(`"use strict"; Number(${req.criterion})`);
        score = Number(script.runInContext(vmContext, { timeout: 100 })) || 0;
      } catch {
        score = Number(evalContext.event?.payload?.score) || 0;
      }

      const latencyMs = Number((performance.now() - startTime).toFixed(2));
      return {
        verdict: score,
        confidence: 1.0,
        passed: score > 0,
        adapterName: this.id,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Number((performance.now() - startTime).toFixed(2));
      return {
        verdict: false,
        confidence: 0.0,
        passed: false,
        adapterName: this.id,
        latencyMs,
        error: err.message,
      };
    }
  }
}

/**
 * Snap-On JevJudgmentAdapter
 * Connects to TypeSafe Jev via the local ambient environment (CLI or API)
 * Zero hard package dependency on @typesafe
 */
export class JevJudgmentAdapter implements JudgmentAdapter {
  public readonly id = 'jev';

  public supports(type: JudgmentType): boolean {
    return type === 'predicate' || type === 'categorical' || type === 'evaluation';
  }

  public async isAvailable(): Promise<boolean> {
    if (process.env.TYPESAFE_API_KEY) {
      return true;
    }

    // Check user profile config locations
    const candidates = [
      path.join(process.env.APPDATA || '', 'jev-axi', 'config.json'),
      path.join(os.homedir(), '.config', 'jev-axi', 'config.json'),
    ];

    for (const file of candidates) {
      try {
        if (file && fs.existsSync(file)) {
          const content = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (content.apiKey && content.apiKey !== 'missing') {
            return true;
          }
        }
      } catch {
        // ignore read error
      }
    }

    return false;
  }

  public async evaluate(
    req: JudgmentRequest,
    evalContext: GuardEvaluationContext
  ): Promise<JudgmentResult> {
    const startTime = performance.now();
    const timeoutMs = (evalContext as any)?.timeout_ms || 3000;

    const statePayload = {
      event: evalContext.event?.payload || {},
      context: evalContext.context || {},
      currentState: evalContext.currentState,
    };
    const stateJson = JSON.stringify(statePayload);
    const tempStateFile = path.join(
      os.tmpdir(),
      `jev-state-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.json`
    );
    fs.writeFileSync(tempStateFile, stateJson, 'utf8');

    return new Promise<JudgmentResult>((resolve, reject) => {
      const args = ['-y', 'jev-axi'];
      if (req.type === 'predicate') {
        args.push('check', `"${req.criterion.replace(/"/g, '\\"')}"`, '--state', `"${tempStateFile}"`, '--json');
      } else if (req.type === 'categorical') {
        args.push('pick', `"${req.criterion.replace(/"/g, '\\"')}"`, '--options', `"${(req.options || []).join(',')}"`, '--state', `"${tempStateFile}"`, '--json');
      } else {
        args.push('rate', `"${req.criterion.replace(/"/g, '\\"')}"`, '--state', `"${tempStateFile}"`, '--json');
      }

      const child = spawn('npx', args, {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
        try { fs.unlinkSync(tempStateFile); } catch {}
        reject(new Error(`Jev adapter execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        try { fs.unlinkSync(tempStateFile); } catch {}
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        try { fs.unlinkSync(tempStateFile); } catch {}
        if (timedOut) return;

        const latencyMs = Number((performance.now() - startTime).toFixed(2));
        if (code !== 0 && !stdout.trim()) {
          return reject(new Error(`Jev process exited with code ${code}: ${stderr}`));
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (req.type === 'predicate') {
            const isYes = parsed.verdict === 'yes' || parsed.verdict === true;
            const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : (parsed.p_yes ?? 0.5);
            return resolve({
              verdict: isYes,
              confidence,
              passed: isYes,
              adapterName: this.id,
              latencyMs,
              raw: parsed,
            });
          }

          if (req.type === 'categorical') {
            return resolve({
              verdict: parsed.verdict || parsed.choice || '',
              confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 1.0,
              passed: Boolean(parsed.verdict || parsed.choice),
              adapterName: this.id,
              latencyMs,
              raw: parsed,
            });
          }

          return resolve({
            verdict: parsed.verdict || parsed.score || 0,
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 1.0,
            passed: Boolean(parsed.verdict || parsed.score),
            adapterName: this.id,
            latencyMs,
            raw: parsed,
          });
        } catch (err: any) {
          reject(new Error(`Failed to parse Jev output (${err.message}): ${stdout || stderr}`));
        }
      });
    });
  }
}

/**
 * Judgment Engine: Decoupled Ports-and-Adapters registry with Circuit Breaking & Fallback Cascade
 */
export class JudgmentEngine {
  private static adapters: Map<string, JudgmentAdapter> = new Map();
  private static breakers: Map<string, CircuitBreaker> = new Map();

  static {
    // Register standard adapters
    this.registerAdapter(new ScriptJudgmentAdapter());
    this.registerAdapter(new JevJudgmentAdapter());
  }

  public static registerAdapter(adapter: JudgmentAdapter, breakerOptions?: CircuitBreakerOptions): void {
    this.adapters.set(adapter.id, adapter);
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
    const minConfidence = judgment.min_confidence ?? 0.75;
    const req: JudgmentRequest = {
      type: judgment.type,
      criterion: judgment.criterion,
      contextSnapshot: evalContext.context || {},
      options: judgment.options,
      rubric: judgment.rubric,
    };

    // Determine target primary adapter
    let primaryAdapterId = judgment.adapter_hint;
    if (!primaryAdapterId) {
      // Default preference: if jev is available & not open, use jev; else script
      const jevAdapter = this.adapters.get('jev');
      const jevBreaker = this.breakers.get('jev');
      if (jevAdapter && jevBreaker?.canExecute() && (await jevAdapter.isAvailable())) {
        primaryAdapterId = 'jev';
      } else {
        primaryAdapterId = 'script';
      }
    }

    const primaryAdapter = this.adapters.get(primaryAdapterId);
    const primaryBreaker = this.breakers.get(primaryAdapterId);

    let result: JudgmentResult | null = null;
    let primaryFailed = false;

    // 1. Try Primary Adapter if breaker allows
    if (primaryAdapter && primaryBreaker?.canExecute()) {
      try {
        result = await primaryAdapter.evaluate(req, {
          ...evalContext,
          timeout_ms: judgment.timeout_ms,
        } as any);
        primaryBreaker.recordSuccess();
      } catch (err: any) {
        primaryBreaker.recordFailure();
        primaryFailed = true;
      }
    } else {
      primaryFailed = true;
    }

    // 2. Cascade to Fallback Adapter if primary failed or was blocked by breaker
    if (!result || primaryFailed) {
      const fallbackId = judgment.fallback_adapter || 'script';
      const fallbackAdapter = this.adapters.get(fallbackId) || this.adapters.get('script')!;
      try {
        result = await fallbackAdapter.evaluate(req, evalContext);
        return {
          ...result,
          fallbackTriggered: true,
          passed: result.passed && result.confidence >= minConfidence,
          fallbackTarget: (result.passed && result.confidence >= minConfidence) ? undefined : judgment.fallback_target,
        };
      } catch (err: any) {
        return {
          verdict: false,
          confidence: 0.0,
          passed: false,
          adapterName: fallbackId,
          latencyMs: 0,
          error: `Both primary (${primaryAdapterId}) and fallback (${fallbackId}) adapters failed: ${err.message}`,
          fallbackTriggered: true,
          fallbackTarget: judgment.fallback_target,
        };
      }
    }

    // 3. Check Confidence Threshold
    const passedConfidence = result.confidence >= minConfidence;
    const finalPassed = Boolean(result.passed) && passedConfidence;

    return {
      ...result,
      passed: finalPassed,
      fallbackTarget: finalPassed ? undefined : judgment.fallback_target,
    };
  }
}
