import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { formatReceiptPaths } from '../src/mcp/continuation-response.js';

const outputs = ['.docs/jobs/receipt-run/summary.md'];
// Real SDK requests check both receipt path forms on every receipt exit.
describe('MCP receipt projection paths', () => {
  let workspace: string;
  let client: Client;
  let server: ReturnType<typeof createReactiveMcpServer>;
  beforeEach(async () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-receipt-paths-'));
    const skill = path.join(workspace, 'skills', 'receipt');
    fs.mkdirSync(path.join(skill, 'templates'), { recursive: true });
    fs.writeFileSync(path.join(skill, 'templates/summary.md.hbs'), 'State: {{currentState}}\n');
    fs.writeFileSync(path.join(skill, 'skill.yaml'), `
schema_version: reactive/v1
name: receipt
description: Receipt path fixture
initial_state: WORK
states:
  WORK:
    transitions:
      ASK: REVIEW
  REVIEW:
    human_gate: {type: choice, options: [Approve, Reject]}
    transitions:
      USER_APPROVED: DONE
      USER_REJECTED: WORK
  DONE:
    description: Finished
deliverable_projections:
  - template: templates/summary.md.hbs
    output: .docs/summary.md
`);
    server = createReactiveMcpServer({ workspaceDir: workspace, defaultSkill: 'receipt' });
    client = new Client({ name: 'receipt-paths-test', version: '1.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(b);
    await client.connect(a);
  });
  afterEach(async () => {
    await client.close();
    await server.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  async function call(name: string, args: Record<string, unknown> = {}) {
    const response = await client.callTool({ name, arguments: { job_id: 'receipt-run', ...args } });
    expect(response.isError, JSON.stringify(response.content)).not.toBe(true);
    return JSON.parse((response.content as Array<{ text: string }>)[0].text);
  }
  const absolute = (files: string[]) => files.map(file => path.join(workspace, file));
  const expectFound = (files: string[]) => { for (const file of files) expect(fs.existsSync(path.resolve(workspace, file))).toBe(true); };

  it.each([['delta-v1'], ['compact-v1']])('returns workspace-relative paths by default with return_view %s', async returnView => {
    const result = await call('reactive_emit_signal', { signal: 'ASK', return_view: returnView });
    expect(result.receipt.projectionsWritten).toEqual(outputs);
    expectFound(result.receipt.projectionsWritten);
  });

  it('advertises relative receipt paths and the workspace they resolve against', async () => {
    const capabilities = await call('reactive_capabilities');
    expect(capabilities.capabilities).toContain('receipt.relative_paths');
    const result = await call('reactive_emit_signal', { signal: 'ASK' });
    for (const file of result.receipt.projectionsWritten) expect(fs.existsSync(path.resolve(capabilities.workspace, file))).toBe(true);
  });

  it('returns workspace-relative paths on the legacy bare receipt', async () => {
    const receipt = await call('reactive_emit_signal', { signal: 'ASK', return_view: 'none' });
    expect(receipt.projectionsWritten).toEqual(outputs);
  });

  it('returns absolute paths when requested, on views and bare receipts', async () => {
    const viewed = await call('reactive_emit_signal', { signal: 'ASK', receipt_paths: 'absolute' });
    expect(viewed.receipt.projectionsWritten).toEqual(absolute(outputs));
    expectFound(viewed.receipt.projectionsWritten);
    const bare = await call('reactive_respond_human', { choice: 'Reject', approved: false, return_view: 'none', receipt_paths: 'absolute' });
    expect(bare.projectionsWritten).toEqual(absolute(outputs));
  });

  it('applies both forms to human responses', async () => {
    await call('reactive_emit_signal', { signal: 'ASK' });
    const rejected = await call('reactive_respond_human', { choice: 'Reject', approved: false });
    expect(rejected.receipt.projectionsWritten).toEqual(outputs);
    await call('reactive_emit_signal', { signal: 'ASK' });
    const approved = await call('reactive_respond_human', { choice: 'Approve', return_view: 'compact-v1', receipt_paths: 'absolute' });
    expect(approved.receipt.projectionsWritten).toEqual(absolute(outputs));
  });

  it('formats a saved receipt on retry as the retry requests, keeping absolute paths in the ledger', async () => {
    const first = await call('reactive_emit_signal', { signal: 'ASK', idempotency_key: 'retry-paths' });
    expect(first.receipt.projectionsWritten).toEqual(outputs);
    const retry = await call('reactive_emit_signal', { signal: 'ASK', idempotency_key: 'retry-paths', receipt_paths: 'absolute' });
    expect(retry.replayed).toBe(true);
    expect(retry.receipt.projectionsWritten).toEqual(absolute(outputs));
    const rows = await call('reactive_query', { sql: "SELECT payload FROM events WHERE type = 'MCP_CONTINUATION_RECORDED'" });
    expect(JSON.parse(rows[0].payload).receipt.projectionsWritten).toEqual(absolute(outputs));
  });
});

describe('formatReceiptPaths', () => {
  const root = path.resolve(os.tmpdir(), 'receipt-root');
  it('leaves paths outside the workspace, the workspace itself and missing lists unchanged', () => {
    const outside = [path.resolve(root, '..', 'elsewhere.md'), path.resolve(root, '..', 'receipt-root-sibling', 'a.md'), root];
    expect(formatReceiptPaths({ projectionsWritten: outside }, root).projectionsWritten).toEqual(outside);
    expect(formatReceiptPaths({ transitioned: false }, root)).toEqual({ transitioned: false });
  });
  it('keeps a file whose name starts with two dots inside the workspace', () => {
    expect(formatReceiptPaths({ projectionsWritten: [path.join(root, '..notes.md')] }, root).projectionsWritten).toEqual(['..notes.md']);
  });
  it('returns the receipt unchanged in absolute mode', () => {
    const receipt = { projectionsWritten: [path.join(root, '.docs', 'a.md')] };
    expect(formatReceiptPaths(receipt, root, 'absolute')).toBe(receipt);
  });
});
