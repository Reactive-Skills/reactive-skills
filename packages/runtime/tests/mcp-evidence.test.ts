import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';

const draft = 'Exact evidence: café\r\n';
describe('MCP evidence protocol', () => {
  let workspace: string;
  let client: Client;
  let server: ReturnType<typeof createReactiveMcpServer>;
  beforeEach(async () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-mcp-evidence-'));
    const skill = path.join(workspace, 'skills', 'evidence-test');
    fs.mkdirSync(skill, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'draft with spaces.txt'), draft);
    fs.writeFileSync(path.join(skill, 'skill.yaml'), `
schema_version: reactive/v1
name: evidence-test
description: MCP evidence protocol fixture
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
    description: Accepted
`);
    server = createReactiveMcpServer({ workspaceDir: workspace, defaultSkill: 'evidence-test' });
    client = new Client({ name: 'evidence-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });
  afterEach(async () => {
    await client.close();
    await server.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: { job_id: 'protocol-run', ...args } });
    return { result, body: JSON.parse((result.content as Array<{text: string}>)[0].text) };
  }

  it('discovers the reference capability and schemas through the protocol', async () => {
    const { tools } = await client.listTools();
    expect(tools.find(t => t.name === 'reactive_emit_signal')?.inputSchema.properties).toHaveProperty('evidence');
    expect(tools.find(t => t.name === 'reactive_import_evidence')).toBeDefined();
    expect(tools.find(t => t.name === 'reactive_read_evidence')).toBeDefined();
    const result = await client.callTool({ name: 'reactive_capabilities', arguments: {} });
    expect(JSON.parse((result.content as Array<{text: string}>)[0].text).capabilities).toContain('evidence.reference_submission');
  });

  it.each([false, true])('submits verified evidence with folded import=%s and recovers the receipt after response loss', async folded => {
    const descriptor = { path: 'draft with spaces.txt', media_type: 'text/plain' };
    let reference;
    if (!folded) {
      const first = await call('reactive_import_evidence', descriptor);
      reference = first.body.reference;
      expect(first.body.content).toBeUndefined();
      expect((await call('reactive_import_evidence', descriptor)).body.reference).toEqual(reference);
      fs.unlinkSync(path.join(workspace, descriptor.path));
    }
    const args = { signal: 'CHECK', evidence: { '/draft': folded ? descriptor : { reference } }, idempotency_key: 'once' };
    const first = await call('reactive_emit_signal', args);
    expect(first.result.isError).not.toBe(true);
    expect(first.body.transitioned).toBe(true);
    reference = first.body.evidence['/draft'];
    expect(reference.sha256).toBe(createHash('sha256').update(draft).digest('hex'));
    expect(reference.byte_length).toBe(Buffer.byteLength(draft));
    expect(JSON.stringify(first.body)).not.toContain('Exact evidence');
    if (folded) fs.unlinkSync(path.join(workspace, descriptor.path));
    const retry = await call('reactive_emit_signal', args);
    expect(retry.body.event_id).toBe(first.body.event_id);
    expect(retry.body.evidence).toEqual(first.body.evidence);
    expect(retry.body.transitioned).toBe(false);
    expect((await call('reactive_read_evidence', { reference })).body.content).toBe(draft);
  });

  it.each([
    { '/draft': { reference: { id: 'malformed' } } },
    Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`/field${i}`, { path: 'draft with spaces.txt', media_type: 'text/plain' }])),
  ])('rejects invalid evidence at the protocol boundary', async evidence => {
    const result = await client.callTool({ name: 'reactive_emit_signal', arguments: { signal: 'CHECK', evidence } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).not.toContain('Exact evidence');
  });
});
