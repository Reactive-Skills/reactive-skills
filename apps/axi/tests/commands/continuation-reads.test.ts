import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventStore, FSMEngine, createReactiveBootloader, createAxiFirstBypassState, createSortableId } from '@reactive-skills/runtime';
import { stateCommand } from '../../src/commands/state.js';
import { invokeCommand } from '../../src/commands/invoke.js';
import { emitCommand } from '../../src/commands/emit.js';
import { getSuggestions } from '../../src/suggestions.js';

let workspace: string;
let originalCwd: string;
let skillDir: string;
beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-continuation-reads-'));
  originalCwd = process.cwd();
  process.chdir(workspace);
  skillDir = path.join(workspace, 'skills', 'directory-name');
  fs.mkdirSync(skillDir, { recursive: true });
  vi.stubEnv('WORKSPACE_DIR', workspace);
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), JSON.stringify({
    schema_version: 'reactive/v1', name: 'anchor-skill', description: 'Causation anchor fixture',
    initial_state: 'WORK', context_keys: ['evidence'], default_context: { evidence: 'RECORDED_EVIDENCE' },
    states: {
      WORK: { context_scope: ['evidence'], prompt_template: 'work.md', transitions: {
        UPDATE: 'WORK', CHECK: { target: 'DONE', guard: 'event.payload.exit_code === 0', guard_message: 'Supply exit_code: 0' },
      } }, DONE: {},
    },
  }));
  fs.writeFileSync(path.join(skillDir, 'work.md'), 'Use the recorded evidence.');
});
afterEach(() => {
  process.chdir(originalCwd);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(workspace, { recursive: true, force: true });
});

it.each(['snapshot', 'replay'] as const)('reads only the latest resolved-run anchor after %s recovery', async (restore) => {
  if (restore === 'replay') vi.spyOn(EventStore.prototype, 'saveSnapshot').mockImplementation(() => {});
  const engine = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: createSortableId(), jobName: 'selected' });
  const runId = engine.getJobId()!;
  const store = engine.getEventStore();
  await engine.handleSignal('UPDATE');
  const latest = store.getLatestEvent()!;
  engine.close();
  // A newer event in the shared skill ledger must never become this run's anchor.
  const other = new FSMEngine({ skillDir, workspaceDir: workspace, jobId: createSortableId(), jobName: 'other' });
  await other.handleSignal('UPDATE');
  other.close();
  const all = vi.spyOn(EventStore.prototype, 'getAll');
  const handle = vi.spyOn(FSMEngine.prototype, 'handleSignal');
  for (const identifier of [skillDir, 'directory-name', path.join('skills', 'directory-name')]) {
    for (const output of ['legacy', 'compact-v1']) {
      all.mockClear();
      const response = await stateCommand([identifier, '--job', 'selected', '--output', output]);
      expect(response).not.toContain('RUNTIME_ERROR');
      expect(response).toContain(runId);
      if (output === 'legacy') expect(response).toContain(`event_id: ${latest.id}`);
      // Full replay is allowed for restoration, never merely to find an anchor.
      expect(all).toHaveBeenCalledTimes(restore === 'replay' ? 1 : 0);
    }
  }
  all.mockClear();
  const result = JSON.parse(await emitCommand(['directory-name', 'CHECK', '{"exit_code":1}', '--job', 'selected', '--output', 'compact-v1']));
  expect(result.view.run_id).toBe(runId);
  expect(result.view.refusal).toBe('Supply exit_code: 0');
  expect(result.view.context).toEqual({ evidence: 'RECORDED_EVIDENCE' });
  expect(handle).toHaveBeenCalledWith('CHECK', { exit_code: 1 }, expect.objectContaining({ causationId: latest.id }));
  expect(all).toHaveBeenCalledTimes(restore === 'replay' ? 1 : 0);
});

it('invokes with a bounded latest-event lookup and preserves the explicit emit anchor', async () => {
  const original = EventStore.prototype.getAll;
  const all = vi.spyOn(EventStore.prototype, 'getAll').mockImplementation(function (this: EventStore) {
    // Fresh run initialization may replay; output assembly may not scan history.
    if (!new Error().stack?.includes('FSMEngine')) throw new Error('Full history read for response anchor');
    return original.call(this);
  });
  const output = await invokeCommand([skillDir, '--job', 'new-run']);
  expect(output).toContain('invoke:');
  expect(output).not.toContain('RUNTIME_ERROR');
  expect(output).toMatch(/event_id: [0-9a-f-]+/);
  all.mockRestore();
  const handle = vi.spyOn(FSMEngine.prototype, 'handleSignal');
  const latest = vi.spyOn(EventStore.prototype, 'getLatestEvent');
  const explicit = '00000000-0000-7000-8000-000000000001';
  await emitCommand([skillDir, explicit, 'CHECK', '{"exit_code":1}', '--job', 'new-run']);
  expect(handle).toHaveBeenCalledWith('CHECK', { exit_code: 1 }, expect.objectContaining({ causationId: explicit }));
  expect(latest).not.toHaveBeenCalled();
});

