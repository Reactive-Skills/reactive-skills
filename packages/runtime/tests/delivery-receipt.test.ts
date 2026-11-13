import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { hostSessionIds, readDeliveryReceipt } from '../src/core/delivery-receipt.js';

const HOST_ENV = ['CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID'];

describe('delivery receipts', () => {
  it('collects every exported host session id and rejects unsafe ones', () => {
    expect(hostSessionIds({ CLAUDE_CODE_SESSION_ID: 'abc-1', CODEX_THREAD_ID: '01a1.d3' })).toEqual(['abc-1', '01a1.d3']);
    expect(hostSessionIds({ CLAUDE_CODE_SESSION_ID: '../escape' })).toEqual([]);
    expect(hostSessionIds({})).toEqual([]);
  });
});

// Every MCP path that hands a view to the agent must leave a receipt, or MCP users could never acknowledge.
describe('MCP view deliveries write a per-session receipt for the delivered state', () => {
  let workspace: string;
  let server: ReturnType<typeof createReactiveMcpServer>;
  let client: Client;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const key of HOST_ENV) { saved[key] = process.env[key]; delete process.env[key]; }
    process.env.CLAUDE_CODE_SESSION_ID = 'M1';
    workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-receipt-')));
    const skill = path.join(workspace, 'skills', 'receipt');
    fs.mkdirSync(skill, { recursive: true });
    fs.writeFileSync(path.join(skill, 'skill.yaml'), JSON.stringify({
      schema_version: 'reactive/v1', name: 'receipt', description: 'Receipt fixture', initial_state: 'INTAKE',
      states: {
        INTAKE: { transitions: { NOTED: 'REVIEW' } },
        REVIEW: { human_gate: { type: 'approval', prompt: 'Approve?', options: ['Approve'] }, transitions: { USER_APPROVED: 'BUILD' } },
        BUILD: { transitions: { DONE: 'COMPLETED' } },
        COMPLETED: {},
      },
    }));
    server = createReactiveMcpServer({ workspaceDir: workspace, defaultSkill: 'receipt' });
    client = new Client({ name: 'receipt-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });
  afterEach(async () => {
    await client.close();
    await server.close();
    fs.rmSync(workspace, { recursive: true, force: true });
    for (const key of HOST_ENV) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  });

  async function call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(result.isError, text).not.toBe(true);
    return JSON.parse(text);
  }
  /** Latest receipt the session holds in any run: a child invocation delivers its own run's view. */
  function receipt(session = 'M1') {
    const runsDir = path.join(workspace, '.reactive', 'skills', 'receipt', 'runs');
    const found = fs.readdirSync(runsDir)
      .map(run => readDeliveryReceipt(path.join(runsDir, run), session))
      .filter(entry => entry !== null)
      .sort((a, b) => a!.at.localeCompare(b!.at));
    return found.at(-1) ?? null;
  }

  it.each([
    ['reactive_invoke_skill', { skill: 'skills/receipt' }, 'INTAKE'],
    ['reactive_state', { output: 'compact-v1' }, 'INTAKE'],
    ['reactive_state', { since_seq: 0 }, 'INTAKE'],
    ['reactive_emit_signal (complete view)', { signal: 'NOTED', return_view: 'compact-v1' }, 'REVIEW'],
    ['reactive_emit_signal (delta view)', { signal: 'NOTED', return_view: 'delta-v1' }, 'REVIEW'],
  ])('%s', async (label, args, state) => {
    const name = label.split(' ')[0];
    await call(name, args as Record<string, unknown>);
    expect(receipt()).toMatchObject({ skill: 'receipt', state, transport: 'mcp' });
    expect(receipt('OTHER')).toBeNull();
  });

  it('reactive_respond_human', async () => {
    await call('reactive_emit_signal', { signal: 'NOTED', return_view: 'compact-v1' });
    await call('reactive_respond_human', { choice: 'Approve', return_view: 'compact-v1' });
    expect(receipt()).toMatchObject({ state: 'BUILD', transport: 'mcp' });
  });

  it('writes an anonymous receipt when the host exports no session id', async () => {
    delete process.env.CLAUDE_CODE_SESSION_ID;
    await call('reactive_state', { output: 'compact-v1' });
    expect(receipt('_anon')).toMatchObject({ state: 'INTAKE', host_session: null });
  });
});
