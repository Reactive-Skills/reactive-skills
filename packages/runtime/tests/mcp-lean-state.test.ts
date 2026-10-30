import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { ContextRouter } from '../src/core/context-router.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';
import { serializeStateResponse } from '../src/mcp/state-response.js';

const promptMarker = 'Follow this state instruction: 東京 🧭 "quoted"';
const hiddenMarker = 'Recorded data outside the state scope';

describe('MCP state delivery', () => {
  let tempDir: string;
  let skillDir: string;
  let client: Client;
  let server: ReturnType<typeof createReactiveMcpServer>;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-lean-state-'));
    skillDir = path.join(tempDir, 'skills', 'delivery-test');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), JSON.stringify({
      schema_version: 'reactive/v1',
      name: 'delivery-test',
      description: 'State transport fixture',
      initial_state: 'WORK',
      context_keys: ['visible', 'hidden'],
      default_context: { visible: 'State input', hidden: hiddenMarker },
      states: {
        WORK: {
          prompt_template: 'work.md',
          context_scope: ['visible'],
          tools: ['read_file'],
          transitions: { FINISH: 'DONE', UPDATE: 'WORK' },
        },
        DONE: {},
      },
    }));
    fs.writeFileSync(path.join(skillDir, 'work.md'), promptMarker);
    vi.spyOn(ContextRouter.prototype, 'route').mockResolvedValue({
      route: 'skill', skill: 'delivery-test', context_mode: 'active_state',
      context_budget_tokens: 2048, risk: 'standard', needs_deep_reasoning: false,
      needs_human_review: false, confidence: 1, adapter: 'jev',
    });
    server = createReactiveMcpServer({ workspaceDir: tempDir });
    client = new Client({ name: 'state-delivery-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await client.close();
    await server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(['reactive_state', 'reactive_context_prepare'])('%s delivers one prompt and scoped context in compact JSON', async (tool) => {
    const result = await client.callTool({
      name: tool,
      arguments: tool === 'reactive_state'
        ? { skill: 'delivery-test', output: 'legacy' }
        : { user_message: 'Run the delivery fixture', output: 'legacy' },
    });
    expect(result.isError).not.toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    const response = JSON.parse(text);
    const state = tool === 'reactive_state' ? response : response.context;
    expect(state.formattedXml).toContain(promptMarker);
    expect(JSON.stringify(response).split(JSON.stringify(promptMarker).slice(1, -1))).toHaveLength(2);
    expect(state).not.toHaveProperty('promptSlice');
    expect(state).not.toHaveProperty('context');
    expect(text).not.toContain(hiddenMarker);
    expect(state.scopedContext).toEqual({ visible: 'State input' });
    expect(state.allowedTools).toEqual(['read_file']);
    expect(state.activeState).toBe('WORK');
    expect(text).toBe(JSON.stringify(response));
    expect(state.metrics.slice_tokens_est).toBe(Math.ceil(Buffer.byteLength(text, 'utf8') / 4));
    expect(Buffer.byteLength(text, 'utf8')).toBeGreaterThan(text.length);
  });

  it('adds the full recorded context to reactive_state only with include_full_context', async () => {
    const result = await client.callTool({
      name: 'reactive_state', arguments: { skill: 'delivery-test', include_full_context: true, output: 'legacy' },
    });
    expect(result.isError).not.toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    const state = JSON.parse(text);
    expect(state).not.toHaveProperty('promptSlice');
    expect(state.formattedXml).toContain(promptMarker);
    expect(text.split(JSON.stringify(promptMarker).slice(1, -1))).toHaveLength(2);
    expect(state.context.hidden).toBe(hiddenMarker);
    expect(state.scopedContext).toEqual({ visible: 'State input' });
    expect(state.metrics.slice_tokens_est).toBe(Math.ceil(Buffer.byteLength(text, 'utf8') / 4));
  });

  it.each(['reactive_state', 'reactive_context_prepare'])('%s records the delivered estimate on the next transition', async (tool) => {
    const state = await client.callTool({
      name: tool,
      arguments: tool === 'reactive_state'
        ? { skill: 'delivery-test', job_id: 'delivery-run', output: 'legacy' }
        : { user_message: 'Run the delivery fixture', job_id: 'delivery-run', output: 'legacy' },
    });
    const text = (state.content as Array<{ text: string }>)[0].text;
    await client.callTool({ name: 'reactive_emit_signal', arguments: { skill: 'delivery-test', signal: 'FINISH', job_id: 'delivery-run', return_view: 'none' } });
    const events = await client.callTool({
      name: 'reactive_query_events',
      arguments: { skill: 'delivery-test', type: 'STATE_TRANSITION', job_id: 'delivery-run' },
    });
    const parsed = JSON.parse((events.content as Array<{ text: string }>)[0].text);
    expect(parsed.at(-1).payload.metrics.slice_tokens_est).toBe(Math.ceil(Buffer.byteLength(text, 'utf8') / 4));
  });

  it('refetches the persisted state prompt and scoped inputs in a fresh MCP session', async () => {
    const initial = await client.callTool({ name: 'reactive_state', arguments: { skill: 'delivery-test', job_id: 'refetch-run', output: 'legacy' } });
    const runId = JSON.parse((initial.content as Array<{ text: string }>)[0].text).run_id;
    const updated = await client.callTool({
      name: 'reactive_emit_signal',
      arguments: {
        skill: 'delivery-test', job_id: 'refetch-run', signal: 'UPDATE', return_view: 'none',
        payload: { contextUpdates: { visible: 'Latest persisted input', hidden: 'Updated unscoped data' } },
      },
    });
    expect(updated.isError).not.toBe(true);
    await client.close();
    await server.close();
    server = createReactiveMcpServer({ workspaceDir: tempDir });
    client = new Client({ name: 'refetch-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const refetched = await client.callTool({ name: 'reactive_state', arguments: { skill: 'delivery-test', job_id: runId, output: 'legacy' } });
    expect(refetched.isError).not.toBe(true);
    const text = (refetched.content as Array<{ text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.run_id).toBe(runId);
    expect(parsed.activeState).toBe('WORK');
    expect(parsed.formattedXml).toContain(promptMarker);
    expect(parsed.scopedContext).toEqual({ visible: 'Latest persisted input' });
    expect(parsed).not.toHaveProperty('promptSlice');
    expect(parsed).not.toHaveProperty('context');
    expect(text).not.toContain('Updated unscoped data');

    const fullResult = await client.callTool({
      name: 'reactive_state', arguments: { skill: 'delivery-test', job_id: runId, include_full_context: true, output: 'legacy' },
    });
    const full = JSON.parse((fullResult.content as Array<{ text: string }>)[0].text);
    expect(full.context.hidden).toBe('Updated unscoped data');
    expect(full.scopedContext).toEqual(parsed.scopedContext);
    expect(full).not.toHaveProperty('promptSlice');
  });

  it('estimates core XML from UTF-8 bytes instead of UTF-16 characters', () => {
    const engine = new FSMEngine({ skillDir, workspaceDir: tempDir, eventStore: new EventStore({ inMemory: true }) });
    try {
      const slice = engine.generatePromptSlice();
      expect(slice.metrics?.slice_tokens_est).toBe(Math.ceil(Buffer.byteLength(slice.formattedXml, 'utf8') / 4));
      expect(slice.metrics?.slice_tokens_est).toBeGreaterThan(Math.ceil(slice.formattedXml.length / 4));
    } finally {
      engine.close();
    }
  });
});

describe('MCP delivery estimate stabilization', () => {
  it.each([0, 330, 3900, 3990, 40000])('includes its own decimal digits for %i payload characters', (size) => {
    const payload = { prompt: '漢\\"\n'.repeat(size), metrics: { slice_tokens_est: 0 } };
    const text = serializeStateResponse(payload, payload.metrics);
    expect(JSON.parse(text).metrics.slice_tokens_est).toBe(Math.ceil(Buffer.byteLength(text, 'utf8') / 4));
  });
});
