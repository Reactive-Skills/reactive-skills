import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { createStateView } from '../src/core/state-view.js';
import { TransitionSchema } from '../src/core/types.js';
import { inspectTransitionGuard, PayloadContractSchema, payloadContractError } from '../src/core/payload-contract.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { GuardEvaluator } from '../src/core/guard-evaluator.js';
import { evaluatePayloadGuard } from '../src/core/payload-guard.js';

const contract = {
  fields: { exit_code: { type: 'number', required: true, const: 0 } },
  relationships: [], evidence_source: 'test command result', refusal_hint: 'Run tests and submit the numeric exit code.',
};
let root: string;
let engine: FSMEngine;
afterEach(() => { engine?.close(); if (root) fs.rmSync(root, { recursive: true, force: true }); });
function start(transition: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-contract-'));
  const skillDir = path.join(root, 'skills', 'sample');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), JSON.stringify({
    schema_version: '1', name: 'sample', description: 'Payload contract fixture', initial_state: 'WORK',
    states: { WORK: { transitions: { TEST_RAN: transition } }, DONE: {} }, ...extra,
  }));
  engine = new FSMEngine({ skillDir, workspaceDir: root });
  return { skillDir };
}

it('builds a valid TDD payload from authored compact requirements and inspects the exact guard without events', async () => {
  const guard = 'event.payload.exit_code === 0';
  const { skillDir } = start({ target: 'DONE', guard, payload_contract: contract });
  const view = createStateView(engine);
  expect(view.contracts[0]).toContain(`payload: ${JSON.stringify(contract)}`);
  expect(view.contracts[0]).not.toContain(guard);
  const before = engine.getEventStore().getLatestSequence();
  expect(inspectTransitionGuard(engine.getManifest(), skillDir, 'WORK', 'TEST_RAN')).toMatchObject({ state: 'WORK', signal: 'TEST_RAN', guard });
  expect(engine.getEventStore().getLatestSequence()).toBe(before);
  const payload = Object.fromEntries(Object.entries(contract.fields).map(([name, field]) => [name, field.const]));
  expect((await engine.handleSignal('TEST_RAN', payload)).transitioned).toBe(true);
});

it.each([{}, { exit_code: '0' }, { exit_code: 1 }])('refuses invalid fields with actionable detail: %j', async payload => {
  start({ target: 'DONE', guard: 'event.payload.exit_code == 0', payload_contract: contract });
  const result = await engine.handleSignal('TEST_RAN', payload);
  expect(result.transitioned).toBe(false);
  expect(result.refusalReason).toContain('exit_code');
  expect(result.refusalReason).toContain(contract.refusal_hint);
});

it('an incomplete contract never bypasses a complex guard and legacy views retain its exact expression', async () => {
  const guard = 'event.payload.exit_code === 0 && event.payload.reviewed === true';
  start({ target: 'DONE', guard, payload_contract: contract });
  expect((await engine.handleSignal('TEST_RAN', { exit_code: 0 })).transitioned).toBe(false);
  engine.close();
  fs.rmSync(root, { recursive: true });
  start({ target: 'DONE', guard });
  expect(createStateView(engine).contracts[0]).toContain(guard);
});

it.each([
  { ...contract, fields: { exit_code: { type: 'number', const: '0' } } },
  { ...contract, fields: { exit_code: { type: 'invalid' } } },
  { ...contract, refusal_hint: '' },
  { ...contract, fields: { '': { type: 'number' } } },
  { ...contract, fields: { constructor: { type: 'number' } } },
])('rejects malformed declarations and obvious type/constant drift', payload_contract => {
  expect(TransitionSchema.safeParse({ target: 'DONE', payload_contract }).success).toBe(false);
});

