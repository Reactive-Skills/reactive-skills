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
  let originalHome: { HOME?: string; USERPROFILE?: string };
  let engines: FSMEngine[] = [];

  beforeEach(() => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-human-approval-'));
    originalHome = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
    process.env.HOME = process.env.USERPROFILE = path.join(workspaceDir, 'home');
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
    for (const [name, value] of Object.entries(originalHome)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
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

    it('replaces a pending request when the signal is refused again with a different payload', async () => {
      const engine = newEngine();
      await engine.handleSignal('SUBMIT', { evidence: 'first draft' });
      await engine.handleSignal('SUBMIT', { evidence: 'corrected' });

      const pending = engine.getPendingApprovals();
      expect(pending).toHaveLength(1);
      expect(pending[0].payload).toEqual({ evidence: 'corrected' });
    });

    it('links each request to the refused signal that caused it', async () => {
      const engine = newEngine();
      const refused = await engine.handleSignal('SUBMIT', { exit_code: 0 });
      const request = engine.getEventStore().query({ type: 'APPROVAL_REQUESTED' }).at(-1)!;
      expect(request.causationId ?? request.causation_id).toBe(refused.event.id);
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

    it('ignores a decision when the re-sent payload differs from the one the person saw', async () => {
      const engine = newEngine();
      await engine.handleSignal('SUBMIT_STRICT', { evidence: 'shown to the person' });
      const [request] = engine.getPendingApprovals();
      // An orphaned decision, as if approve stopped after recording it and before re-sending the signal.
      const decided = engine.getEventStore().append(
        'APPROVAL_DECIDED',
        { requestId: request.id, decision: 'approve', channel: 'interactive_terminal', state: request.state, signal: request.signal },
        { state: request.state, causationId: request.id }
      );

      const swapped = await engine.handleSignal('SUBMIT_STRICT', { evidence: 'something else' }, { causationId: decided.id });

      expect(swapped.transitioned).toBe(false);
      expect(engine.getCurrentState()).toBe('REVIEW');
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

    it('ignores a hand-written, copied, or edited grant (DoD H26)', async () => {
      const grantFile = path.join(workspaceDir, '.reactive', 'self-report-grant.json');
      fs.mkdirSync(path.dirname(grantFile), { recursive: true });
      fs.writeFileSync(grantFile, JSON.stringify({ grantedAt: new Date().toISOString(), channel: 'interactive_terminal' }));
      expect(hasSelfReportGrant(workspaceDir)).toBe(false);

      const elsewhere = fs.mkdtempSync(path.join(workspaceDir, 'elsewhere-'));
      grantSelfReport(elsewhere, 'interactive_terminal');
      fs.copyFileSync(path.join(elsewhere, '.reactive', 'self-report-grant.json'), grantFile);
      expect(hasSelfReportGrant(elsewhere)).toBe(true);
      expect(hasSelfReportGrant(workspaceDir)).toBe(false);

      grantSelfReport(workspaceDir, 'interactive_terminal');
      expect(hasSelfReportGrant(workspaceDir)).toBe(true);
      const edited = { ...JSON.parse(fs.readFileSync(grantFile, 'utf8')), channel: 'agent' };
      fs.writeFileSync(grantFile, JSON.stringify(edited));
      expect(hasSelfReportGrant(workspaceDir)).toBe(false);

      const refused = await newEngine().handleSignal('SUBMIT', { exit_code: 0 });
      expect(refused.transitioned).toBe(false);
    });

    it('records the first use of a grant in a run once (DoD H25)', async () => {
      grantSelfReport(workspaceDir, 'interactive_terminal');
      const engine = newEngine();

      await engine.handleSignal('SUBMIT_STRICT', { exit_code: 1 });
      await engine.handleSignal('SUBMIT', { exit_code: 0 });

      expect(engine.getCurrentState()).toBe('DONE');
      const used = engine.getEventStore().query({ type: 'SELF_REPORT_GRANT_USED' });
      expect(used).toHaveLength(1);
      expect(used[0].payload).toMatchObject({ channel: 'interactive_terminal' });
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
