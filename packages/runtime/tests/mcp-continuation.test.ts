import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { JudgmentEngine } from '../src/core/judgment-engine.js';
import { grantSelfReport } from '../src/core/approval-grants.js';
import { EventStore } from '../src/core/event-store.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { submitHumanResponse } from '../src/mcp/human-response.js';
import { continuationResponse, signalReceipt, unavailableReceipt } from '../src/mcp/continuation-response.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';

// Real SDK requests exercise schema negotiation as well as handler behavior.
describe('MCP complete continuation views', () => {
  let workspace: string;
  const clients: Client[] = [];
  const servers: ReturnType<typeof createReactiveMcpServer>[] = [];
  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-continuation-'));
    const skill = path.join(workspace, 'skills', 'continuation');
    fs.mkdirSync(path.join(skill, 'states'), { recursive: true });
    fs.writeFileSync(path.join(skill, 'skill.yaml'), `
schema_version: reactive/v1
name: continuation
description: Continuation protocol fixture
initial_state: WORK
strict_execution: true
context_keys: [value, user_choice]
states:
  WORK:
    prompt_template: states/work.md
    transitions:
      CHECK: {target: NEXT, guard: 'event.payload.exit_code === 0', guard_message: 'Supply exit_code zero'}
      AGAIN: WORK
      ASK: REVIEW
      NEST: CHAIN
      CHILD: {target: NEXT, invoke: skills/child}
      SLOW: {target: NEXT, guardFunction: guards/paused.mjs}
  CHAIN:
    on_enter:
      - emit_signal: DRAIN
    transitions:
      DRAIN: NEXT
  NEXT:
    prompt_template: states/next.md
    transitions:
      FINISH: COMPLETED
  REVIEW:
    human_gate: {type: choice, options: [Approve, Reject]}
    transitions:
      USER_APPROVED: NEXT
      USER_REJECTED: WORK
  COMPLETED:
    description: Finished
`);
    fs.writeFileSync(path.join(skill, 'states/work.md'), 'Perform the work.');
    fs.writeFileSync(path.join(skill, 'states/next.md'), 'Verify the next step.');
    fs.mkdirSync(path.join(skill, 'guards'));
    // Signals that evaluation started, then stays pending until the test writes the release marker.
    fs.writeFileSync(path.join(skill, 'guards/paused.mjs'), `import fs from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
export default async function guard({ skillDir }) {
  fs.writeFileSync(path.join(skillDir, 'started'), '');
  while (!fs.existsSync(path.join(skillDir, 'release'))) await setTimeout(10);
  return true;
}
`);
    const child = path.join(workspace, 'skills', 'child');
    fs.mkdirSync(child);
    fs.writeFileSync(path.join(child, 'skill.yaml'), `schema_version: reactive/v1
name: child
description: Child fixture
initial_state: READY
states:
  READY: {description: Child ready}
`);
  });
  afterEach(async () => {
    for (const client of clients.splice(0)) await client.close();
    for (const server of servers.splice(0)) await server.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    JudgmentEngine.reset();
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  async function connect() {
    const server = createReactiveMcpServer({ workspaceDir: workspace, defaultSkill: 'continuation' });
    const client = new Client({ name: 'continuation-test', version: '1.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(b);
    await client.connect(a);
    servers.push(server);
    clients.push(client);
    return client;
  }
  async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
    const response = await client.callTool({ name, arguments: { job_id: 'continuation-run', ...args } });
    expect(response.isError, JSON.stringify(response.content)).not.toBe(true);
    return JSON.parse((response.content as Array<{text: string}>)[0].text);
  }
  async function events(client: Client) {
    return call(client, 'reactive_query', { sql: 'SELECT type, payload, causation_id FROM events ORDER BY seq' });
  }
  const count = (rows: Array<{type: string}>, type: string) => rows.filter(row => row.type === type).length;
  const emit = (client: Client, signal: string, extra: Record<string, unknown> = {}) =>
    call(client, 'reactive_emit_signal', { signal, return_view: 'compact-v1', ...extra });

  it.each([
    ['CHECK', { exit_code: 0 }, 'NEXT', true, 1, 1],
    ['CHECK', { exit_code: 1 }, 'WORK', false, 1, 0],
    ['AGAIN', {}, 'WORK', true, 1, 1],
    ['UNKNOWN', {}, 'WORK', false, 1, 0],
    ['ASK', {}, 'REVIEW', true, 1, 1],
    ['NEST', {}, 'NEXT', true, 2, 2],
    ['CHILD', {}, 'NEXT', true, 1, 1],
  ])('delivers actual settled state for %s exactly once', async (signal, payload, state, transitioned, signals, transitions) => {
    const client = await connect();
    const initial = await call(client, 'reactive_state', { output: 'compact-v1' });
    const result = await emit(client, signal, { payload });
    expect(result.receipt.transitioned).toBe(transitioned);
    expect(result.replayed).toBe(false);
    expect(result.view.state).toBe(state);
    expect(result.view.run_id).toBe(initial.run_id);
    expect(result.view.strict.turns_since_signal).toBe(1);
    expect(result.result_view).toEqual({ run_id: initial.run_id, seq: result.view.seq });
    expect(result.view.prompt).toBeTruthy();
    if (signal === 'CHECK' && !transitioned) expect(result.view.refusal).toContain('Supply exit_code zero');
    if (signal === 'ASK') expect(result.view.human_gate.instruction).toContain('STOP');
    const rows = await events(client);
    expect(count(rows, 'SIGNAL_EMITTED')).toBe(signals);
    expect(count(rows, 'STATE_TRANSITION')).toBe(transitions);
    expect(count(rows, 'AGENT_TURN_STARTED')).toBe(2);
    expect(count(rows, 'STATE_VIEW_REFETCHED')).toBe(0);
    expect(count(rows, 'CHILD_RUN_STARTED')).toBe(signal === 'CHILD' ? 1 : 0);
  });

  it('preserves legacy receipts and advertises opt-in continuation schemas', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    for (const name of ['reactive_emit_signal', 'reactive_respond_human']) {
      expect(tools.find(tool => tool.name === name)?.inputSchema.properties).toHaveProperty('return_view');
    }
    expect((await call(client, 'reactive_capabilities')).capabilities).toContain('state.continuation_v1');
    const receipt = await call(client, 'reactive_emit_signal', { signal: 'AGAIN' });
    expect(receipt.newState).toBe('WORK');
    expect(receipt.view).toBeUndefined();
    expect(receipt.receipt).toBeUndefined();
    expect(count(await events(client), 'AGENT_TURN_STARTED')).toBe(0);
  });

  it.each([false, true])('retries a lost response across reconnect=%s without any ledger writes, distinguishing original from current view', async reopen => {
    const client = await connect();
    const args = { payload: { exit_code: 0 }, idempotency_key: 'check-once' };
    const original = await emit(client, 'CHECK', args);
    await emit(client, 'FINISH');
    const before = await events(client);
    const retry = await emit(reopen ? await connect() : client, 'CHECK', args);
    expect(retry.replayed).toBe(true);
    expect(retry.receipt).toEqual(original.receipt);
    expect(retry.result_view).toEqual(original.result_view);
    expect(retry.view.state).toBe('COMPLETED');
    expect(retry.view.run_id).toBe(original.view.run_id);
    expect(retry.view.seq).toBeGreaterThan(retry.result_view.seq);
    expect(await events(client)).toEqual(before);
  });

  it('counts continuation as the delivery before two bounded compaction refetches', async () => {
    const client = await connect();
    const result = await emit(client, 'AGAIN');
    for (let i = 0; i < 2; i++) {
      const refetch = await call(client, 'reactive_state', { output: 'compact-v1', job_id: result.view.run_id });
      expect(refetch.seq).toBe(result.view.seq);
      expect(refetch.strict.turns_since_signal).toBe(1);
    }
    expect((await call(client, 'reactive_state', { output: 'compact-v1' })).strict.turns_since_signal).toBe(2);
    const response = await client.callTool({ name: 'reactive_state', arguments: { job_id: result.view.run_id } });
    expect(response.isError).toBe(true);
    const rows = await events(client);
    expect(count(rows, 'AGENT_TURN_STARTED')).toBe(3);
    expect(count(rows, 'STATE_VIEW_REFETCHED')).toBe(2);
    expect(count(rows, 'BYPASS_DETECTED')).toBe(1);
  });

  it('settles human dispatch once and retains retry provenance after later progress', async () => {
    const client = await connect();
    await emit(client, 'ASK');
    const args = { choice: 'Approve', idempotency_key: 'human-once', return_view: 'compact-v1' };
    const result = await call(client, 'reactive_respond_human', args);
    expect(result.receipt.signalsEmitted).toEqual(['USER_RESPONSE', 'USER_APPROVED']);
    expect(result.view.state).toBe('NEXT');
    expect(result.view.human_gate).toBeUndefined();
    expect(result.view.strict.turns_since_signal).toBe(1);
    const rows = await events(client);
    expect(count(rows, 'DECISION_RECORDED')).toBe(1);
    expect(count(rows, 'SIGNAL_EMITTED')).toBe(3);
    expect(count(rows, 'AGENT_TURN_STARTED')).toBe(2);
    await emit(client, 'FINISH');
    const before = await events(client);
    const retry = await call(await connect(), 'reactive_respond_human', args);
    expect(retry.replayed).toBe(true);
    expect(retry.receipt).toEqual(result.receipt);
    expect(retry.view.state).toBe('COMPLETED');
    expect(await events(client)).toEqual(before);
  });

  it('serializes competing clients and duplicate keys per immutable run', async () => {
    const [a, b] = [await connect(), await connect()];
    await call(a, 'reactive_state', { output: 'compact-v1' });
    const results = await Promise.all([emit(a, 'AGAIN', { idempotency_key: 'race' }), emit(b, 'AGAIN', { idempotency_key: 'race' })]);
    expect(results.map(result => result.replayed).sort()).toEqual([false, true]);
    expect(results[0].receipt).toEqual(results[1].receipt);
    const rows = await events(a);
    expect(count(rows, 'SIGNAL_EMITTED')).toBe(1);
    expect(count(rows, 'STATE_TRANSITION')).toBe(1);
    expect(count(rows, 'AGENT_TURN_STARTED')).toBe(2);
  });
  it('follows the pinned public TDD path with one initial fetch and one emit per state', async () => {
    fs.cpSync(new URL('../scripts/transport-benchmark/fixtures/tdd-refactor/', import.meta.url), path.join(workspace, 'skills', 'tdd-refactor'), { recursive: true });
    const client = await connect();
    const initial = await call(client, 'reactive_state', { skill: 'tdd-refactor', output: 'compact-v1' });
    expect(initial.state).toBe('INIT');
    expect(initial.prompt).toContain('Verify access to the reactive runtime.');
    const steps = [
      ['RUNTIME_READY', {}, 'RED_SPEC', 'Failing Specification'],
      ['TEST_RAN', { exit_code: 1 }, 'GREEN_CODE', 'Minimal Passing Implementation'],
      ['TEST_RAN', { exit_code: 0 }, 'REFACTOR.CLEAN_CODE', 'Structure & Readability'],
      ['CLEANING_DONE', {}, 'REFACTOR.PERF_AUDIT', 'Performance'],
      ['AUDIT_PASSED', {}, 'AUDIT_VERIFY', 'Verification'],
      ['ALL_CHECKS_PASSED', { exit_code: 0 }, 'COMPLETED', 'Delivery Finalized'],
    ] as const;
    for (const [signal, payload, state, instruction] of steps) {
      const result = await emit(client, signal, { skill: 'tdd-refactor', job_id: initial.run_id, payload });
      expect(result.receipt.transitioned).toBe(true);
      expect(result.view.state).toBe(state);
      expect(result.view.prompt.toLowerCase()).toContain(instruction.toLowerCase());
      expect(result.view.context).toHaveProperty('target_file', 'src/auth.ts');
      expect(result.view.strict.turns_since_signal).toBe(1);
      for (const output of result.receipt.projectionsWritten) expect(fs.existsSync(output)).toBe(true);
    }
    const rows = await call(client, 'reactive_query', { skill: 'tdd-refactor', job_id: initial.run_id, sql: 'SELECT type FROM events ORDER BY seq' });
    expect(count(rows, 'AGENT_TURN_STARTED')).toBe(7);
    expect(count(rows, 'STATE_TRANSITION')).toBe(6);
    expect(count(rows, 'SIGNAL_EMITTED')).toBe(11);
    expect(count(rows, 'STATE_VIEW_REFETCHED')).toBe(0);
    expect(count(rows, 'MCP_CONTINUATION_RECORDED')).toBe(0);
  });

  it.each(['replay', 'snapshot'])('restores continuation delivery and refusal through %s without a transcript', async recovery => {
    const client = await connect();
    await emit(client, 'AGAIN');
    const first = await emit(client, 'CHECK', { payload: { exit_code: 1 }, idempotency_key: 'refused-once' });
    const store = new EventStore({ workspaceDir: workspace, skillId: 'continuation', jobId: first.view.run_id, enableSqlite: true });
    expect(store.getLatestSnapshot()).toBeTruthy();
    if (recovery === 'replay') vi.spyOn(store, 'getLatestSnapshot').mockReturnValue(null);
    const engine = new FSMEngine({ skillDir: path.join(workspace, 'skills', 'continuation'), workspaceDir: workspace, jobId: first.view.run_id, eventStore: store });
    try {
      const original = store.getEventByIdempotencyKey('refused-once')!;
      const retry = JSON.parse(continuationResponse(engine, first.receipt, original));
      expect(retry.replayed).toBe(true);
      expect(retry.receipt).toEqual(first.receipt);
      expect(retry.view.refusal).toBe(first.view.refusal);
      expect(retry.view.strict.turns_since_signal).toBe(1);
    } finally {
      engine.close();
    }
  });

  it.each(['replay', 'snapshot'])('restores recovered delivery credits through %s without scanning full history', async recovery => {
    const skillDir = path.join(workspace, 'skills', 'continuation');
    const original = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: 'recovered-reopen' });
    const result = await original.handleSignal('CHECK', { exit_code: 0 }, { idempotencyKey: 'lost' });
    const first = JSON.parse(continuationResponse(original, unavailableReceipt(result.event), result.event));
    expect(first.view.strict.turns_since_signal).toBe(1);
    original.close();
    const store = new EventStore({ workspaceDir: workspace, skillId: 'continuation', jobId: first.view.run_id, enableSqlite: true });
    if (recovery === 'replay') vi.spyOn(store, 'getLatestSnapshot').mockReturnValue(null);
    const restored = new FSMEngine({ skillDir, workspaceDir: workspace, eventStore: store });
    try {
      const fullScan = vi.spyOn(store, 'getAll');
      const version = store.getRunVersion();
      const retry = JSON.parse(continuationResponse(restored, unavailableReceipt(result.event), result.event));
      expect(retry.view.strict.turns_since_signal).toBe(1);
      expect(restored.generatePromptSlice().formattedXml).toContain('Views since signal: 1');
      expect(store.getRunVersion()).toBe(version);
      expect(fullScan).not.toHaveBeenCalled();
      await restored.handleSignal('FINISH');
      expect(restored.getTurnsSinceLastSignal()).toBe(0);
      const later = JSON.parse(continuationResponse(restored, unavailableReceipt(result.event), result.event));
      expect(later.view.state).toBe('COMPLETED');
      expect(later.view.strict.turns_since_signal).toBe(1);
      expect(JSON.parse(continuationResponse(restored, unavailableReceipt(result.event), result.event)).view.strict.turns_since_signal).toBe(1);
    } finally {
      restored.close();
    }
  });

  it('counts a later recovered view even when the same submission delivered an earlier view', async () => {
    const skillDir = path.join(workspace, 'skills', 'continuation');
    const engine = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: 'later-recovery' });
    try {
      const result = await engine.handleSignal('CHECK', { exit_code: 0 }, { idempotencyKey: 'old-key' });
      // Interruption after the first delivery, before the continuation receipt is saved.
      engine.recordStateDelivery(`${result.event.id}:DELIVERY`);
      await engine.handleSignal('FINISH');
      const before = engine.getEventStore().getLatestSequence();
      const retry = JSON.parse(continuationResponse(engine, unavailableReceipt(result.event), result.event));
      expect(retry.view.state).toBe('COMPLETED');
      expect(retry.view.strict.turns_since_signal).toBe(1);
      expect(JSON.parse(continuationResponse(engine, unavailableReceipt(result.event), result.event)).view.strict.turns_since_signal).toBe(1);
      expect(engine.getEventStore().getLatestSequence()).toBe(before);
    } finally {
      engine.close();
    }
  });

  it('rejects stale view delivery instead of appending a turn or receipt', async () => {
    const skillDir = path.join(workspace, 'skills', 'continuation');
    const stale = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: 'stale-view' });
    const other = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: stale.getJobId() });
    try {
      const result = await other.handleSignal('AGAIN');
      const before = other.getEventStore().getLatestSequence();
      expect(() => continuationResponse(stale, { transitioned: true }, result.event)).toThrow('RUN_VERSION_CONFLICT');
      await expect(submitHumanResponse(stale, { choice: 'Approve', approved: true })).rejects.toThrow('RUN_VERSION_CONFLICT');
      expect(other.getEventStore().getLatestSequence()).toBe(before);
    } finally {
      stale.close();
      other.close();
    }
  });

  it('counts one delivery when a duplicate from another process recovers before the original delivers', async () => {
    const skillDir = path.join(workspace, 'skills', 'continuation');
    const winner = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: 'cross-process' });
    try {
      winner.recordStateDelivery();
      const result = await winner.handleSignal('CHECK', { exit_code: 0 }, { idempotencyKey: 'cross', source: 'mcp' });
      const duplicate = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: winner.getJobId() });
      try {
        const existing = duplicate.getEventStore().getEventByIdempotencyKey('cross')!;
        const before = duplicate.getEventStore().getLatestSequence();
        const retry = JSON.parse(continuationResponse(duplicate, unavailableReceipt(existing), existing));
        expect(duplicate.getEventStore().getLatestSequence()).toBe(before);
        const original = JSON.parse(continuationResponse(winner, { ...signalReceipt(winner, result), event_id: result.event.id }, result.event));
        expect(original.replayed).toBe(false);
        expect(retry.replayed).toBe(true);
        expect(retry.view.state).toBe('NEXT');
        expect([original.view.strict.turns_since_signal, retry.view.strict.turns_since_signal]).toEqual([1, 1]);
        const rows = duplicate.getEventStore().getAll();
        expect(count(rows, 'SIGNAL_EMITTED')).toBe(1);
        expect(count(rows, 'STATE_TRANSITION')).toBe(1);
        expect(count(rows, 'AGENT_TURN_STARTED')).toBe(2);
        expect(count(rows, 'STATE_VIEW_REFETCHED')).toBe(0);
        expect(count(rows, 'MCP_CONTINUATION_RECORDED')).toBe(1);
      } finally {
        duplicate.close();
      }
    } finally {
      winner.close();
    }
  });

  it('does not transition again when another process commits the same key after the lookup', async () => {
    const skillDir = path.join(workspace, 'skills', 'continuation');
    const winner = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: 'cross-transition' });
    const duplicate = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: winner.getJobId() });
    try {
      const store = duplicate.getEventStore();
      const append = store.append.bind(store);
      let original: any;
      // The winner commits its keyed signal between the duplicate's lookup and its own keyed append.
      vi.spyOn(store, 'append').mockImplementationOnce((type, payload, metadata) => {
        original = winner.getEventStore().append('SIGNAL_EMITTED', { signal: 'CHECK', exit_code: 0 }, { idempotencyKey: 'race', source: 'mcp', state: 'WORK' });
        return append(type, payload, metadata);
      });
      const replay = await duplicate.handleSignal('CHECK', { exit_code: 0 }, { idempotencyKey: 'race', source: 'mcp' });
      expect(replay.transitioned).toBe(false);
      expect(replay.event.id).toBe(original.id);
      expect(duplicate.getCurrentState()).toBe('WORK');
      const rows = store.getAll();
      expect(count(rows, 'SIGNAL_EMITTED')).toBe(1);
      expect(count(rows, 'GUARD_EVALUATED')).toBe(0);
      expect(count(rows, 'STATE_TRANSITION')).toBe(0);
    } finally {
      duplicate.close();
      winner.close();
    }
  });

  it('appends nothing for a duplicate while the original keyed guard is pending', async () => {
    const client = await connect();
    const initial = await call(client, 'reactive_state', { output: 'compact-v1' });
    const skillDir = path.join(workspace, 'skills', 'continuation');
    const winner = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: initial.run_id });
    try {
      const pending = winner.handleSignal('SLOW', {}, { idempotencyKey: 'pending', source: 'mcp' });
      await vi.waitFor(() => expect(fs.existsSync(path.join(skillDir, 'started'))).toBe(true));
      const before = await events(client);
      const original = winner.getEventStore().getEventByIdempotencyKey('pending')!;
      const duplicate = await emit(client, 'SLOW', { idempotency_key: 'pending' });
      expect(duplicate.receipt).toEqual(unavailableReceipt(original));
      expect(duplicate.replayed).toBe(true);
      expect(duplicate.result_view).toBeNull();
      expect(duplicate.view.state).toBe('WORK');
      expect(duplicate.view.strict.turns_since_signal).toBe(1);
      const repeated = await emit(await connect(), 'SLOW', { idempotency_key: 'pending' });
      expect(repeated.view.strict.turns_since_signal).toBe(1);
      expect(await events(client)).toEqual(before);
      fs.writeFileSync(path.join(skillDir, 'release'), '');
      const won = await pending;
      expect(won.transitioned).toBe(true);
      expect(won.newState).toBe('NEXT');
      const owned = JSON.parse(continuationResponse(winner, { ...signalReceipt(winner, won), event_id: original.id }, original));
      expect(owned.replayed).toBe(false);
      expect(owned.receipt.transitioned).toBe(true);
      expect(owned.view.state).toBe('NEXT');
      const rows = await events(client);
      expect(count(rows, 'SIGNAL_EMITTED')).toBe(1);
      expect(count(rows, 'GUARD_EVALUATED')).toBe(1);
      expect(count(rows, 'STATE_TRANSITION')).toBe(1);
      expect(count(rows, 'MCP_CONTINUATION_RECORDED')).toBe(1);
      expect(count(rows, 'AGENT_TURN_STARTED')).toBe(count(before, 'AGENT_TURN_STARTED') + 1);
    } finally {
      winner.close();
    }
  });

  it('keeps slow recovered view rendering from invalidating a pending guard', async () => {
    const skillDir = path.join(workspace, 'skills', 'continuation');
    const winner = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: 'slow-recovery' });
    let duplicate: FSMEngine | undefined;
    const pending = winner.handleSignal('SLOW', {}, { idempotencyKey: 'slow-render', source: 'mcp' });
    try {
      await vi.waitFor(() => expect(fs.existsSync(path.join(skillDir, 'started'))).toBe(true));
      duplicate = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: winner.getJobId(), perfThresholds: { maxSliceDurationMs: -1 } });
      const store = duplicate.getEventStore();
      const event = store.getEventByIdempotencyKey('slow-render')!;
      const before = store.getRunVersion();
      const view = JSON.parse(continuationResponse(duplicate, unavailableReceipt(event), event));
      expect(view.view.strict.turns_since_signal).toBe(1);
      expect(store.getRunVersion()).toBe(before);
      expect(store.query({ type: 'PERF_DEGRADATION' })).toHaveLength(0);
      fs.writeFileSync(path.join(skillDir, 'release'), '');
      expect((await pending).transitioned).toBe(true);
    } finally {
      fs.writeFileSync(path.join(skillDir, 'release'), '');
      await pending.catch(() => undefined);
      duplicate?.close();
      winner.close();
    }
  });

  it('absorbs only the matching view when recovery delivers both a pending and refused guard', async () => {
    const skillDir = path.join(workspace, 'skills', 'continuation');
    const guardPath = path.join(skillDir, 'guards/paused.mjs');
    fs.writeFileSync(guardPath, fs.readFileSync(guardPath, 'utf8').replace('return true;', 'return false;'));
    const winner = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: 'refused-recovery' });
    const pending = winner.handleSignal('SLOW', {}, { idempotencyKey: 'refused-recovery', source: 'mcp' });
    try {
      await vi.waitFor(() => expect(fs.existsSync(path.join(skillDir, 'started'))).toBe(true));
      const duplicate = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: winner.getJobId() });
      try {
        const event = duplicate.getEventStore().getEventByIdempotencyKey('refused-recovery')!;
        const initial = JSON.parse(continuationResponse(duplicate, unavailableReceipt(event), event));
        expect(initial.view.strict.turns_since_signal).toBe(1);
      } finally {
        duplicate.close();
      }
      fs.writeFileSync(path.join(skillDir, 'release'), '');
      const result = await pending;
      expect(result.transitioned).toBe(false);
      const refused = JSON.parse(continuationResponse(winner, unavailableReceipt(result.event), result.event));
      expect(refused.view.strict.turns_since_signal).toBe(2);
      const original = JSON.parse(continuationResponse(winner, { ...signalReceipt(winner, result), event_id: result.event.id }, result.event));
      expect(original.view.seq).toBe(refused.view.seq);
      expect(original.view.strict.turns_since_signal).toBe(2);
      expect(winner.getEventStore().countRecoveredDeliveries(3)).toBe(1);
    } finally {
      fs.writeFileSync(path.join(skillDir, 'release'), '');
      await pending.catch(() => undefined);
      winner.close();
    }
  });

  it.each(['CHECK', 'AGAIN'])('preserves the saved receipt for immediate retry of %s', async signal => {
    const client = await connect();
    const args = { payload: { exit_code: 1 }, idempotency_key: 'retry-now' };
    const first = await emit(client, signal, args);
    const before = await events(client);
    const retry = await emit(client, signal, args);
    expect(retry.receipt).toEqual(first.receipt);
    expect(retry.result_view).toEqual(first.result_view);
    expect(retry.view.state).toBe(first.view.state);
    expect(retry.view.strict.turns_since_signal).toBe(1);
    expect(await events(client)).toEqual(before);
  });

  it('keeps human legacy receipt fields and keyed cross-tool collisions explicit', async () => {
    const client = await connect();
    await call(client, 'reactive_emit_signal', { signal: 'ASK' });
    const receipt = await call(client, 'reactive_respond_human', { choice: 'Reject', approved: false });
    expect(Object.keys(receipt).sort()).toEqual(['currentState', 'projectionsWritten', 'signalsEmitted', 'transitioned', 'unpaused']);
    expect(receipt.currentState).toBe('WORK');
    await emit(client, 'AGAIN', { idempotency_key: 'shared-key' });
    const before = await events(client);
    const conflict = await client.callTool({ name: 'reactive_respond_human', arguments: { job_id: 'continuation-run', choice: 'Approve', idempotency_key: 'shared-key', return_view: 'compact-v1' } });
    expect(conflict.isError).toBe(true);
    expect(await events(client)).toEqual(before);
  });

  it('delivers terminal results on the active run without rotating it', async () => {
    const client = await connect();
    const first = await call(client, 'reactive_state', { job_id: undefined, output: 'compact-v1' });
    await emit(client, 'CHECK', { job_id: undefined, payload: { exit_code: 0 } });
    const terminal = await emit(client, 'FINISH', { job_id: undefined, idempotency_key: 'terminal-once' });
    expect(terminal.view.state).toBe('COMPLETED');
    expect(terminal.view.run_id).toBe(first.run_id);
    const retried = await emit(client, 'FINISH', { job_id: undefined, idempotency_key: 'terminal-once' });
    expect(retried.view.run_id).toBe(first.run_id);
    expect(retried.receipt).toEqual(terminal.receipt);
    const jobs = await call(client, 'reactive_list_jobs', { job_id: undefined });
    expect(jobs.jobs).toHaveLength(1);
  });

  it('includes required non-interpolated scoped context once in the next view', async () => {
    const manifest = path.join(workspace, 'skills', 'continuation', 'skill.yaml');
    const yaml = fs.readFileSync(manifest, 'utf8').replace('  NEXT:\n', '  NEXT:\n    context_scope: [value]\n');
    fs.writeFileSync(manifest, yaml);
    const result = await emit(await connect(), 'CHECK', { payload: { exit_code: 0, value: 'required-recovery-sentinel' }, idempotency_key: 'scoped-once' });
    expect(result.view.context.value).toBe('required-recovery-sentinel');
    expect(result.view.prompt).not.toContain('required-recovery-sentinel');
    expect(JSON.stringify(result).match(/required-recovery-sentinel/g)).toHaveLength(1);
    expect(result.view).not.toHaveProperty('formattedXml');
    expect(result.view).not.toHaveProperty('scopedContext');
    const recovered = await emit(await connect(), 'CHECK', { idempotency_key: 'scoped-once' });
    expect(recovered.view.context).toEqual(result.view.context);
  });

  it.each([false, true])('retains model gate or self-report warning with grant=%s on keyed retry', async granted => {
    vi.stubEnv('HOME', path.join(workspace, 'home'));
    vi.stubEnv('USERPROFILE', path.join(workspace, 'home'));
    vi.stubEnv('TYPESAFE_API_KEY', undefined);
    JudgmentEngine.reset();
    JudgmentEngine.registerAdapter({ id: 'jev', supports: () => true, isConfigured: () => false, isAvailable: async () => false, evaluate: async () => { throw new Error('Offline test must never evaluate a model'); } });
    const manifest = path.join(workspace, 'skills', 'continuation', 'skill.yaml');
    fs.writeFileSync(manifest, fs.readFileSync(manifest, 'utf8').replace('      AGAIN: WORK', `      REVIEW_OUTPUT:
        target: NEXT
        judgment: {type: predicate, criterion: 'The output satisfies the requested specification'}
      AGAIN: WORK`));
    if (granted) grantSelfReport(workspace, 'interactive_terminal');
    const client = await connect();
    const args = { payload: { exit_code: 0 }, idempotency_key: 'judgment-once' };
    const first = await emit(client, 'REVIEW_OUTPUT', args);
    expect(first.receipt.transitioned).toBe(granted);
    if (granted) {
      expect(first.receipt.judgmentBasis).toBe('self_reported');
      expect(first.view.judgment_basis).toBe('self_reported');
      expect(first.view.warning).toMatch(/own report/);
    } else {
      expect(first.view.approval_gate.requests).toHaveLength(1);
      expect(first.view.approval_gate.instruction).toContain('Stop and ask a person');
    }
    const before = await events(client);
    const retry = await emit(await connect(), 'REVIEW_OUTPUT', args);
    expect(retry.receipt).toEqual(first.receipt);
    expect(count(await events(client), 'APPROVAL_REQUESTED')).toBe(granted ? 0 : 1);
    expect(await events(client)).toEqual(before);
  });

  it('keeps settled views associated with each competing distinct request', async () => {
    const [a, b] = [await connect(), await connect()];
    await call(a, 'reactive_state', { output: 'compact-v1' });
    const [check, finish] = await Promise.all([
      emit(a, 'CHECK', { payload: { exit_code: 0 }, idempotency_key: 'client-check' }),
      emit(b, 'FINISH', { idempotency_key: 'client-finish' }),
    ]);
    expect(check.view.state).toBe('NEXT');
    expect(finish.view.state).toBe('COMPLETED');
    const rows = await events(a);
    expect(count(rows, 'SIGNAL_EMITTED')).toBe(2);
    expect(count(rows, 'STATE_TRANSITION')).toBe(2);
    expect(count(rows, 'AGENT_TURN_STARTED')).toBe(3);
  });

  it('marks an older receipt unavailable when a legacy key is retried in continuation mode', async () => {
    const client = await connect();
    await call(client, 'reactive_emit_signal', { signal: 'CHECK', payload: { exit_code: 0 }, idempotency_key: 'legacy-once' });
    await emit(client, 'FINISH');
    const before = await events(client);
    const retry = await emit(client, 'CHECK', { idempotency_key: 'legacy-once' });
    expect(retry.replayed).toBe(true);
    expect(retry.receipt.result_unavailable).toBe(true);
    expect(retry.receipt).not.toHaveProperty('transitioned');
    expect(retry.result_view).toBeNull();
    expect(retry.view.state).toBe('COMPLETED');
    expect(await events(client)).toEqual(before);
  });

  it.each([
    ['emit', 'recordStateDelivery', 1],
    ['emit', 'generatePromptSlice', 1],
    ['human', 'recordStateDelivery', 1],
    ['human', 'generatePromptSlice', 1],
  ] as const)('recovers an interrupted keyed %s after %s with one durable delivery without inventing its result', async (operation, interrupted, turns) => {
    const client = await connect();
    if (operation === 'human') await emit(client, 'ASK');
    const tool = operation === 'emit' ? 'reactive_emit_signal' : 'reactive_respond_human';
    const args = operation === 'emit'
      ? { signal: 'CHECK', payload: { exit_code: 0 }, idempotency_key: 'interrupted', return_view: 'compact-v1' }
      : { choice: 'Approve', approved: true, idempotency_key: 'interrupted', return_view: 'compact-v1' };
    vi.spyOn(FSMEngine.prototype, interrupted).mockImplementationOnce(() => { throw new Error('RUN_VERSION_CONFLICT: interrupted'); });
    const lost = await client.callTool({ name: tool, arguments: { job_id: 'continuation-run', ...args } });
    expect(lost.isError).toBe(true);
    const before = await events(client);
    expect(count(before, 'MCP_CONTINUATION_RECORDED')).toBe(0);
    const retry = await call(await connect(), tool, args);
    expect(retry.replayed).toBe(true);
    expect(retry.receipt.result_unavailable).toBe(true);
    expect(retry.receipt).not.toHaveProperty('transitioned');
    expect(retry.receipt).not.toHaveProperty('refusalReason');
    expect(retry.result_view).toBeNull();
    expect(retry.view.state).toBe('NEXT');
    expect(retry.view).not.toHaveProperty('refusal');
    expect(retry.view.strict.turns_since_signal).toBe(turns);
    const after = await events(client);
    expect(after).toEqual(before);
    const again = await call(await connect(), tool, args);
    expect(again.receipt).toEqual(retry.receipt);
    expect(again.view.strict.turns_since_signal).toBe(1);
    expect(await events(client)).toEqual(after);
    // Recovery supplies the first delivery; the same two repeat fetches remain free.
    for (let i = 0; i < 2; i++) {
      expect((await call(client, 'reactive_state', { output: 'compact-v1' })).strict.turns_since_signal).toBe(1);
    }
    expect((await call(client, 'reactive_state', { output: 'compact-v1' })).strict.turns_since_signal).toBe(2);
    const bypass = await client.callTool({ name: 'reactive_state', arguments: { skill_name: 'continuation', job_id: 'continuation-run', output: 'compact-v1' } });
    expect(bypass.isError).toBe(true);
    expect(JSON.stringify(bypass)).toContain('BYPASS_DETECTED');
  });

  it.each([false, true])('human reply to an unhandled gate returns refusal and stop instructions with strict=%s', async strict => {
    const manifest = path.join(workspace, 'skills', 'continuation', 'skill.yaml');
    fs.writeFileSync(manifest, fs.readFileSync(manifest, 'utf8').replace('strict_execution: true', `strict_execution: ${strict}`).replace('      USER_APPROVED: NEXT', '      OTHER_APPROVAL: NEXT'));
    const client = await connect();
    await emit(client, 'ASK');
    const result = await call(client, 'reactive_respond_human', { choice: 'Approve', return_view: 'compact-v1', idempotency_key: 'refused-human' });
    expect(result.receipt.transitioned).toBe(false);
    expect(result.view.state).toBe('REVIEW');
    expect(result.view.human_gate.instruction).toContain('STOP');
    expect(result.view.refusal).toContain('No applicable transition');
    const rows = await events(client);
    expect(count(rows, 'AGENT_TURN_STARTED')).toBe(strict ? 2 : 0);
    expect(count(rows, 'SIGNAL_EMITTED')).toBe(3);
  });

  it('preserves approval default precedence and supports keyed legacy human retries', async () => {
    const client = await connect();
    await emit(client, 'ASK');
    const args = { choice: 'Reject', idempotency_key: 'legacy-human' };
    const first = await call(client, 'reactive_respond_human', args);
    expect(first.signalsEmitted).toEqual(['USER_RESPONSE', 'USER_APPROVED']);
    expect(first.currentState).toBe('NEXT');
    const before = await events(client);
    const retry = await call(await connect(), 'reactive_respond_human', args);
    expect(retry).toEqual(first);
    expect(await events(client)).toEqual(before);
  });

  it('resumes a recorded human decision using its original values', async () => {
    const client = await connect();
    const waiting = await emit(client, 'ASK');
    const engine = new FSMEngine({ skillDir: path.join(workspace, 'skills', 'continuation'), workspaceDir: workspace, jobId: waiting.view.run_id });
    try {
      engine.getEventStore().append('DECISION_RECORDED', { choice: 'Reject', approved: false }, { source: 'human_ingress', idempotencyKey: 'interrupted-human' });
      const response = await call(client, 'reactive_respond_human', { choice: 'Approve', approved: true, idempotency_key: 'interrupted-human', return_view: 'compact-v1' });
      expect(response.receipt.signalsEmitted).toEqual(['USER_RESPONSE', 'USER_REJECTED']);
      expect(response.view.state).toBe('WORK');
      expect(response.view.context.user_choice).toBe('Reject');
      const rows = await events(client);
      expect(count(rows, 'DECISION_RECORDED')).toBe(1);
      expect(count(rows, 'SIGNAL_EMITTED')).toBe(3);
      expect(count(rows, 'AGENT_TURN_STARTED')).toBe(2);
    } finally {
      engine.close();
    }
  });

  it('counts a recovered human view after completing the remaining signal of an interrupted batch', async () => {
    const client = await connect();
    const waiting = await emit(client, 'ASK');
    const engine = new FSMEngine({ skillDir: path.join(workspace, 'skills', 'continuation'), workspaceDir: workspace, jobId: waiting.view.run_id });
    try {
      const decision = engine.getEventStore().append('DECISION_RECORDED', { choice: 'Approve', approved: true }, { source: 'human_ingress', idempotencyKey: 'partial-human' });
      await engine.handleSignal('USER_RESPONSE', decision.payload, { source: 'human_ingress', causationId: decision.id, idempotencyKey: `${decision.id}:USER_RESPONSE` });
    } finally {
      engine.close();
    }
    const args = { choice: 'Approve', approved: true, idempotency_key: 'partial-human', return_view: 'compact-v1' };
    const retry = await call(await connect(), 'reactive_respond_human', args);
    expect(retry.receipt.result_unavailable).toBe(true);
    expect(retry.view.state).toBe('NEXT');
    expect(retry.view.strict.turns_since_signal).toBe(1);
    const before = await events(client);
    expect(count(before, 'DECISION_RECORDED')).toBe(1);
    expect(count(before, 'SIGNAL_EMITTED')).toBe(3);
    const again = await call(await connect(), 'reactive_respond_human', args);
    expect(again.view.strict.turns_since_signal).toBe(1);
    expect(await events(client)).toEqual(before);
  });

  it.each(['', 'Review the recorded evidence'])('preserves empty choice and feedback-only response behavior: %s', async feedback => {
    const client = await connect();
    await emit(client, 'ASK');
    const response = await call(client, 'reactive_respond_human', { choice: '', feedback, return_view: 'compact-v1' });
    expect(response.view.state).toBe('NEXT');
    expect(response.receipt.signalsEmitted).toEqual(['USER_RESPONSE', 'USER_APPROVED']);
    expect(count(await events(client), 'DECISION_RECORDED')).toBe(feedback ? 1 : 0);
    if (feedback) expect(response.view.context.user_feedback).toBe(feedback);
  });

  it('keeps immutable run routing available in a receipt when no alias is available', async () => {
    const engine = new FSMEngine({ skillDir: path.join(workspace, 'skills', 'continuation'), workspaceDir: workspace });
    try {
      vi.spyOn(engine, 'getJobName').mockReturnValue(undefined);
      const result = await engine.handleSignal('AGAIN');
      expect(signalReceipt(engine, result)).toMatchObject({ run_id: engine.getJobId(), job_id: engine.getJobId() });
    } finally {
      engine.close();
    }
  });

  it.each([
    [0, 0],
    [5, 0],
    [30, 30],
  ])('keeps the view anchor bounded with %s bookkeeping-only trailing events', (length, expected) => {
    const store = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir: path.join(workspace, 'skills', 'continuation'), workspaceDir: workspace, eventStore: store });
    try {
      const types = ['AGENT_TURN_STARTED', 'STATE_VIEW_REFETCHED', 'MCP_CONTINUATION_RECORDED', 'PERF_DEGRADATION', 'PROJECTION_FAILED'];
      const tail = Array.from({ length }, (_, i) => ({ id: `metadata-${i}`, seq: i + 1, timestamp: '', type: types[i % types.length], payload: {} }));
      // A frozen driver window models an empty store or an anchor older than the bounded tail.
      vi.spyOn(store, 'getLatestSequence').mockReturnValue(length);
      vi.spyOn(store, 'getSince').mockImplementation(seq => tail.filter(event => event.seq > seq));
      const fullScan = vi.spyOn(store, 'getAll');
      expect(engine.getStateViewSeq()).toBe(expected);
      expect(fullScan).not.toHaveBeenCalled();
    } finally {
      engine.close();
    }
  });

  it('retains an earlier self-report warning when a human batch transitions again deterministically', async () => {
    vi.stubEnv('HOME', path.join(workspace, 'home'));
    vi.stubEnv('USERPROFILE', path.join(workspace, 'home'));
    vi.stubEnv('TYPESAFE_API_KEY', undefined);
    JudgmentEngine.reset();
    JudgmentEngine.registerAdapter({ id: 'jev', supports: () => true, isConfigured: () => false, isAvailable: async () => false, evaluate: async () => { throw new Error('Offline test must never evaluate a model'); } });
    grantSelfReport(workspace, 'interactive_terminal');
    const manifest = path.join(workspace, 'skills', 'continuation', 'skill.yaml');
    fs.writeFileSync(manifest, fs.readFileSync(manifest, 'utf8')
      .replace('      USER_APPROVED: NEXT', `      USER_RESPONSE:
        target: NEXT
        judgment: {type: categorical, criterion: 'Choose the recorded review decision', options: [Approve]}`)
      .replace('      FINISH: COMPLETED', '      FINISH: COMPLETED\n      USER_APPROVED: COMPLETED'));
    const client = await connect();
    await emit(client, 'ASK');
    const result = await call(client, 'reactive_respond_human', { choice: 'Approve', approved: true, return_view: 'compact-v1', idempotency_key: 'batch-warning' });
    expect(result.view.state).toBe('COMPLETED');
    expect(result.receipt.judgmentBasis).toBe('self_reported');
    expect(result.receipt.warning).toMatch(/own report/);
    expect(result.view.warning).toBe(result.receipt.warning);
    const rows = await events(client);
    expect(count(rows, 'SIGNAL_EMITTED')).toBe(3);
    expect(count(rows, 'STATE_TRANSITION')).toBe(3);
    expect(count(rows, 'AGENT_TURN_STARTED')).toBe(2);
    const retry = await call(await connect(), 'reactive_respond_human', { choice: 'Approve', return_view: 'compact-v1', idempotency_key: 'batch-warning' });
    expect(retry.receipt).toEqual(result.receipt);
  });

});
