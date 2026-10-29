import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as runtime from '@reactive-skills/runtime';
import { stateCommand } from '../src/commands/state.js';
import { invokeCommand } from '../src/commands/invoke.js';
import { emitCommand } from '../src/commands/emit.js';

let root: string;
let skillDir: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'complete-state-view-'));
  skillDir = path.join(root, 'skills', 'complete-view');
  fs.mkdirSync(skillDir, { recursive: true });
  vi.stubEnv('WORKSPACE_DIR', root);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

// Non-interpolated scoped situation/evidence reproduce the recovery requirement.
const situation = 'SITUATION_SENTINEL 東京';
const evidence = 'EVIDENCE_SENTINEL ' + 'x'.repeat(4000);
const prompt = 'Read the recorded situation and evidence. {{context.rendered}}';
const cases = [
  { name: 'non-strict', strict: false },
  { name: 'guard refusal recovery', refuse: true },
  { name: 'strict', strict: true },
  { name: 'human gate', human: true },
  { name: 'model hint', model: true },
  { name: 'ancestor bubbling and same-signal fall-through', ancestor: true },
  { name: 'full context fallback', unscoped: true },
  { name: 'empty scope', empty: true },
  { name: 'snapshot recovery', restore: 'snapshot' },
  { name: 'event replay recovery', restore: 'replay' },
];

