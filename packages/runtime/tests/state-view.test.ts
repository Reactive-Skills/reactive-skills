import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TransitionDefinition } from '../src/core/types.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { createStateView, renderStateView } from '../src/core/state-view.js';
import { createStateResponse } from '../src/mcp/state-response.js';
import { createReactiveBootloader } from '../src/core/bootloader.js';

let root: string;
let skillDir: string;
let engine: FSMEngine | undefined;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'state-view-'));
  skillDir = path.join(root, 'skills', 'view-test');
  fs.mkdirSync(skillDir, { recursive: true });
});
afterEach(() => {
  engine?.close();
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});
function start(states: Record<string, unknown>, extra = {}) {
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), JSON.stringify({
    schema_version: 'reactive/v1', name: 'view-test', description: 'View contract fixture', initial_state: 'WORK', states, ...extra,
  }));
  return engine = new FSMEngine({ skillDir, workspaceDir: root });
}

it('retains exact guard, module, judgment options and child invocation once', () => {
  const judgment = { type: 'predicate', criterion: 'Evidence < acceptance & review', adapter_hint: 'script', min_probability: 0.9, timeout_ms: 50, context_paths: ['evidence'], include_payload: false };
  const runtime = start({ WORK: { transitions: {
    CHECK: { target: 'DONE', guard: 'event.payload.count < 3 && context.ready === true', guardFunction: 'guards/check.js', judgment, invoke: 'child' },
  } }, DONE: {} });
  const view = createStateView(runtime);
  expect(view.contracts[0]).toContain('guard: event.payload.count < 3 && context.ready === true');
  expect(view.contracts[0]).toContain('guardFunction: guards/check.js (inspect skill for payload requirements)');
  expect(view.contracts[0]).toContain(`judgment: ${JSON.stringify((runtime.getManifest().states.WORK.transitions!.CHECK as TransitionDefinition).judgment)}`);
  expect(view.contracts[0]).toContain('invoke: child');
  const xml = renderStateView(view, 'xml-v1');
  expect(xml).toContain('&lt; 3 &amp;&amp;');
  expect(xml).not.toContain('count < 3');
  expect(JSON.parse(renderStateView(view))).toEqual(view);
});

it.each([false, true])('legacy XML reports strict policy only when enabled: %s', (strict) => {
  const runtime = start({ WORK: {} }, { strict_execution: strict });
  const xml = runtime.generatePromptSlice().formattedXml;
  expect(xml.includes('<strict_execution')).toBe(strict);
  expect(xml.includes('</strict_execution>')).toBe(strict);
  expect(xml.includes('Strict mode counts delivered state views')).toBe(strict);
  expect(xml).not.toContain('Allowed tools are enforced');
});

it('returns full context only by request and replaces scoped context in compact output', () => {
  const runtime = start({ WORK: { context_scope: ['visible'] } }, { context_keys: ['visible', 'hidden'], default_context: { visible: 'retained', hidden: 'not scoped' } });
  const slice = runtime.generatePromptSlice();
  const scoped = createStateResponse(runtime, slice, false, 'compact-v1');
  expect(scoped.context).toEqual({ visible: 'retained' });
  const full = createStateResponse(runtime, slice, true, 'compact-v1');
  expect(full.context).toEqual({ visible: 'retained', hidden: 'not scoped' });
  expect(full).not.toHaveProperty('scopedContext');
  const legacy = createStateResponse(runtime, slice, true, 'legacy');
  expect(legacy).toHaveProperty('formattedXml');
  expect(legacy).toHaveProperty('scopedContext');
});

it('includes pending approval instructions after reopening without granting approval', () => {
  const runtime = start({ WORK: {} });
  const event = runtime.getEventStore().append('APPROVAL_REQUESTED', {
    state: 'WORK', signal: 'CHECK', target: 'DONE', criterion: 'Review evidence', judgmentType: 'predicate', reason: 'Adapter unavailable',
  }, { state: 'WORK' });
  const runId = runtime.getJobId();
  runtime.close();
  engine = new FSMEngine({ skillDir, workspaceDir: root, jobId: runId });
  const before = engine.getEventStore().getLatestSequence();
  const view = createStateView(engine);
  expect(view.approval_gate?.requests[0]).toMatchObject({ id: event.id, state: 'WORK', signal: 'CHECK', reason: 'Adapter unavailable' });
  expect(view.approval_gate?.instruction).toContain('Stop and ask a person');
  expect(view.approval_gate?.instruction).toContain(`--job ${runId}`);
  expect(engine.getEventStore().getLatestSequence()).toBe(before);
});

it('preserves refusal, human decision basis and self-report warnings in receipt views', () => {
  const runtime = start({ WORK: {} });
  const view = createStateView(runtime, undefined, { refusalReason: 'Need evidence', judgmentBasis: 'self_reported', warning: 'Self-reported decision' });
  expect(view).toMatchObject({ refusal: 'Need evidence', judgment_basis: 'self_reported', warning: 'Self-reported decision' });
  expect(createStateView(runtime)).not.toHaveProperty('refusal');
});

it('bootloader explicitly restores the same run after transcript compaction', () => {
  const text = createReactiveBootloader('view-test');
  expect(text).toContain('state.compact_v1');
  expect(text).toContain('After host transcript compaction, re-fetch the same immutable run');
  expect(text).toContain('Do not emit a transition, recreate an approval');
});

it.each(['accepted', 'unhandled'])('clears an earlier refusal when the next signal is %s', async (next) => {
  const runtime = start({ WORK: { transitions: { CHECK: { target: 'DONE', guard: 'event.payload.ok === true', guard_message: 'Need evidence' } } }, DONE: {} });
  await runtime.handleSignal('CHECK', { ok: false });
  expect(createStateView(runtime).refusal).toBe('Need evidence');
  await runtime.handleSignal(next === 'accepted' ? 'CHECK' : 'UNKNOWN', { ok: true });
  expect(createStateView(runtime)).not.toHaveProperty('refusal');
  const runId = runtime.getJobId();
  runtime.close();
  engine = new FSMEngine({ skillDir, workspaceDir: root, jobId: runId });
  expect(createStateView(engine)).not.toHaveProperty('refusal');
});
