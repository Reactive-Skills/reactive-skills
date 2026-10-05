import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';
import { JudgmentEngine } from '../src/core/judgment-engine.js';

// ADR 0012: approve runs in another process, so a long-lived MCP engine must notice the run moved.

const skillYaml = `
schema_version: "2.0.0"
name: approval-skill
description: "External approval fixture"
initial_state: REVIEW
states:
  REVIEW:
    description: "Review"
    transitions:
      SUBMIT:
        target: DONE
        judgment:
          type: predicate
          criterion: "Does the delivered output satisfy the approved assertion?"
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

describe('Writes from another process', () => {
  let workspaceDir: string;
  let originalKey: string | undefined;
  const closers: Array<{ close(): void }> = [];

  beforeEach(() => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-external-approval-'));
    fs.mkdirSync(path.join(workspaceDir, 'skills', 'approval-skill'), { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, 'skills', 'approval-skill', 'skill.yaml'), skillYaml);
    originalKey = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    JudgmentEngine.reset();
  });

  afterEach(() => {
    for (const c of closers.splice(0)) c.close();
    JudgmentEngine.reset();
    try {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch {
      // Windows may still hold engine files open.
    }
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
  });

  it('reports a run another process appended to', () => {
    const options = { workspaceDir, enableSqlite: true, skillId: 'approval-skill', runId: 'shared-run', jobId: 'shared-run' };
    const mine = new EventStore(options);
    const other = new EventStore(options);
    closers.push(mine, other);

    mine.append('NOTE', {});
    expect(mine.hasExternalAppends()).toBe(false);

    other.append('NOTE', {});
    expect(mine.hasExternalAppends()).toBe(true);
  });

  it('shows the approved state through MCP after a person approves in another process', async () => {
    const server = createReactiveMcpServer({ workspaceDir, defaultSkill: 'approval-skill' });
    const tools = (server as any)._registeredTools;
    const call = async (tool: string, args: Record<string, unknown>) =>
      JSON.parse((await tools[tool].handler(args, {} as any)).content[0].text);

    const refused = await call('reactive_emit_signal', { signal: 'SUBMIT', skill: 'approval-skill', job_id: 'review-run', payload: { summary: 'done' } });
    expect(refused.transitioned).toBe(false);

    // Stands in for reactive-skills-axi approve, which opens its own engine in its own process.
    const approver = new FSMEngine({ skillDir: path.join(workspaceDir, 'skills', 'approval-skill'), workspaceDir, jobId: 'review-run' });
    closers.push(approver);
    const [request] = approver.getPendingApprovals();
    const decided = await approver.decideApproval(request.id, 'approve', 'interactive_terminal');
    expect(decided.newState).toBe('DONE');

    const state = await call('reactive_state', { skill: 'approval-skill', job_id: 'review-run' });
    expect(state.activeState).toBe('DONE');

    const again = await call('reactive_emit_signal', { signal: 'SUBMIT', skill: 'approval-skill', job_id: 'review-run', payload: {} });
    expect(again.previousState).toBe('DONE');
    expect(approver.getEventStore().query({ type: 'APPROVAL_REQUESTED' })).toHaveLength(1);
  });

  it('keeps an in-flight MCP call usable when another call replaces its stale engine (review N2)', async () => {
    let release!: () => void;
    let started!: () => void;
    const evaluating = new Promise<void>((resolve) => (started = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    JudgmentEngine.registerAdapter({
      id: 'jev', supports: () => true, isConfigured: () => true, isAvailable: async () => true,
      evaluate: async () => {
        started();
        await gate;
        return { verdict: true, confidence: 0.9, probability: 0.95, passed: true, adapterName: 'jev', latencyMs: 1 };
      },
    });
    const server = createReactiveMcpServer({ workspaceDir, defaultSkill: 'approval-skill' });
    const tools = (server as any)._registeredTools;
    const call = async (tool: string, args: Record<string, unknown>) =>
      JSON.parse((await tools[tool].handler(args, {} as any)).content[0].text);

    await call('reactive_state', { skill: 'approval-skill', job_id: 'busy-run' });
    const inFlight = call('reactive_emit_signal', { signal: 'SUBMIT_MODEL', skill: 'approval-skill', job_id: 'busy-run', payload: {} });
    await evaluating;

    const other = new FSMEngine({ skillDir: path.join(workspaceDir, 'skills', 'approval-skill'), workspaceDir, jobId: 'busy-run' });
    closers.push(other);
    // A direct append stands in for another process; in one process, signals on a run are serialized.
    other.getEventStore().append('NOTE', { from: 'another process' });
    await call('reactive_state', { skill: 'approval-skill', job_id: 'busy-run' });
    release();

    const result = await inFlight;
    expect(JSON.stringify(result)).not.toMatch(/database is not open/i);
    expect(result.error).toMatch(/changed in another process|RUN_VERSION_CONFLICT/);
    expect(other.getEventStore().query({ type: 'STATE_TRANSITION' })).toHaveLength(0);
  });

  it('finishes queued lifecycle signals of a committed transition (review F2)', async () => {
    const lifecycleDir = path.join(workspaceDir, 'skills', 'lifecycle-skill');
    fs.mkdirSync(lifecycleDir, { recursive: true });
    fs.writeFileSync(path.join(lifecycleDir, 'skill.yaml'), [
      'schema_version: "2.0.0"',
      'name: lifecycle-skill',
      'description: "Lifecycle drain fixture"',
      'initial_state: START',
      'states:',
      '  START:',
      '    description: "Start"',
      '    transitions:',
      '      GO: MID',
      '  MID:',
      '    description: "Mid"',
      '    on_enter:',
      '      - emit_signal: NEXT',
      '    transitions:',
      '      NEXT: END',
      '  END:',
      '    description: "End"',
      '',
    ].join('\n'));
    const engine = new FSMEngine({ skillDir: lifecycleDir, workspaceDir });
    closers.push(engine);
    // Report another process's append only after the entry check, as if it landed mid-transition.
    const store = engine.getEventStore();
    const original = store.hasExternalAppends.bind(store);
    let checks = 0;
    store.hasExternalAppends = () => (++checks > 1 ? true : original());

    const result = await engine.handleSignal('GO', {});

    expect(result.transitioned).toBe(true);
    expect(engine.getCurrentState()).toBe('END');
  });
});
