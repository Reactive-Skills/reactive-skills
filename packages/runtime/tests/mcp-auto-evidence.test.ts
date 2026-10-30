import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { AUTO_EVIDENCE_MIN_BYTES, autoEvidenceMinBytes } from '../src/core/evidence-submission.js';
import { LocalEvidenceStore } from '../src/core/evidence-store.js';

const large = 'Exact large evidence: café. '.repeat(20);
// Real SDK requests exercise automatic references against the explicit binding contract.
describe('MCP automatic evidence references', () => {
  let workspace: string;
  let client: Client;
  let server: ReturnType<typeof createReactiveMcpServer>;
  beforeEach(async () => {
    vi.stubEnv('REACTIVE_AUTO_EVIDENCE_MIN_BYTES', '');
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-auto-evidence-'));
    const skill = path.join(workspace, 'skills', 'evidence-test');
    fs.mkdirSync(skill, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'draft.txt'), large);
    fs.writeFileSync(path.join(skill, 'skill.yaml'), `
schema_version: reactive/v1
name: evidence-test
description: Automatic evidence fixture
initial_state: REVIEW
context_keys: [draft]
evidence:
  signals:
    CHECK:
      /draft: {media_type: text/plain, projection: utf8}
  context:
    /draft: {media_type: text/plain, projection: utf8}
states:
  REVIEW:
    transitions:
      CHECK: {target: ACCEPTED, guard: 'event.payload.draft === context.draft && typeof context.draft === "string"'}
  ACCEPTED:
    context_scope: [draft]
    transitions:
      DONE: COMPLETED
  COMPLETED:
    description: Completed
`);
    server = createReactiveMcpServer({ workspaceDir: workspace, defaultSkill: 'evidence-test' });
    client = new Client({ name: 'auto-evidence-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await client.close();
    await server.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  async function call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(result.isError, text).not.toBe(true);
    return { text, body: JSON.parse(text) };
  }
  async function emitted(job: string) {
    const { body } = await call('reactive_query_events', { job_id: job, type: 'SIGNAL_EMITTED' });
    return body.at(-1).payload;
  }

  it('commits a large inline value exactly as an explicit path binding would', async () => {
    const auto = await call('reactive_emit_signal', { job_id: 'auto', signal: 'CHECK', payload: { draft: large } });
    const bound = await call('reactive_emit_signal', { job_id: 'bound', signal: 'CHECK', evidence: { '/draft': { path: 'draft.txt', media_type: 'text/plain' } } });
    expect(auto.body.receipt.transitioned).toBe(true);
    expect(bound.body.receipt.transitioned).toBe(true);
    const committed = await emitted('auto');
    const explicit = await emitted('bound');
    // Receipts are scoped to their run; everything else matches the explicit binding.
    const unscoped = ({ run_id: _run, id: _id, ...receipt }: Record<string, unknown>) => receipt;
    expect(Object.keys(committed)).toEqual(Object.keys(explicit));
    expect(Object.keys(committed.draft)).toEqual(['$evidence']);
    expect(Object.keys(committed.draft.$evidence)).toEqual(Object.keys(explicit.draft.$evidence));
    expect(unscoped(committed.draft.$evidence)).toEqual(unscoped(explicit.draft.$evidence));
    expect(committed.draft.$evidence.byte_length).toBe(Buffer.byteLength(large));
    // The inline receipt shape is kept; the agent did not ask for a reference.
    expect(auto.body.receipt).not.toHaveProperty('evidence');
    expect(auto.text).not.toContain(large);
  });

  it('keeps the text out of later views and reads it back from the recovered receipt', async () => {
    const first = await call('reactive_emit_signal', { job_id: 'auto', signal: 'CHECK', payload: { draft: large } });
    const done = await call('reactive_emit_signal', { job_id: 'auto', signal: 'DONE' });
    const recovered = await call('reactive_state', { job_id: 'auto' });
    for (const text of [first.text, done.text, recovered.text]) expect(text).not.toContain('Exact large evidence');
    const reference = recovered.body.context.draft.$evidence;
    const read = await call('reactive_read_evidence', { job_id: 'auto', reference });
    expect(read.body.content).toBe(large);
  });

  it('leaves values below the measured threshold inline', async () => {
    const small = 'x'.repeat(AUTO_EVIDENCE_MIN_BYTES - 1);
    const result = await call('reactive_emit_signal', { job_id: 'small', signal: 'CHECK', payload: { draft: small } });
    expect(result.body.receipt.transitioned).toBe(true);
    expect((await emitted('small')).draft).toBe(small);
  });

  it('registers once and replays the original receipt on a keyed retry', async () => {
    const register = vi.spyOn(LocalEvidenceStore.prototype, 'registerText');
    const args = { job_id: 'retry', signal: 'CHECK', payload: { draft: large }, idempotency_key: 'auto-once' };
    const original = await call('reactive_emit_signal', args);
    const retry = await call('reactive_emit_signal', args);
    expect(register).toHaveBeenCalledTimes(1);
    expect(retry.body.replayed).toBe(true);
    expect(retry.body.receipt).toEqual(original.body.receipt);
    const { body } = await call('reactive_query_events', { job_id: 'retry', type: 'SIGNAL_EMITTED' });
    expect(body).toHaveLength(1);
  });

  it('can be switched off, keeping the value inline', async () => {
    vi.stubEnv('REACTIVE_AUTO_EVIDENCE_MIN_BYTES', 'off');
    await call('reactive_emit_signal', { job_id: 'off', signal: 'CHECK', payload: { draft: large } });
    expect((await emitted('off')).draft).toBe(large);
  });
});

describe('automatic evidence threshold configuration', () => {
  it('defaults to the measured value and rejects invalid settings', () => {
    expect(autoEvidenceMinBytes(undefined)).toBe(AUTO_EVIDENCE_MIN_BYTES);
    expect(autoEvidenceMinBytes('')).toBe(AUTO_EVIDENCE_MIN_BYTES);
    expect(autoEvidenceMinBytes('4096')).toBe(4096);
    expect(autoEvidenceMinBytes('off')).toBe(Number.POSITIVE_INFINITY);
    expect(() => autoEvidenceMinBytes('0')).toThrow(/positive integer or off/);
  });
});