it.each(cases)('preserves complete meaning across SDK, MCP, AXI and XML: $name', async (testCase) => {
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), JSON.stringify({
    schema_version: 'reactive/v1', name: 'complete-view', description: 'Complete state view fixture',
    initial_state: 'ACTIVE', strict_execution: testCase.strict,
    context_keys: ['situation', 'evidence', 'rendered', 'unrelated'],
    default_context: { situation: testCase.restore ? 'before accepted update' : situation, evidence, rendered: 'rendered value', unrelated: 'OUTSIDE_SCOPE' },
    states: {
      ACTIVE: {
        initial_substate: 'WORK', tools: ['read_file'],
        ...(testCase.unscoped ? {} : { context_scope: testCase.empty ? [] : ['situation'] }),
        transitions: testCase.ancestor ? { CHECK: 'DONE', ABORT: 'DONE' } : {},
        substates: {
          WORK: {
            prompt_template: 'work.md', tools: ['write_file', 'read_file'],
            ...(testCase.unscoped ? {} : { context_scope: testCase.empty ? [] : ['evidence', 'rendered'] }),
            ...(testCase.human ? { human_gate: { type: 'choice', tool: 'chat', prompt: 'Choose next action', options: ['Continue', 'Stop'] } } : {}),
            ...(testCase.model ? { model: { tier: 'reasoning', temperature: 0.2 } } : {}),
            transitions: { UPDATE: 'ACTIVE.WORK', CHECK: { target: 'DONE', guard: 'event.payload.exit_code === 0', guard_message: 'A passing result is required' } },
          },
        },
      },
      DONE: {},
    },
  }));
  fs.writeFileSync(path.join(skillDir, 'work.md'), prompt);
  let engine = new runtime.FSMEngine({ skillDir, workspaceDir: root });
  const runId = engine.getJobId();
  if (testCase.restore) {
    const snapshotWrite = testCase.restore === 'replay' ? vi.spyOn(engine.getEventStore(), 'saveSnapshot').mockImplementation(() => {}) : undefined;
    await engine.handleSignal('UPDATE', { contextUpdates: { situation } });
    snapshotWrite?.mockRestore();
    engine.close();
    engine = new runtime.FSMEngine({ skillDir, workspaceDir: root, jobId: runId });
  }
  if (testCase.refuse) {
    await engine.handleSignal('CHECK', { exit_code: 1 });
    engine.close();
    engine = new runtime.FSMEngine({ skillDir, workspaceDir: root, jobId: runId });
  }
  const slice = engine.generatePromptSlice();
  expect(runtime).toHaveProperty('createStateView');
  const view = runtime.createStateView(engine, slice);
  expect(view.refusal).toBe(testCase.refuse ? 'A passing result is required' : undefined);
  expect(view.prompt).toBe(slice.rawPrompt);
  expect(view.context).toEqual(slice.scopedContext);
  expect(view.tools).toEqual(['read_file', 'write_file']);
  expect(view.contracts[1]).toContain('ACTIVE.WORK: CHECK -> DONE; guard: event.payload.exit_code === 0');
  expect(view.policy).toContain('compaction');
  expect(view.policy).toContain('host adapter');
  expect(view.strict !== undefined).toBe(!!testCase.strict);
  expect(view.human_gate !== undefined).toBe(!!testCase.human);
  expect(view.model !== undefined).toBe(!!testCase.model);
  if (testCase.human) {
    expect(view.human_gate.options).toEqual(['Continue', 'Stop']);
    expect(view.human_gate.instruction).toContain('STOP');
  }
  if (testCase.ancestor) expect(view.contracts.slice(2)).toEqual(['ACTIVE: CHECK -> DONE', 'ACTIVE: ABORT -> DONE']);
  const xml = runtime.renderStateView(view, 'xml-v1');
  for (const [key, value] of Object.entries(view)) {
    const encoded = typeof value === 'string' ? value : JSON.stringify(value);
    const escaped = encoded.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    expect(xml).toContain(`<${key}>${escaped}</${key}>`);
  }
  const beforeSeq = engine.getEventStore().getLatestSequence();
  engine.close();

  const devCli = fileURLToPath(new URL('../../../packages/runtime/dist/cli/index.js', import.meta.url));
  const dev = spawnSync(process.execPath, [devCli, 'state', skillDir, '--output', 'xml-v1'], { cwd: root, env: { ...process.env, REACTIVE_JOB_ID: runId }, encoding: 'utf8' });
  expect(dev.status, dev.stderr).toBe(0);
  // Strict state deliveries increment the existing idle counter before rendering.
  const devXml = dev.stdout.replace(/<seq>\d+<\/seq>/, `<seq>${view.seq}</seq>`).replace(/<strict>.*<\/strict>/, view.strict ? `<strict>${JSON.stringify(view.strict)}</strict>` : '');
  expect(devXml.trimEnd()).toBe(xml);
  const axi = JSON.parse(await stateCommand([skillDir, '--job', runId!, '--output', 'compact-v1']));
  expect({ ...axi, seq: view.seq, strict: view.strict }).toEqual(view);
  const server = runtime.createReactiveMcpServer({ workspaceDir: root });
  try {
    const result = await (server as any)._registeredTools.reactive_state.handler({ skill: 'complete-view', job_id: runId, output: 'compact-v1' });
    const mcp = JSON.parse(result.content[0].text);
    // MCP strict view accounting remains transport-specific.
    expect({ ...mcp, seq: view.seq, strict: view.strict }).toEqual(view);
    expect(result.content[0].text.split(JSON.stringify(view.prompt).slice(1, -1))).toHaveLength(2);
    expect(mcp).not.toHaveProperty('formattedXml');
    expect(mcp).not.toHaveProperty('scopedContext');
    if (!testCase.strict) {
      vi.spyOn(runtime.ContextRouter.prototype, 'route').mockResolvedValue({
        route: 'skill', skill: 'complete-view', context_mode: 'active_state', context_budget_tokens: 128,
        risk: 'standard', needs_deep_reasoning: false, needs_human_review: false, confidence: 1, adapter: 'jev',
      });
      const prepared = await (server as any)._registeredTools.reactive_context_prepare.handler({ user_message: 'Load state', job_id: runId, output: 'compact-v1' });
      expect(JSON.parse(prepared.content[0].text).context).toEqual({ status: 'ready', source: 'reactive_state', ...view });
    }
  } finally { await server.close(); }
  if (!testCase.strict) {
    const restored = new runtime.FSMEngine({ skillDir, workspaceDir: root, jobId: runId });
    expect(restored.getEventStore().getLatestSequence()).toBe(beforeSeq);
    if (!testCase.empty) expect(axi.context).toMatchObject({ situation, evidence });
    if (testCase.empty) expect(axi.context).toEqual({});
    if (testCase.unscoped) expect(axi.context.unrelated).toBe('OUTSIDE_SCOPE');
    else expect(axi.context).not.toHaveProperty('unrelated');
    const outcome = await restored.handleSignal('CHECK', { exit_code: 1 });
    if (testCase.ancestor) expect(outcome.newState).toBe('DONE');
    else {
      expect(outcome.transitioned).toBe(false);
      expect(runtime.createStateView(restored, undefined, outcome).refusal).toBe('A passing result is required');
    }
    restored.close();
  }
  const legacy = await stateCommand([skillDir, '--job', runId!, '--output', 'legacy']);
  expect(legacy).toContain('raw_prompt:');
});