it('MCP inspects only the owning transition and returns module source without executing it', async () => {
  const { skillDir } = start({ target: 'DONE', guardFunction: 'guards/check.cjs', payload_contract: contract });
  fs.mkdirSync(path.join(skillDir, 'guards'));
  const source = 'throw new Error("Inspection must not execute this module");';
  fs.writeFileSync(path.join(skillDir, 'guards/check.cjs'), source);
  const server = createReactiveMcpServer({ workspaceDir: root, defaultSkill: 'sample' });
  try {
    const tools = (server as any)._registeredTools;
    expect(JSON.parse((await tools.reactive_inspect.handler({}, {})).content[0].text)).toHaveProperty('states.WORK');
    const result = await tools.reactive_inspect.handler({ skill: 'sample', state: 'WORK', signal: 'TEST_RAN' }, {});
    expect(JSON.parse(result.content[0].text)).toMatchObject({ state: 'WORK', signal: 'TEST_RAN', guard_source: source });
    const missing = await tools.reactive_inspect.handler({ skill: 'sample', state: 'WORK' }, {});
    expect(missing.isError).toBe(true);
    expect((await tools.reactive_inspect.handler({ skill: 'sample', signal: 'TEST_RAN' }, {})).isError).toBe(true);
    expect((await tools.reactive_inspect.handler({ skill: 'missing-contract-inspection-fixture', state: 'WORK', signal: 'TEST_RAN' }, {})).isError).toBe(true);
  } finally { await server.close(); }
});

it.each(['full', 'snapshot'])('retains contracts, refusal and guard enforcement after %s recovery', async mode => {
  const { skillDir } = start({ target: 'DONE', guard: 'event.payload.exit_code === 0 && event.payload.reviewed === true', payload_contract: contract });
  await engine.handleSignal('TEST_RAN', { exit_code: 0 });
  if (mode === 'snapshot') engine.getEventStore().saveSnapshot(engine.getEventStore().getLatestSequence(), 'WORK', engine.getContext());
  const runId = engine.getJobId();
  engine.close();
  engine = new FSMEngine({ skillDir, workspaceDir: root, jobId: runId });
  expect(createStateView(engine).contracts[0]).toContain('payload:');
  expect(engine.getEventStore().getAll().some(event => event.type === 'SIGNAL_REFUSED' && String(event.payload.reason).includes(contract.refusal_hint))).toBe(true);
  expect((await engine.handleSignal('TEST_RAN', { exit_code: 0 })).transitioned).toBe(false);
  expect((await engine.handleSignal('TEST_RAN', { exit_code: 0, reviewed: true })).transitioned).toBe(true);
});

it('preserves leaf-first same-signal fall-through and identifies each owning condition', async () => {
  start({}, { initial_state: 'GROUP', states: {
    GROUP: { initial_substate: 'LEAF', transitions: { TEST_RAN: { target: 'DONE', guard: 'event.payload.exit_code === 1' } },
      substates: { LEAF: { transitions: { TEST_RAN: { target: 'DONE', guard: 'event.payload.exit_code === 0', payload_contract: contract } } } } }, DONE: {},
  } });
  const view = createStateView(engine);
  expect(view.contracts[0]).toContain('GROUP.LEAF: TEST_RAN');
  expect(view.contracts[1]).toContain('GROUP: TEST_RAN');
  expect((await engine.handleSignal('TEST_RAN', { exit_code: 1 })).transitioned).toBe(true);
});

it('inspection refuses missing owners, missing signals and module reads outside the skill', () => {
  const { skillDir } = start({ target: 'DONE', guardFunction: '../outside.cjs' });
  fs.writeFileSync(path.join(skillDir, '../outside.cjs'), 'module.exports = () => true;');
  expect(() => inspectTransitionGuard(engine.getManifest(), skillDir, 'ABSENT', 'TEST_RAN')).toThrow('Unknown owning state');
  expect(() => inspectTransitionGuard(engine.getManifest(), skillDir, 'WORK', 'ABSENT')).toThrow('No signal');
  expect(() => inspectTransitionGuard(engine.getManifest(), skillDir, 'WORK', 'TEST_RAN')).toThrow('inside the skill');
});

it.each([
  { guard: 'event.payload.exit_code === 1', payload_contract: contract },
  { guard: 'payload.exit_code === "0"', payload_contract: contract },
])('rejects a provably contradictory simple equality without deriving a schema', declaration => {
  expect(TransitionSchema.safeParse({ target: 'DONE', ...declaration }).success).toBe(false);
});

it('legacy XML uses authored requirements and exposes inspection guidance for opaque guards', () => {
  start({ target: 'DONE', guardFunction: 'guards/check.cjs', payload_contract: contract });
  expect(engine.generatePromptSlice().exitConditions[0]).toContain('payload:');
  engine.close();
  fs.rmSync(root, { recursive: true });
  start({ target: 'DONE', guardFunction: 'guards/check.cjs' });
  expect(engine.generatePromptSlice().exitConditions[0]).toContain('inspect skill for payload requirements');
});

