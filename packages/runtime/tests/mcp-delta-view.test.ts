import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { contextChangesSince } from '../src/core/context-ledger.js';
import type { SignalEvent } from '../src/core/types.js';

const LARGE = 'Recorded intake notes. '.repeat(40);

// Real SDK requests exercise the anchored delivery path end to end.
describe('MCP ledger-anchored delta views', () => {
  let workspace: string;
  let server: ReturnType<typeof createReactiveMcpServer>;
  let client: Client;
  beforeEach(async () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-delta-'));
    const skill = path.join(workspace, 'skills', 'delta');
    fs.mkdirSync(skill, { recursive: true });
    fs.writeFileSync(path.join(skill, 'skill.yaml'), JSON.stringify({
      schema_version: 'reactive/v1', name: 'delta', description: 'Delta view fixture', initial_state: 'INTAKE',
      context_keys: ['notes', 'target', 'result'],
      default_context: { target: 'src/app.ts' },
      states: {
        INTAKE: { context_scope: ['notes'], transitions: { NOTED: 'BUILD' } },
        BUILD: { context_scope: ['notes', 'target', 'result'], transitions: { BUILT: 'BUILD', DONE: 'COMPLETED' } },
        COMPLETED: {},
      },
    }));
    server = createReactiveMcpServer({ workspaceDir: workspace, defaultSkill: 'delta' });
    client = new Client({ name: 'delta-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });
  afterEach(async () => {
    await client.close();
    await server.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  async function call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(result.isError, text).not.toBe(true);
    return JSON.parse(text);
  }

  it('sends the instructions plus changed and newly scoped context, and omits unchanged context', async () => {
    const first = await call('reactive_state', { output: 'compact-v1' });
    const toBuild = await call('reactive_emit_signal', { signal: 'NOTED', payload: { contextUpdates: { notes: LARGE } }, return_view: 'delta-v1' });
    expect(toBuild.view).toMatchObject({ format: 'delta-v1', state: 'BUILD', since_seq: first.seq });
    // target was outside the INTAKE scope, so the agent has not seen it; notes is the agent's own value.
    expect(toBuild.view.context).toEqual({ target: 'src/app.ts' });
    expect(toBuild.view.context_accepted).toEqual(['notes']);
    expect(JSON.stringify(toBuild)).not.toContain('Recorded intake notes');
    expect(toBuild.view.contracts.join('\n')).toContain('BUILD: DONE -> COMPLETED');
    const again = await call('reactive_emit_signal', { signal: 'BUILT', payload: { result: 'ok' }, return_view: 'delta-v1' });
    expect(again.view.format).toBe('delta-v1');
    expect(again.view.context).toEqual({});
    expect(again.view.context_accepted).toEqual(['result']);
    expect(JSON.stringify(again)).not.toContain('Recorded intake notes');
  });

  it('sends a supplied value that a later patch changed before commit', async () => {
    const skill = path.join(workspace, 'skills', 'delta', 'skill.yaml');
    const manifest = JSON.parse(fs.readFileSync(skill, 'utf8'));
    manifest.states.BUILD.on_enter = [{ set_context: { notes: 'normalized by entry hook' } }];
    fs.writeFileSync(skill, JSON.stringify(manifest));
    await call('reactive_state', { output: 'compact-v1', skill: 'delta' });
    const moved = await call('reactive_emit_signal', { signal: 'NOTED', payload: { contextUpdates: { notes: LARGE } }, return_view: 'delta-v1' });
    expect(moved.view.context).toEqual({ notes: 'normalized by entry hook', target: 'src/app.ts' });
    expect(moved.view).not.toHaveProperty('context_accepted');
  });

  it('answers reactive_state with since_seq as a delta and without it as the complete view', async () => {
    await call('reactive_state', { output: 'compact-v1' });
    const moved = await call('reactive_emit_signal', { signal: 'NOTED', payload: { contextUpdates: { notes: LARGE } }, return_view: 'delta-v1' });
    const delta = await call('reactive_state', { since_seq: moved.view.seq });
    expect(delta).toMatchObject({ format: 'delta-v1', state: 'BUILD', context: {} });
    const full = await call('reactive_state', { output: 'compact-v1' });
    expect(full.format).toBe('compact-v1');
    expect(full.context).toEqual({ notes: LARGE, target: 'src/app.ts' });
    // An anchor beyond this run's ledger cannot be trusted, so the complete view is returned.
    const future = await call('reactive_state', { since_seq: 1_000_000 });
    expect(future.format).toBe('compact-v1');
    expect(future.context).toEqual(full.context);
  });

  it('replays a retried submission with the complete view', async () => {
    await call('reactive_state', { output: 'compact-v1' });
    const args = { signal: 'NOTED', payload: { contextUpdates: { notes: LARGE } }, return_view: 'delta-v1', idempotency_key: 'noted-1' };
    const original = await call('reactive_emit_signal', args);
    expect(original.view.format).toBe('delta-v1');
    const retry = await call('reactive_emit_signal', args);
    expect(retry.replayed).toBe(true);
    expect(retry.view).toMatchObject({ format: 'compact-v1', context: { notes: LARGE, target: 'src/app.ts' } });
  });

  it('keeps the compact-v1 continuation output unchanged', async () => {
    await call('reactive_state', { output: 'compact-v1' });
    const result = await call('reactive_emit_signal', { signal: 'NOTED', payload: { contextUpdates: { notes: LARGE } }, return_view: 'compact-v1' });
    expect(result.view.format).toBe('compact-v1');
    expect(result.view).not.toHaveProperty('since_seq');
    expect(result.view.context).toEqual({ notes: LARGE, target: 'src/app.ts' });
  });
});

describe('ledger context fold', () => {
  const event = (seq: number, type: string, payload: Record<string, unknown>, extra: Partial<SignalEvent> = {}) =>
    ({ id: `e${seq}`, seq, type, payload, ...extra }) as unknown as SignalEvent;

  it('counts only committed patches and records the anchored path', () => {
    const changes = contextChangesSince([
      event(2, 'SIGNAL_EMITTED', { contextUpdates: { pending: 1 } }),
      event(3, 'SIGNAL_REFUSED', {}),
      event(4, 'STATE_TRANSITION', { from: 'A.B', to: 'C', contextUpdates: { done: true } }),
      event(5, 'STATE_ENTRY_HOOK', { action: { set_context: { entered: 1 } } }),
    ], []);
    expect(changes).toEqual({ keys: new Set(['done', 'entered']), anchorPath: ['A', 'B'] });
  });

  it('falls back to the committed signal for transitions recorded without a patch', () => {
    const changes = contextChangesSince([
      event(2, 'SIGNAL_EMITTED', { result: 'ok', contextUpdates: { extra: 1 } }),
      event(3, 'STATE_TRANSITION', { from: 'A', to: 'B' }, { causation_id: 'e2' } as Partial<SignalEvent>),
    ], ['result']);
    expect(changes?.keys).toEqual(new Set(['result', 'extra']));
  });

  it('requires the complete view when the window cannot be folded', () => {
    expect(contextChangesSince([event(3, 'STATE_TRANSITION', { from: 'A', to: 'B' }, { causation_id: 'e1' } as Partial<SignalEvent>)], [])).toBeNull();
    expect(contextChangesSince([event(3, 'SKILL_INITIALIZED', { active_path: ['A'], context: {} })], [])).toBeNull();
  });
});
