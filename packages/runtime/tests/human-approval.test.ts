import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JudgmentEngine } from '../src/core/judgment-engine.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { grantSelfReport, hasSelfReportGrant, revokeSelfReport } from '../src/core/approval-grants.js';
import { STATIC_RUNTIME_CAPABILITIES } from '../src/core/runtime-capabilities.js';

// Spec 0019 and ADR 0012: gates no adapter can judge wait for a person, and self-report needs a grant.

const SEMANTIC = 'Does the delivered output satisfy the approved assertion?';

const skillYaml = `
schema_version: "2.0.0"
name: approval-skill
description: "Human approval fixture"
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
          fallback_target: REPAIR
      SUBMIT_STRICT:
        target: DONE
        judgment:
          type: predicate
          criterion: "${SEMANTIC}"
      SUBMIT_EXACT:
        target: DONE
        judgment:
          type: predicate
          criterion: "payload.exit_code === 0"
          adapter_hint: script
      SUBMIT_MODEL:
        target: DONE
        judgment:
          type: predicate
          criterion: "${SEMANTIC}"
          adapter_hint: jev
          min_probability: 0.8
  DONE:
    description: "Done"
  REPAIR:
    description: "Repair"
`;

describe('Human approval for unjudgeable gates (#22 part 2)', () => {
  let workspaceDir: string;
  let originalKey: string | undefined;
  let engines: FSMEngine[] = [];

  beforeEach(() => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-human-approval-'));
    fs.writeFileSync(path.join(workspaceDir, 'skill.yaml'), skillYaml);
    originalKey = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    JudgmentEngine.reset();
  });

  afterEach(() => {
    for (const engine of engines) engine.close();
    engines = [];
    JudgmentEngine.reset();
    try {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch {
      // Windows may still hold engine files open.
    }
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
  });

  const newEngine = () => {
    const engine = new FSMEngine({ skillDir: workspaceDir, workspaceDir });
    engines.push(engine);
    return engine;
  };
  const throwingJev = () => ({
    id: 'jev', supports: () => true, isConfigured: () => true, isAvailable: async () => true,
    evaluate: async () => { throw new Error('Jev request timed out'); },
  });

  describe('pending approvals', () => {
    it('refuses a natural-language gate without a model or grant and records an approval request', async () => {
      const engine = newEngine();
      const result = await engine.handleSignal('SUBMIT', { exit_code: 0 });

      expect(result.transitioned).toBe(false);
      expect(engine.getCurrentState()).toBe('REVIEW');
      const pending = engine.getPendingApprovals();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({ state: 'REVIEW', signal: 'SUBMIT', target: 'DONE', criterion: SEMANTIC });
      expect(result.refusalReason).toMatch(/no model is configured/i);
      expect(result.refusalReason).toMatch(/ask the user to run `reactive-skills-axi approve approval-skill --job [^`]+` in their own terminal/);
      // The user's terminal may start elsewhere, so the reason names the workspace to run it from.
      expect(result.refusalReason).toContain(`from ${workspaceDir}`);
    });

    it('records an approval request during a model outage', async () => {
      JudgmentEngine.registerAdapter(throwingJev());
      const engine = newEngine();
      await engine.handleSignal('SUBMIT', { exit_code: 0 });
      expect(engine.getPendingApprovals()).toHaveLength(1);
    });

    it('does not duplicate a pending request when the same signal is refused again', async () => {
      const engine = newEngine();
      await engine.handleSignal('SUBMIT', { exit_code: 0 });
      await engine.handleSignal('SUBMIT', { exit_code: 0 });
      expect(engine.getPendingApprovals()).toHaveLength(1);
    });
  });

  describe('human decisions', () => {
    it('continues the original signal when a person approves, decided by a human', async () => {
      const engine = newEngine();
      await engine.handleSignal('SUBMIT', { exit_code: 0 });
      const [request] = engine.getPendingApprovals();

      const result = await engine.decideApproval(request.id, 'approve', 'interactive_terminal');

      expect(result.transitioned).toBe(true);
      expect(engine.getCurrentState()).toBe('DONE');
      expect(result.judgmentBasis).toBe('human');
      const guard = engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!;
      expect(guard.payload.judgment.decidedBy).toBe('human');
      const decided = engine.getEventStore().query({ type: 'APPROVAL_DECIDED' });
      expect(decided[0].payload).toMatchObject({ requestId: request.id, decision: 'approve', channel: 'interactive_terminal' });
      expect(engine.getPendingApprovals()).toHaveLength(0);
    });

    it('routes a rejection to fallback_target, or refuses when none is declared', async () => {
      const engine = newEngine();
      await engine.handleSignal('SUBMIT', { exit_code: 0 });
      await engine.decideApproval(engine.getPendingApprovals()[0].id, 'reject', 'interactive_terminal');
      expect(engine.getCurrentState()).toBe('REPAIR');

      const strictDir = fs.mkdtempSync(path.join(workspaceDir, 'strict-'));
      fs.writeFileSync(path.join(strictDir, 'skill.yaml'), skillYaml);
      const strict = new FSMEngine({ skillDir: strictDir, workspaceDir: strictDir });
      engines.push(strict);
      await strict.handleSignal('SUBMIT_STRICT', { exit_code: 0 });
      const rejected = await strict.decideApproval(strict.getPendingApprovals()[0].id, 'reject', 'interactive_terminal');
      expect(rejected.transitioned).toBe(false);
      expect(strict.getCurrentState()).toBe('REVIEW');
    });

    it('applies an approval only once', async () => {
      const engine = newEngine();
      await engine.handleSignal('SUBMIT_STRICT', { exit_code: 0 });
      const [request] = engine.getPendingApprovals();
      await engine.decideApproval(request.id, 'reject', 'interactive_terminal');
      const decided = engine.getEventStore().query({ type: 'APPROVAL_DECIDED' }).at(-1)!;

      const replay = await engine.handleSignal('SUBMIT_STRICT', { exit_code: 0 }, { causationId: decided.id });

      expect(replay.transitioned).toBe(false);
      const guard = engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!;
      expect(guard.payload.judgment.decidedBy).not.toBe('human');
    });

    it('rejects an unknown request id', async () => {
      const engine = newEngine();
      await expect(engine.decideApproval('missing-request', 'approve', 'interactive_terminal')).rejects.toThrow(/no pending approval/i);
    });
  });

  describe('self-report grant', () => {
    it('decides from the payload only with a grant, and flags every such emit', async () => {
      grantSelfReport(workspaceDir, 'interactive_terminal');
      expect(hasSelfReportGrant(workspaceDir)).toBe(true);
      const engine = newEngine();

      const result = await engine.handleSignal('SUBMIT', { exit_code: 0 });

      expect(result.transitioned).toBe(true);
      expect(result.judgmentBasis).toBe('self_reported');
      expect(result.warning).toMatch(/self-reported/i);
      expect(engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!.payload.judgment.decidedBy).toBe('self_reported');
    });

    it('ignores the grant during an outage of a configured model', async () => {
      grantSelfReport(workspaceDir, 'interactive_terminal');
      JudgmentEngine.registerAdapter(throwingJev());
      const engine = newEngine();
      const result = await engine.handleSignal('SUBMIT', { exit_code: 0 });
      expect(result.transitioned).toBe(false);
      expect(engine.getPendingApprovals()).toHaveLength(1);
    });

    it('stops self-reporting once the grant is revoked', async () => {
      grantSelfReport(workspaceDir, 'interactive_terminal');
      revokeSelfReport(workspaceDir);
      expect(hasSelfReportGrant(workspaceDir)).toBe(false);
      const result = await newEngine().handleSignal('SUBMIT', { exit_code: 0 });
      expect(result.transitioned).toBe(false);
    });

    it('reports whether a grant was removed, and throws when removal fails', () => {
      expect(revokeSelfReport(workspaceDir)).toBe(false);
      grantSelfReport(workspaceDir, 'interactive_terminal');
      expect(revokeSelfReport(workspaceDir)).toBe(true);

      // A grant path that cannot be removed must not read as a successful revoke.
      fs.mkdirSync(path.join(workspaceDir, '.reactive', 'self-report-grant.json', 'locked'), { recursive: true });
      expect(() => revokeSelfReport(workspaceDir)).toThrow();
    });
  });

  describe('decision source', () => {
    it('records expression and model decisions', async () => {
      JudgmentEngine.registerAdapter({
        id: 'jev', supports: () => true, isConfigured: () => true, isAvailable: async () => true,
        evaluate: async () => ({ verdict: true, confidence: 0.9, probability: 0.95, passed: true, adapterName: 'jev', latencyMs: 1 }),
      });
      const engine = newEngine();
      await engine.handleSignal('SUBMIT_EXACT', { exit_code: 0 });
      expect(engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!.payload.judgment.decidedBy).toBe('expression');

      const second = new FSMEngine({ skillDir: workspaceDir, workspaceDir: fs.mkdtempSync(path.join(workspaceDir, 'model-')) });
      engines.push(second);
      await second.handleSignal('SUBMIT_MODEL', {});
      expect(second.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!.payload.judgment.decidedBy).toBe('model');
    });
  });

  it('advertises the judgment.human_approval capability', () => {
    expect(STATIC_RUNTIME_CAPABILITIES).toContain('judgment.human_approval');
  });
});
