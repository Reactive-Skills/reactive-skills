import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JudgmentEngine, JevJudgmentAdapter, isExecutableCriterion } from '../src/core/judgment-engine.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { JudgmentAdapter } from '../src/core/types.js';

// Issue #22 part 1 and ADR 0011: a model outage must not let a semantic gate pass on the
// agent's own success report, and decisions made without a model must be labeled.

const SEMANTIC = 'Does the delivered output satisfy the approved assertion?';

const skillYaml = `
schema_version: "2.0.0"
name: outage-skill
description: "Judgment outage fixture"
initial_state: REVIEW
states:
  REVIEW:
    description: "Review"
    transitions:
      SUBMIT:
        target: DONE
        judgment:
          type: predicate
          criterion: "${SEMANTIC}"
          min_confidence: 0.7
          adapter_hint: jev
          fallback_target: REPAIR
      SUBMIT_EXACT:
        target: DONE
        judgment:
          type: predicate
          criterion: "payload.exit_code === 0"
          adapter_hint: jev
          fallback_target: REPAIR
      SUBMIT_DEFAULT:
        target: DONE
        judgment:
          type: predicate
          criterion: "${SEMANTIC}"
          fallback_target: REPAIR
      SUBMIT_FRAGILE:
        target: DONE
        judgment:
          type: predicate
          criterion: "payload.findings.length === 4"
          fallback_target: REPAIR
      SUBMIT_FRAGILE_JEV:
        target: DONE
        judgment:
          type: predicate
          criterion: "payload.findings.length === 4"
          adapter_hint: jev
          fallback_target: REPAIR
      CHOOSE:
        target: DONE
        judgment:
          type: categorical
          criterion: "Which release channel fits this change?"
          options: [stable, beta]
          adapter_hint: jev
          fallback_target: REPAIR
      SCORE:
        target: DONE
        judgment:
          type: evaluation
          criterion: "How complete is the delivered plan?"
          adapter_hint: jev
          fallback_target: REPAIR
  DONE:
    description: "Done"
  REPAIR:
    description: "Repair"
`;

function throwingJev(): JudgmentAdapter & { calls: number } {
  const adapter = {
    id: 'jev',
    calls: 0,
    supports: () => true,
    isAvailable: async () => true,
    evaluate: async () => {
      adapter.calls += 1;
      throw new Error('Jev request timed out');
    },
  };
  return adapter;
}

