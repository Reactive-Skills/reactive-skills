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
});
