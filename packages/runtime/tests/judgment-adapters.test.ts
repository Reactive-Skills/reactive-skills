import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  JudgmentEngine,
  ScriptJudgmentAdapter,
  JevJudgmentAdapter,
  CircuitBreaker,
} from '../src/core/judgment-engine.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { JudgmentAdapter, JudgmentRequest, JudgmentResult } from '../src/core/types.js';

describe('Decoupled Judgment & Snap-On Adapters', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-judgment-test-'));
    JudgmentEngine.reset();
  });

  afterEach(() => {
    JudgmentEngine.reset();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  describe('ScriptJudgmentAdapter (Built-in Default)', () => {
    const adapter = new ScriptJudgmentAdapter();

    it('should evaluate boolean predicates using expressions', async () => {
      const res = await adapter.evaluate(
        {
          type: 'predicate',
          criterion: 'payload.tests_passed === 10',
          contextSnapshot: {},
        },
        {
          event: { id: 'evt-1', seq: 1, timestamp: new Date().toISOString(), type: 'TEST', payload: { tests_passed: 10 } },
          context: {},
          currentState: 'TESTING',
        }
      );

      expect(res.passed).toBe(true);
      expect(res.verdict).toBe(true);
      expect(res.confidence).toBe(1.0);
      expect(res.adapterName).toBe('script');
    });

    it('should fallback to exit_code == 0 heuristic when criterion is plain natural language', async () => {
      const resPass = await adapter.evaluate(
        {
          type: 'predicate',
          criterion: 'Did tests pass?',
          contextSnapshot: {},
        },
        {
          event: { id: 'evt-2', seq: 1, timestamp: new Date().toISOString(), type: 'TEST', payload: { exit_code: 0 } },
          context: {},
          currentState: 'TESTING',
        }
      );
      expect(resPass.passed).toBe(true);

      const resFail = await adapter.evaluate(
        {
          type: 'predicate',
          criterion: 'Did tests pass?',
          contextSnapshot: {},
        },
        {
          event: { id: 'evt-3', seq: 1, timestamp: new Date().toISOString(), type: 'TEST', payload: { exit_code: 1 } },
          context: {},
          currentState: 'TESTING',
        }
      );
      expect(resFail.passed).toBe(false);
    });

    it('should evaluate categorical choices', async () => {
      const res = await adapter.evaluate(
        {
          type: 'categorical',
          criterion: 'payload.category',
          options: ['bug', 'feature', 'chore'],
          contextSnapshot: {},
        },
        {
          event: { id: 'evt-4', seq: 1, timestamp: new Date().toISOString(), type: 'TRIAGE', payload: { category: 'feature' } },
          context: {},
          currentState: 'TRIAGE',
        }
      );

      expect(res.passed).toBe(true);
      expect(res.verdict).toBe('feature');
    });
  });

  describe('CircuitBreaker Resilience', () => {
    it('should trip after consecutive failures and recover after timeout', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50 });

      expect(breaker.canExecute()).toBe(true);
      expect(breaker.getState()).toBe('CLOSED');

      breaker.recordFailure();
      expect(breaker.canExecute()).toBe(true);
      expect(breaker.getState()).toBe('CLOSED');

      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.canExecute()).toBe(false);

      // Wait for reset timeout
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(breaker.canExecute()).toBe(true);
          expect(breaker.getState()).toBe('HALF_OPEN');

          breaker.recordSuccess();
          expect(breaker.getState()).toBe('CLOSED');
          expect(breaker.canExecute()).toBe(true);
          resolve();
        }, 60);
      });
    });
  });

  describe('JudgmentEngine Fallback Cascade', () => {
    it('should cascade from failing primary adapter to fallback script adapter', async () => {
      // Create a mock failing primary adapter
      const failingAdapter: JudgmentAdapter = {
        id: 'failing_ai',
        supports: () => true,
        isAvailable: async () => true,
        evaluate: async () => {
          throw new Error('503 Service Unavailable');
        },
      };

      JudgmentEngine.registerAdapter(failingAdapter);

      const evalContext = {
        event: { id: 'evt-1', seq: 1, timestamp: new Date().toISOString(), type: 'BUILD', payload: { exit_code: 0 } },
        context: {},
        currentState: 'BUILDING',
      };

      const result = await JudgmentEngine.evaluate(
        {
          type: 'predicate',
          criterion: 'Build succeeded',
          adapter_hint: 'failing_ai',
          fallback_adapter: 'script',
        },
        evalContext
      );

      expect(result.fallbackTriggered).toBe(true);
      expect(result.adapterName).toBe('script');
      expect(result.passed).toBe(true);

      const breaker = JudgmentEngine.getBreaker('failing_ai');
      expect(breaker?.getState()).toBe('CLOSED'); // 1 failure recorded, threshold 2
    });

    it('should enforce confidence thresholds and return fallback_target if confidence is low', async () => {
      const lowConfidenceAdapter: JudgmentAdapter = {
        id: 'uncertain_model',
        supports: () => true,
        isAvailable: async () => true,
        evaluate: async () => ({
          verdict: true,
          confidence: 0.60,
          passed: true,
          adapterName: 'uncertain_model',
          latencyMs: 10,
        }),
      };

      JudgmentEngine.registerAdapter(lowConfidenceAdapter);

      const evalContext = {
        event: { id: 'evt-2', seq: 1, timestamp: new Date().toISOString(), type: 'AUDIT', payload: {} },
        context: {},
        currentState: 'AUDITING',
      };

      const result = await JudgmentEngine.evaluate(
        {
          type: 'predicate',
          criterion: 'Is code audited?',
          adapter_hint: 'uncertain_model',
          min_confidence: 0.85,
          fallback_target: 'HUMAN_APPROVAL',
        },
        evalContext
      );

      expect(result.passed).toBe(false);
      expect(result.fallbackTarget).toBe('HUMAN_APPROVAL');
    });
  });

  describe('FSMEngine Integration: Model Contracts & Declarative Judgment', () => {
    it('should render model contracts into PromptSlice', async () => {
      const skillYaml = `
schema_version: "2.0.0"
name: test-tiered-skill
description: "A test skill with tiered model contracts"
initial_state: triage
states:
  triage:
    description: "Triage step"
    model:
      tier: fast
      suggested: "flash"
      temperature: 0.2
    transitions:
      DONE: complete
  complete:
    description: "Finished"
`;
      fs.writeFileSync(path.join(tmpDir, 'skill.yaml'), skillYaml);

      const engine = new FSMEngine({
        skillDir: tmpDir,
        workspaceDir: tmpDir,
      });

      const slice = engine.generatePromptSlice();
      expect(slice.modelContract).toBeDefined();
      expect(slice.modelContract?.tier).toBe('fast');
      expect(slice.modelContract?.suggested).toBe('flash');
      expect(slice.modelContract?.temperature).toBe(0.2);
      expect(slice.formattedXml).toContain('<model_contract tier="fast" suggested="flash" temperature="0.2" />');
    });

    it('should evaluate judgment on signal dispatch and route to fallback_target on failure', async () => {
      const skillYaml = `
schema_version: "2.0.0"
name: test-judgment-skill
description: "A test skill for judgment fallback"
initial_state: verifying
states:
  verifying:
    description: "Verifying quality"
    transitions:
      SUBMIT:
        target: PROMOTED
        judgment:
          type: predicate
          criterion: "payload.clean === true"
          min_confidence: 0.90
          adapter_hint: script
          fallback_target: ESCALATED
  PROMOTED:
    description: "Promoted to prod"
  ESCALATED:
    description: "Escalated to human review"
`;
      fs.writeFileSync(path.join(tmpDir, 'skill.yaml'), skillYaml);

      const engine = new FSMEngine({
        skillDir: tmpDir,
        workspaceDir: tmpDir,
      });

      // 1. Dispatch signal where judgment fails
      await engine.handleSignal('SUBMIT', { clean: false });
      expect(engine.getCurrentState()).toBe('ESCALATED');

      // Check event store has GUARD_FALLBACK_TRIGGERED
      const fallbackEvents = engine.getEventStore().query({ type: 'GUARD_FALLBACK_TRIGGERED' });
      expect(fallbackEvents.length).toBe(1);
      expect(fallbackEvents[0].payload.to).toBe('ESCALATED');
    });

    it('should transition to target when judgment passes', async () => {
      const skillYaml = `
schema_version: "2.0.0"
name: test-judgment-pass-skill
description: "A test skill for passing judgment"
initial_state: verifying
states:
  verifying:
    description: "Verifying quality"
    transitions:
      SUBMIT:
        target: PROMOTED
        judgment:
          type: predicate
          criterion: "payload.clean === true"
          min_confidence: 0.80
          adapter_hint: script
  PROMOTED:
    description: "Promoted to prod"
`;
      fs.writeFileSync(path.join(tmpDir, 'skill.yaml'), skillYaml);

      const engine = new FSMEngine({
        skillDir: tmpDir,
        workspaceDir: tmpDir,
      });

      await engine.handleSignal('SUBMIT', { clean: true });
      expect(engine.getCurrentState()).toBe('PROMOTED');
    });
  });

  describe('Snap-On JevJudgmentAdapter Presence Check', () => {
    it('should identify Jev adapter availability without throwing error', async () => {
      const jev = new JevJudgmentAdapter();
      expect(jev.id).toBe('jev');
      expect(jev.supports('predicate')).toBe(true);

      const isAvail = await jev.isAvailable();
      expect(typeof isAvail).toBe('boolean');
    });
  });
});
