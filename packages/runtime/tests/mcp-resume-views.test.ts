import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { createStateView } from '../src/core/state-view.js';

const NOTES = 'Intake notes the agent recorded earlier. '.repeat(20);

// Each resume path must rebuild the complete view from the ledger, not from session memory.
describe('MCP resume delivers the complete view from the ledger', () => {
  let workspace: string;
  let skillDir: string;
  const sessions: Array<{ client: Client; server: ReturnType<typeof createReactiveMcpServer> }> = [];
  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-resume-'));
    skillDir = path.join(workspace, 'skills', 'resume');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), JSON.stringify({
      schema_version: 'reactive/v1', name: 'resume', description: 'Resume fixture', initial_state: 'INTAKE',
      context_keys: ['notes', 'plan', 'target'],
      default_context: { target: 'src/app.ts' },
      states: {
        INTAKE: { context_scope: ['notes'], transitions: { NOTED: 'PLAN' } },
        PLAN: { prompt_template: 'plan.md', context_scope: ['notes', 'plan', 'target'], transitions: { PLANNED: 'BUILD' } },
        BUILD: { context_scope: ['notes', 'plan', 'target'], transitions: { BUILT: 'COMPLETED' } },
        COMPLETED: {},
      },
    }));
    fs.writeFileSync(path.join(skillDir, 'plan.md'), 'Plan the change to {{context.target}}.');
  });
  afterEach(async () => {
    for (const { client, server } of sessions.splice(0)) {
      await client.close();
      await server.close();
    }
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  async function connect() {
    const server = createReactiveMcpServer({ workspaceDir: workspace, defaultSkill: 'resume' });
    const client = new Client({ name: 'resume-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    sessions.push({ client, server });
    return async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as Array<{ text: string }>)[0].text;
      expect(result.isError, text).not.toBe(true);
      return JSON.parse(text);
    };
  }

  // The complete view a fresh engine derives from this run's ledger alone.
  function ledgerView(runId: string) {
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: runId });
    try {
      return createStateView(engine);
    } finally {
      engine.close();
    }
  }

  async function workToPlan(call: Awaited<ReturnType<typeof connect>>, job?: string) {
    const scope = job ? { job_id: job } : {};
    const first = await call('reactive_state', { output: 'compact-v1', ...scope });
    const moved = await call('reactive_emit_signal', { signal: 'NOTED', payload: { contextUpdates: { notes: NOTES } }, return_view: 'delta-v1', ...scope });
    expect(moved.view.format).toBe('delta-v1');
    expect(moved.view).not.toHaveProperty('policy');
    expect(JSON.stringify(moved.view)).not.toContain(NOTES.slice(0, 40));
    return first.run_id as string;
  }

  it('after a crash, a new session re-fetches and continues from the complete ledger view', async () => {
    const before = await connect();
    const runId = await workToPlan(before);
    const { client, server } = sessions.pop()!;
    await client.close();
    await server.close();

    const after = await connect();
    const recovered = await after('reactive_state', { job_id: runId, output: 'compact-v1' });
    expect(recovered).toEqual(ledgerView(runId));
    expect(recovered).toMatchObject({ format: 'compact-v1', state: 'PLAN', context: { notes: NOTES, target: 'src/app.ts' } });
    expect(recovered.prompt).toBe('Plan the change to src/app.ts.');
    expect(recovered.policy).toContain('Re-fetch the same run');
    const next = await after('reactive_emit_signal', { job_id: runId, signal: 'PLANNED', payload: { plan: 'p1' }, return_view: 'delta-v1' });
    expect(next.view).toMatchObject({ format: 'delta-v1', state: 'BUILD', context: {}, context_accepted: ['plan'] });
  });

  it('after a crash, an emit without a prior fetch in the new session carries the complete view', async () => {
    const before = await connect();
    const runId = await workToPlan(before);
    const after = await connect();
    const next = await after('reactive_emit_signal', { job_id: runId, signal: 'PLANNED', payload: { plan: 'p1' }, return_view: 'delta-v1' });
    expect(next.view).toEqual(ledgerView(runId));
    expect(next.view).toMatchObject({ format: 'compact-v1', state: 'BUILD', context: { notes: NOTES, plan: 'p1', target: 'src/app.ts' } });
  });

  it('after host compaction, a fetch without since_seq restores the complete view in the same session', async () => {
    const call = await connect();
    const runId = await workToPlan(call);
    // The agent has lost its prior messages, so it holds no sequence to send.
    const recovered = await call('reactive_state', { job_id: runId, output: 'compact-v1' });
    expect(recovered).toEqual(ledgerView(runId));
    expect(recovered.context).toEqual({ notes: NOTES, target: 'src/app.ts' });
    const legacy = await call('reactive_state', { job_id: runId, output: 'legacy' });
    expect(legacy.scopedContext).toEqual(recovered.context);
    expect(legacy.formattedXml).toContain('Plan the change to src/app.ts.');
  });

  it('after a job switch, the switched run receives its complete view', async () => {
    const call = await connect();
    await workToPlan(call, 'alpha');
    // Another session advanced job beta; this session has never delivered it.
    const other = await connect();
    const betaRun = await workToPlan(other, 'beta');
    await call('reactive_switch_job', { job_id: betaRun });
    const next = await call('reactive_emit_signal', { signal: 'PLANNED', payload: { plan: 'beta plan' }, return_view: 'delta-v1' });
    expect(next.receipt.run_id).toBe(betaRun);
    expect(next.view).toEqual(ledgerView(betaRun));
    expect(next.view).toMatchObject({ format: 'compact-v1', state: 'BUILD', context: { notes: NOTES, plan: 'beta plan', target: 'src/app.ts' } });
  });
});