it('runs the pinned public TDD continuation and resumes the immutable terminal run', async () => {
  const publicDir = path.join(workspace, 'skills', 'tdd-refactor');
  fs.cpSync(new URL('../../../../packages/runtime/scripts/transport-benchmark/fixtures/tdd-refactor/', import.meta.url), publicDir, { recursive: true });
  const initial = JSON.parse(await invokeCommand([publicDir, '--output', 'compact-v1']));
  expect(initial.state).toBe('INIT');
  for (const [signal, payload, state] of [
    ['RUNTIME_READY', {}, 'RED_SPEC'],
    ['TEST_RAN', { exit_code: 1 }, 'GREEN_CODE'],
    ['TEST_RAN', { exit_code: 0 }, 'REFACTOR.CLEAN_CODE'],
    ['CLEANING_DONE', {}, 'REFACTOR.PERF_AUDIT'],
    ['AUDIT_PASSED', {}, 'AUDIT_VERIFY'],
    ['ALL_CHECKS_PASSED', { exit_code: 0 }, 'COMPLETED'],
  ] as const) {
    const result = JSON.parse(await emitCommand([publicDir, signal, JSON.stringify(payload), '--job', initial.run_id, '--output', 'compact-v1']));
    expect(result.transitioned).toBe(true);
    expect(result.view.state).toBe(state);
    expect(result.view.run_id).toBe(initial.run_id);
    expect(result.view.prompt).toBeTruthy();
    expect(result.view.context.target_file).toBe('src/auth.ts');
    expect(result.view.strict.turns_since_signal).toBe(0);
    expect(result).not.toHaveProperty('help');
    expect(result.view).not.toHaveProperty('scopedContext');
  }
  const resumed = JSON.parse(await stateCommand([publicDir, '--job', initial.run_id, '--output', 'compact-v1']));
  expect(resumed.state).toBe('COMPLETED');
  expect(resumed.run_id).toBe(initial.run_id);
  const engine = new FSMEngine({ skillDir: publicDir, workspaceDir: workspace, jobId: initial.run_id });
  try {
    const events = engine.getEventStore().getAll();
    expect(events.filter(event => event.type === 'STATE_TRANSITION')).toHaveLength(6);
    expect(events.filter(event => event.type === 'AGENT_TURN_STARTED')).toHaveLength(0);
    expect(events.filter(event => event.type === 'STATE_VIEW_REFETCHED')).toHaveLength(0);
  } finally { engine.close(); }
});

it('guides AXI users to consume the returned view and reserve state reads for recovery', () => {
  const bootloader = createReactiveBootloader('example');
  expect(bootloader).toContain('Do not follow a successful AXI invoke or emit with a redundant state command');
  expect(bootloader).toContain('inspect <skill-path>');
  expect(bootloader).toContain('AXI does not count state deliveries as strict turns');
  expect(createAxiFirstBypassState('example')).toContain('Consume the view returned by invoke or emit');
  for (const domain of ['invoke', 'emit'] as const) {
    const suggestions = getSuggestions({ domain, action: domain === 'invoke' ? 'call' : 'signal', skillName: 'example', jobId: 'selected' });
    expect(suggestions.join('\n')).toContain('resume, compaction, stale state, or a lost response');
    expect(suggestions.join('\n')).not.toContain('to re-read the active state prompt');
  }
});

it.each(['legacy', 'compact-v1'])('keeps same-command errors useful with %s output', async (output) => {
  for (const command of [stateCommand, invokeCommand, emitCommand]) {
    const result = await command(['missing-skill', 'CHECK', '--output', output]);
    expect(result).toContain('NOT_FOUND');
    expect(result).toContain('Checked:');
  }
  expect(await invokeCommand([])).toContain('Missing skill name');
  expect(await invokeCommand([skillDir, '--parent', 'missing-parent', '--output', output])).toContain('Parent job');
  // Invalid manifests must keep a useful error in the submitted command.
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'invalid: [');
  for (const command of [stateCommand, invokeCommand, emitCommand]) {
    const result = await command([skillDir, 'CHECK', '--output', output]);
    expect(result).toContain(command === invokeCommand ? 'NOT_FOUND' : 'RUNTIME_ERROR');
    expect(result).toContain('help[');
  }
});

it('keeps an empty latest-event result explicit and preserves initial context only once', async () => {
  const latest = vi.spyOn(EventStore.prototype, 'getLatestEvent').mockReturnValue(null);
  const initial = await invokeCommand([skillDir]);
  expect(initial).toContain('event_id: none');
  const resumed = await stateCommand([skillDir]);
  expect(resumed).toContain('event_id: none');
  latest.mockRestore();
  const compact = await invokeCommand([skillDir, '--output', 'compact-v1']);
  expect(compact.split('RECORDED_EVIDENCE')).toHaveLength(2);
  expect(JSON.parse(compact).context).toEqual({ evidence: 'RECORDED_EVIDENCE' });
});