describe('Judgment outage refusal and self-reported decisions (#22)', () => {
  let tmpDir: string;
  let originalKey: string | undefined;
  let engines: FSMEngine[] = [];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-judgment-outage-'));
    fs.writeFileSync(path.join(tmpDir, 'skill.yaml'), skillYaml);
    originalKey = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    JudgmentEngine.reset();
  });

  afterEach(() => {
    for (const engine of engines) engine.close();
    engines = [];
    JudgmentEngine.reset();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // MCP server engines keep SQLite handles open and expose no close; Windows locks the temp dir.
    }
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
  });

  const newEngine = (workspaceDir = tmpDir) => {
    const engine = new FSMEngine({ skillDir: tmpDir, workspaceDir });
    engines.push(engine);
    return engine;
  };

  describe('isExecutableCriterion', () => {
    it('accepts JavaScript expressions and rejects natural language without running them', () => {
      expect(isExecutableCriterion('payload.exit_code === 0')).toBe(true);
      expect(isExecutableCriterion('context.items.length > 0 && payload.ok')).toBe(true);
      expect(isExecutableCriterion(SEMANTIC)).toBe(false);
      expect(isExecutableCriterion('Build succeeded')).toBe(false);
      expect(isExecutableCriterion('(() => { throw new Error("ran") })()')).toBe(true);
    });
  });

  describe('outage while a model adapter is available but failing', () => {
    it('refuses a natural-language predicate that reports success, without a fallback transition', async () => {
      JudgmentEngine.registerAdapter(throwingJev());
      const engine = newEngine();

      const result = await engine.handleSignal('SUBMIT', { exit_code: 0, success: true });

      expect(result.transitioned).toBe(false);
      expect(engine.getCurrentState()).toBe('REVIEW');
      expect(engine.getEventStore().query({ type: 'GUARD_FALLBACK_TRIGGERED' })).toHaveLength(0);
      const guard = engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!;
      expect(guard.payload.passed).toBe(false);
      expect(guard.payload.judgment.band).toBe('unevaluable');
      expect(guard.payload.fallbackTarget).toBeUndefined();
      expect(guard.payload.error).toMatch(/jev is unavailable/i);
      expect(guard.payload.error).toMatch(/retry/i);
      expect(result.refusalReason).toMatch(/jev is unavailable/i);
    });

    it('refuses the same way when the Jev circuit breaker is open', async () => {
      process.env.TYPESAFE_API_KEY = 'test-key';
      JudgmentEngine.registerAdapter(throwingJev());
      const breaker = JudgmentEngine.getBreaker('jev')!;
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.canExecute()).toBe(false);
      const engine = newEngine();

      const result = await engine.handleSignal('SUBMIT_DEFAULT', { exit_code: 0 });

      expect(result.transitioned).toBe(false);
      expect(engine.getCurrentState()).toBe('REVIEW');
      expect(engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!.payload.judgment.band).toBe('unevaluable');
      expect(result.refusalReason).toMatch(/unavailable/i);
    });

    it('refuses categorical and evaluation judgments that would read payload.choice or payload.score', async () => {
      JudgmentEngine.registerAdapter(throwingJev());
      const engine = newEngine();

      const choice = await engine.handleSignal('CHOOSE', { choice: 'stable' });
      expect(choice.transitioned).toBe(false);
      expect(engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!.payload.judgment.band).toBe('unevaluable');

      const score = await engine.handleSignal('SCORE', { score: 9 });
      expect(score.transitioned).toBe(false);
      expect(engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!.payload.judgment.band).toBe('unevaluable');
      expect(engine.getCurrentState()).toBe('REVIEW');
    });

    it('still evaluates an executable criterion through the script fallback', async () => {
      JudgmentEngine.registerAdapter(throwingJev());
      const passing = newEngine();
      const pass = await passing.handleSignal('SUBMIT_EXACT', { exit_code: 0 });
      expect(pass.transitioned).toBe(true);
      expect(passing.getCurrentState()).toBe('DONE');
      expect(pass.judgmentBasis).toBeUndefined();

      JudgmentEngine.reset();
      JudgmentEngine.registerAdapter(throwingJev());
      const failing = newEngine(fs.mkdtempSync(path.join(tmpDir, 'second-')));
      await failing.handleSignal('SUBMIT_EXACT', { exit_code: 1 });
      expect(failing.getCurrentState()).toBe('REPAIR');
    });
  });

  describe('no model configured', () => {
    it('keeps the payload decision for a natural-language predicate and labels it self-reported', async () => {
      const engine = newEngine();

      const result = await engine.handleSignal('SUBMIT_DEFAULT', { exit_code: 0 });

      expect(result.transitioned).toBe(true);
      expect(engine.getCurrentState()).toBe('DONE');
      expect(result.judgmentBasis).toBe('self_reported');
      const guard = engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!;
      expect(guard.payload.judgment.selfReported).toBe(true);
      expect(guard.payload.judgment.adapterSelectionReason).toBe('jev_unavailable');
    });

    it('treats an unconfigured Jev named by adapter_hint as not configured, not as an outage', async () => {
      const engine = newEngine();
      const result = await engine.handleSignal('SUBMIT', { exit_code: 0 });
      expect(result.transitioned).toBe(true);
      expect(result.judgmentBasis).toBe('self_reported');
    });
  });

  describe('review amendments', () => {
    it('fails closed when an executable criterion throws, instead of trusting exit_code (no model)', async () => {
      const engine = newEngine();
      const result = await engine.handleSignal('SUBMIT_FRAGILE', { exit_code: 0 });

      expect(engine.getCurrentState()).toBe('REPAIR');
      expect(result.judgmentBasis).toBeUndefined();
      const guard = engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!;
      expect(guard.payload.passed).toBe(false);
      expect(guard.payload.judgment.selfReported).toBeUndefined();
      expect(guard.payload.error).toMatch(/criterion threw/i);
    });

    it('fails closed when an executable criterion throws during an outage, without calling it unevaluable', async () => {
      JudgmentEngine.registerAdapter(throwingJev());
      const engine = newEngine();
      await engine.handleSignal('SUBMIT_FRAGILE_JEV', { exit_code: 0 });

      expect(engine.getCurrentState()).toBe('REPAIR');
      const guard = engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!;
      expect(guard.payload.judgment.band).toBe('reject');
      expect(guard.payload.error).toMatch(/criterion threw/i);
    });

    it('treats a single bare word as natural language, but keeps literals and sandbox names executable', () => {
      expect(isExecutableCriterion('approved')).toBe(false);
      expect(isExecutableCriterion('  Ready ')).toBe(false);
      expect(isExecutableCriterion('true')).toBe(true);
      expect(isExecutableCriterion('payload')).toBe(true);
      expect(isExecutableCriterion('payload.approved')).toBe(true);
    });

    it('returns the original refusal reason when a refused signal is replayed with the same idempotency key', async () => {
      JudgmentEngine.registerAdapter(throwingJev());
      const engine = newEngine();

      const first = await engine.handleSignal('SUBMIT', { exit_code: 0 }, { idempotencyKey: 'submit-1' });
      const replay = await engine.handleSignal('SUBMIT', { exit_code: 0 }, { idempotencyKey: 'submit-1' });

      expect(first.refusalReason).toMatch(/new idempotency key/i);
      expect(replay.transitioned).toBe(false);
      expect(replay.refusalReason).toBe(first.refusalReason);
      expect(engine.getCurrentState()).toBe('REVIEW');
    });

    it('stays unevaluable when the declared fallback is another model that also fails', async () => {
      JudgmentEngine.registerAdapter(throwingJev());
      JudgmentEngine.registerAdapter({
        id: 'backup_model', supports: () => true, isAvailable: async () => true,
        evaluate: async () => { throw new Error('backup down'); },
      });
      const result = await JudgmentEngine.evaluate(
        { type: 'predicate', criterion: SEMANTIC, adapter_hint: 'jev', fallback_adapter: 'backup_model', fallback_target: 'REPAIR' },
        {
          event: { id: 'e', seq: 1, timestamp: new Date().toISOString(), type: 'X', payload: { exit_code: 0 } },
          context: {},
          currentState: 'REVIEW',
        }
      );
      expect(result.band).toBe('unevaluable');
      expect(result.fallbackTarget).toBeUndefined();
      expect(result.error).toMatch(/backup down/);
    });

    it('treats Jev as configured when its key is set even if the SDK cannot load, so the gate refuses', async () => {
      JudgmentEngine.registerAdapter({
        id: 'jev',
        supports: () => true,
        isConfigured: () => true,
        isAvailable: async () => false,
        evaluate: async () => { throw new Error('TypeSafe SDK is unavailable'); },
      });
      const engine = newEngine();

      const result = await engine.handleSignal('SUBMIT_DEFAULT', { exit_code: 0 });

      expect(result.transitioned).toBe(false);
      expect(engine.getCurrentState()).toBe('REVIEW');
      expect(engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!.payload.judgment.band).toBe('unevaluable');
      expect(result.refusalReason).toMatch(/jev is unavailable/i);
    });

    it('reports the built-in Jev adapter as configured exactly when TYPESAFE_API_KEY is set', () => {
      const jev = new JevJudgmentAdapter();
      expect(jev.isConfigured()).toBe(false);
      process.env.TYPESAFE_API_KEY = 'some-key';
      expect(jev.isConfigured()).toBe(true);
    });
  });

  describe('exact predicates stay independent of Jev (#15)', () => {
    it('selects the script adapter for adapter_hint: script even when Jev is available, and never calls Jev', async () => {
      const jevEvaluate = vi.fn(async () => ({
        verdict: false, confidence: 0.06, probability: 0.47, passed: false, adapterName: 'jev', latencyMs: 1,
      }));
      JudgmentEngine.registerAdapter({ id: 'jev', supports: () => true, isAvailable: async () => true, evaluate: jevEvaluate });
      const workspaceDir = fs.mkdtempSync(path.join(tmpDir, 'exact-'));
      fs.writeFileSync(path.join(workspaceDir, 'skill.yaml'), `
schema_version: "2.0.0"
name: exact-skill
description: "Exact predicate fixture"
initial_state: AUDIT
states:
  AUDIT:
    transitions:
      AUDIT_COMPLETED:
        target: DONE
        judgment:
          type: predicate
          criterion: "payload.findings.length === 4 && payload.findings.every(f => f.status && f.description)"
          min_confidence: 0.85
          adapter_hint: script
          fallback_adapter: script
          fallback_target: AUDIT
  DONE: {}
`);
      const engine = new FSMEngine({ skillDir: workspaceDir, workspaceDir });
      engines.push(engine);
      const findings = [1, 2, 3, 4].map((n) => ({ status: 'ok', description: `finding ${n}` }));

      const result = await engine.handleSignal('AUDIT_COMPLETED', { findings });

      expect(jevEvaluate).not.toHaveBeenCalled();
      expect(result.transitioned).toBe(true);
      expect(engine.getCurrentState()).toBe('DONE');
      const guard = engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!;
      expect(guard.payload.judgment.adapterName).toBe('script');
      expect(guard.payload.judgment.adapterSelectionReason).toBe('adapter_hint:script');
    });

    it('runs the declared fallback adapter when the hinted primary adapter throws', async () => {
      JudgmentEngine.registerAdapter({
        id: 'flaky_model', supports: () => true, isAvailable: async () => true,
        evaluate: async () => { throw new Error('connection reset'); },
      });
      JudgmentEngine.registerAdapter({
        id: 'backup_model', supports: () => true, isAvailable: async () => true,
        evaluate: async () => ({ verdict: true, confidence: 0.9, probability: 0.95, passed: true, adapterName: 'backup_model', latencyMs: 1 }),
      });

      const result = await JudgmentEngine.evaluate(
        { type: 'predicate', criterion: SEMANTIC, adapter_hint: 'flaky_model', fallback_adapter: 'backup_model', min_probability: 0.9 },
        {
          event: { id: 'e', seq: 1, timestamp: new Date().toISOString(), type: 'X', payload: {} },
          context: {},
          currentState: 'REVIEW',
        }
      );

      expect(result.fallbackTriggered).toBe(true);
      expect(result.adapterName).toBe('backup_model');
      expect(result.passed).toBe(true);
      expect(result.band).toBe('accept');
    });
  });

  describe('MCP emit result', () => {
    const emitViaMcp = async (signal: string, payload: Record<string, unknown>) => {
      const workspaceDir = fs.mkdtempSync(path.join(tmpDir, 'mcp-'));
      fs.mkdirSync(path.join(workspaceDir, 'skills', 'outage-skill'), { recursive: true });
      fs.writeFileSync(path.join(workspaceDir, 'skills', 'outage-skill', 'skill.yaml'), skillYaml);
      const server = createReactiveMcpServer({ workspaceDir, defaultSkill: 'outage-skill' });
      const emit = (server as any)._registeredTools['reactive_emit_signal'];
      const result = await emit.handler({ signal, payload, skill: 'outage-skill' }, {} as any);
      return JSON.parse(result.content[0].text);
    };

    it('includes refusalReason when an outage refuses the signal', async () => {
      JudgmentEngine.registerAdapter(throwingJev());
      const parsed = await emitViaMcp('SUBMIT', { exit_code: 0 });
      expect(parsed.transitioned).toBe(false);
      expect(parsed.refusalReason).toMatch(/jev is unavailable/i);
    });

    it('includes judgmentBasis when the deciding judgment was self-reported', async () => {
      const parsed = await emitViaMcp('SUBMIT_DEFAULT', { exit_code: 0 });
      expect(parsed.transitioned).toBe(true);
      expect(parsed.judgmentBasis).toBe('self_reported');
    });
  });

  describe('JudgmentEngine', () => {
    it('does not call the failing adapter again once its circuit is open', async () => {
      const jev = throwingJev();
      JudgmentEngine.registerAdapter(jev);
      const ctx = {
        event: { id: 'e', seq: 1, timestamp: new Date().toISOString(), type: 'X', payload: { exit_code: 0 } },
        context: {},
        currentState: 'REVIEW',
      };
      const judgment = { type: 'predicate' as const, criterion: SEMANTIC, adapter_hint: 'jev' };
      await JudgmentEngine.evaluate(judgment, ctx);
      await JudgmentEngine.evaluate(judgment, ctx);
      const third = await JudgmentEngine.evaluate(judgment, ctx);
      expect(jev.calls).toBe(2);
      expect(third.passed).toBe(false);
      expect(third.band).toBe('unevaluable');
      expect(third.fallbackTarget).toBeUndefined();
    });

    it('applies the outage rule to any registered model adapter, not only Jev', async () => {
      JudgmentEngine.registerAdapter({
        id: 'other_model',
        supports: () => true,
        isAvailable: async () => true,
        evaluate: vi.fn(async () => {
          throw new Error('503 Service Unavailable');
        }),
      });
      const result = await JudgmentEngine.evaluate(
        { type: 'predicate', criterion: 'Build succeeded', adapter_hint: 'other_model', fallback_adapter: 'script' },
        {
          event: { id: 'e', seq: 1, timestamp: new Date().toISOString(), type: 'X', payload: { exit_code: 0 } },
          context: {},
          currentState: 'BUILDING',
        }
      );
      expect(result.passed).toBe(false);
      expect(result.band).toBe('unevaluable');
      expect(result.error).toMatch(/other_model is unavailable/);
    });
  });
});
