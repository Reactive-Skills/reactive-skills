import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JudgmentEngine, JudgmentAuthoringError, JevJudgmentAdapter } from '../src/core/judgment-engine.js';
import { FSMEngine } from '../src/core/fsm-engine.js';

// Spec 0019 criteria 18 and 19 (#47): a misconfigured judgment is not an outage.

const skillYaml = `
schema_version: "2.0.0"
name: authoring-skill
description: "Authoring error fixture"
initial_state: REVIEW
states:
  REVIEW:
    description: "Review"
    transitions:
      SUBMIT_MODEL:
        target: DONE
        judgment:
          type: predicate
          criterion: "Does the delivered output satisfy the approved assertion?"
          adapter_hint: jev
          min_probability: 0.8
  DONE:
    description: "Done"
`;

describe('Judgment authoring errors (#47)', () => {
  let workspaceDir: string;
  let originalKey: string | undefined;
  let engine: FSMEngine | undefined;

  beforeEach(() => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-judgment-authoring-'));
    fs.writeFileSync(path.join(workspaceDir, 'skill.yaml'), skillYaml);
    originalKey = process.env.TYPESAFE_API_KEY;
    JudgmentEngine.reset();
  });

  afterEach(() => {
    engine?.close();
    engine = undefined;
    JudgmentEngine.reset();
    try {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch {
      // Windows may still hold engine files open.
    }
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
  });

  it('throws JudgmentAuthoringError for an evaluation rubric with fewer than two criteria', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key-never-sent';
    const adapter = new JevJudgmentAdapter();
    const request = { type: 'evaluation' as const, criterion: 'How complete is the output?', rubric: ['complete'] };

    await expect(adapter.evaluate(request, { context: {} } as any)).rejects.toBeInstanceOf(JudgmentAuthoringError);
  });

  it('does not count an authoring error against the circuit breaker and names the problem', async () => {
    JudgmentEngine.registerAdapter({
      id: 'jev', supports: () => true, isConfigured: () => true, isAvailable: async () => true,
      evaluate: async () => { throw new JudgmentAuthoringError('Jev evaluation requires at least two ordered rubric criteria'); },
    });
    engine = new FSMEngine({ skillDir: workspaceDir, workspaceDir });
    let result;
    for (let i = 0; i < 3; i++) result = await engine.handleSignal('SUBMIT_MODEL', {});

    expect(JudgmentEngine.getBreaker('jev')!.getState()).toBe('CLOSED');
    expect(result!.transitioned).toBe(false);
    expect(result!.refusalReason).toMatch(/misconfigured/i);
    expect(result!.refusalReason).toMatch(/at least two ordered rubric criteria/);
    expect(result!.refusalReason).toMatch(/Retrying will not help/);
    expect(result!.refusalReason).not.toMatch(/Retry the signal when/);
  });
});