it('returns the shared view from AXI invoke and emit including refusals', async () => {
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), JSON.stringify({
    schema_version: 'reactive/v1', name: 'complete-view', description: 'Continuation fixture', initial_state: 'WORK',
    states: { WORK: { transitions: { CHECK: { target: 'DONE', guard: 'event.payload.exit_code === 0', guard_message: 'Need passing result' } } }, DONE: {} },
  }));
  const initial = JSON.parse(await invokeCommand([skillDir, '--output', 'compact-v1', '--payload', '{"situation":"recorded"}']));
  expect(initial.context.situation).toBe('recorded');
  const refused = JSON.parse(await emitCommand([skillDir, 'CHECK', '{"exit_code":1}', '--job', initial.run_id, '--output', 'compact-v1']));
  expect(refused.view.refusal).toBe('Need passing result');
  expect(refused.view.state).toBe('WORK');
  const next = JSON.parse(await emitCommand([skillDir, 'CHECK', '{"exit_code":0}', '--job', initial.run_id, '--output', 'compact-v1']));
  expect(next.view.state).toBe('DONE');
  expect(next.view).not.toHaveProperty('refusal');
});

it.each([stateCommand, invokeCommand, emitCommand])('rejects unsupported output selection without opening a run', async (command) => {
  const result = await command([skillDir, '--output', 'unknown']);
  expect(result).toContain('VALIDATION_ERROR');
  expect(fs.existsSync(path.join(root, '.reactive'))).toBe(false);
});

it('restores populated build-advisor DIAGNOSE context in AXI with an empty transcript', async () => {
  // Public build-advisor scope excerpt: ACTIVE.ADVISE.DIAGNOSE requires recorded
  // situation/evidence even though its markdown says only to use those keys.
  const scope = ['selected_runtime', 'basis_version', 'route', 'situation', 'evidence', 'diagnosis'];
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), JSON.stringify({
    schema_version: 'reactive/v1', name: 'complete-view', description: 'Public advisory scope regression',
    initial_state: 'ACTIVE', context_keys: [...scope, 'story'],
    default_context: { selected_runtime: { transport: 'axi' }, basis_version: 1, route: 'advise', situation: { decision: situation }, evidence: [{ claim: evidence }], diagnosis: null, story: 'EXCLUDED_STORY' },
    states: { ACTIVE: { initial_substate: 'ADVISE', substates: { ADVISE: { initial_substate: 'DIAGNOSE', substates: { DIAGNOSE: { context_scope: scope, prompt_template: 'diagnose.md', model: { tier: 'reasoning' } } } } } } },
  }));
  fs.writeFileSync(path.join(skillDir, 'diagnose.md'), '# Diagnose the decision\nUse context.situation and evidence.');
  const initial = new runtime.FSMEngine({ skillDir, workspaceDir: root });
  const runId = initial.getJobId();
  initial.close();
  const view = JSON.parse(await stateCommand([skillDir, '--job', runId!, '--output', 'compact-v1']));
  expect(view.state).toBe('ACTIVE.ADVISE.DIAGNOSE');
  expect(view.prompt).not.toContain(situation);
  expect(view.prompt).not.toContain(evidence);
  expect(view.context.situation.decision).toBe(situation);
  expect(view.context.evidence[0].claim).toBe(evidence);
  expect(view.context).not.toHaveProperty('story');
});