it.each([
  ['string', 'text', 4], ['number', 0, '0'], ['boolean', false, 0],
  ['object', { nested: 1 }, []], ['array', [1], {}], ['null', null, false],
])('checks %s fields without coercion and permits omitted optional values', (type, valid, wrong) => {
  const parsed = PayloadContractSchema.parse({ ...contract, fields: { value: { type }, optional: { type: 'string', required: false } } });
  expect(payloadContractError(parsed, { value: valid })).toBeUndefined();
  expect(payloadContractError(parsed, { value: wrong })).toContain('value');
  expect(payloadContractError(parsed, { value: valid, optional: 0 })).toContain('optional');
  expect(payloadContractError(parsed, Object.create({ value: valid }))).toContain('value');
});

it.each([
  { guard: 'event.payload.other === 0', payload_contract: contract },
  { guard: 'event.payload.toString === null', payload_contract: contract },
  { guard: 'event.payload.exit_code === 00', payload_contract: contract },
  { guard: 'context.ready && event.payload.exit_code === 0', payload_contract: contract },
  { guard: 'event.payload.exit_code === 0' },
])('leaves unprovable drift to guard enforcement without claiming schema completeness', declaration => {
  expect(TransitionSchema.safeParse({ target: 'DONE', ...declaration }).success).toBe(true);
});

it('inspect supports unguarded string transitions and blocks symlinked source outside the skill', () => {
  const { skillDir } = start({}, { states: { WORK: { transitions: { NEXT: 'DONE', CHECK: { target: 'DONE', guardFunction: 'linked.cjs' } } }, DONE: {} } });
  expect(createStateView(engine).contracts[0]).toBe('WORK: NEXT -> DONE');
  expect(inspectTransitionGuard(engine.getManifest(), skillDir, 'WORK', 'NEXT')).toEqual({ state: 'WORK', signal: 'NEXT', target: 'DONE' });
  const outside = path.join(root, 'outside.cjs');
  fs.writeFileSync(outside, 'module.exports = () => true;');
  fs.symlinkSync(outside, path.join(skillDir, 'linked.cjs'));
  expect(() => inspectTransitionGuard(engine.getManifest(), skillDir, 'WORK', 'CHECK')).toThrow('inside the skill');
});

it('targeted MCP inspection opens no run and creates no ledger on a cold server', async () => {
  start({ target: 'DONE', guard: 'event.payload.exit_code === 0' });
  engine.close();
  fs.rmSync(path.join(root, '.reactive'), { recursive: true, force: true });
  const server = createReactiveMcpServer({ workspaceDir: root, defaultSkill: 'sample' });
  try {
    const result = await (server as any)._registeredTools.reactive_inspect.handler({ state: 'WORK', signal: 'TEST_RAN' }, {});
    expect(JSON.parse(result.content[0].text)).toMatchObject({ guard: 'event.payload.exit_code === 0' });
    expect(fs.existsSync(path.join(root, '.reactive'))).toBe(false);
  } finally { await server.close(); }
});

it('structural rejection never invokes judgment or grants its fallback and valid input preserves evaluator outcomes', async () => {
  const spy = vi.spyOn(GuardEvaluator, 'evaluate').mockResolvedValue({ passed: false });
  const evaluation = { event: { id: 'test', seq: 0, timestamp: '', type: 'SIGNAL', payload: {} }, context: {}, currentState: 'WORK' };
  try {
    expect((await evaluatePayloadGuard(contract, undefined, undefined, evaluation, { type: 'predicate', criterion: 'Check evidence' })).passed).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    evaluation.event.payload = { exit_code: 0 };
    expect((await evaluatePayloadGuard(contract, undefined, undefined, evaluation)).error).toContain('Guard refused.');
    spy.mockResolvedValueOnce({ passed: false, error: 'Existing rejection', fallbackTarget: 'REVISE', fallbackTriggered: true });
    expect(await evaluatePayloadGuard(contract, undefined, undefined, evaluation)).toMatchObject({ passed: false, fallbackTarget: 'REVISE', fallbackTriggered: true });
  } finally { spy.mockRestore(); }
});
