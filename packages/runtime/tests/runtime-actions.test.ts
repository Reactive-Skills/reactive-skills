import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import yaml from 'js-yaml';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';
import { SkillManifestSchema } from '../src/core/types.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';
import { LocalRuntimeActionExecutor, type RuntimeActionExecutor } from '../src/core/runtime-action-executor.js';
import {
  decideRuntimeOutcome,
  evaluatePureRuntimeAction,
  foldRuntimeActionWindow,
  RUNTIME_ACTION_COMPLETED,
  RUNTIME_ACTION_STARTED,
  RUNTIME_ACTIONS_CAPABILITY,
  validateJsonSchemaSubset,
  type RuntimeAction,
} from '../src/core/runtime-actions.js';
import { STATIC_RUNTIME_CAPABILITIES } from '../src/core/runtime-capabilities.js';

const FIXTURE = fileURLPath('./fixtures/runtime-actions/tdd-refactor');
const RUNTIME_STATES = new Set(['RED_RUN', 'GREEN_RUN', 'AUDIT_VERIFY']);
const READY = { compatible: true, contextUpdates: { selected_runtime: { compatible: true } } };
// What a scripted model writes in RED_SPEC and GREEN_CODE; the runtime runs them, the model never does.
const FAILING_TEST = [
  "import assert from 'node:assert/strict';",
  "const { normalizeEmail } = await import('../src/auth.mjs').catch(() => ({}));",
  "try { assert.equal(normalizeEmail?.(' A@B.com '), 'a@b.com'); console.log('ok 1 - normalizes email'); }",
  "catch { console.log('not ok 1 - normalizes email'); process.exitCode = 1; }",
  '',
].join('\n');
const IMPLEMENTATION = 'export function normalizeEmail(value) { return value.trim().toLowerCase(); }\n';

const workspaces: string[] = [];
const engines: FSMEngine[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const engine of engines.splice(0)) engine.close();
  for (const workspace of workspaces.splice(0)) fs.rmSync(workspace, { recursive: true, force: true });
});

function fileURLPath(relative: string): string {
  return decodeURIComponent(new URL(relative, import.meta.url).pathname);
}

function workspace(): { workspaceDir: string; skillDir: string } {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-runtime-actions-'));
  workspaces.push(workspaceDir);
  const skillDir = path.join(workspaceDir, 'skills', 'tdd-refactor');
  fs.cpSync(FIXTURE, skillDir, { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, 'tests'));
  fs.mkdirSync(path.join(workspaceDir, 'src'));
  return { workspaceDir, skillDir };
}

function open(ws: { workspaceDir: string; skillDir: string }, runtimeActionExecutor?: RuntimeActionExecutor): FSMEngine {
  const engine = new FSMEngine({ ...ws, jobId: 'run', runtimeActionExecutor, perfThresholds: { maxTransitionDurationMs: Infinity, maxSliceDurationMs: Infinity } });
  engines.push(engine);
  return engine;
}

function counting(): RuntimeActionExecutor & { runs: string[] } {
  const local = new LocalRuntimeActionExecutor();
  const runs: string[] = [];
  return { runs, execute: (action, input) => { runs.push(action.kind); return local.execute(action, input); } };
}

function close(engine: FSMEngine): void {
  engine.close();
  engines.splice(engines.indexOf(engine), 1);
}

/** Make the store throw once, as if the process died, when an append matches. */
function crashOn(engine: FSMEngine, matches: (type: string, payload: Record<string, any>) => boolean): void {
  const store = engine.getEventStore();
  const append = store.append.bind(store);
  let crashed = false;
  vi.spyOn(store, 'append').mockImplementation(((type: string, payload: Record<string, any>, meta?: any) => {
    if (!crashed && matches(type, payload)) {
      crashed = true;
      throw new Error('simulated process death');
    }
    return append(type, payload, meta);
  }) as EventStore['append']);
}

async function toRedSpec(engine: FSMEngine, ws: { workspaceDir: string }): Promise<void> {
  expect((await engine.handleSignal('RUNTIME_READY', READY)).newState).toBe('RED_SPEC');
  fs.writeFileSync(path.join(ws.workspaceDir, 'tests', 'auth.test.mjs'), FAILING_TEST);
}

async function finish(engine: FSMEngine, ws: { workspaceDir: string }): Promise<void> {
  fs.writeFileSync(path.join(ws.workspaceDir, 'src', 'auth.mjs'), IMPLEMENTATION);
  expect((await engine.handleSignal('CODE_WRITTEN')).newState).toBe('REFACTOR.CLEAN_CODE');
  expect((await engine.handleSignal('CLEANING_DONE')).newState).toBe('REFACTOR.PERF_AUDIT');
  expect((await engine.handleSignal('AUDIT_PASSED')).newState).toBe('COMPLETED');
}

/** Context with the fields that legitimately differ between runs (ledger position, attempt) removed. */
function comparable(context: Record<string, any>): Record<string, any> {
  const copy = structuredClone(context);
  for (const key of ['red_result', 'green_result', 'audit_result']) {
    if (copy[key]) { delete copy[key].evidence_seq; delete copy[key].attempt; }
  }
  return copy;
}

/** A fresh engine rebuilt from the ledger, with the latest snapshot and with no snapshot at all, matches the live one. */
function assertLedgerRecovery(engine: FSMEngine, ws: { workspaceDir: string; skillDir: string }): void {
  const source = engine.getEventStore();
  const events = source.getAll();
  for (const snapshot of [source.getLatestSnapshot(), null]) {
    const store = new EventStore({ inMemory: true, ...source.getEventContext() });
    vi.spyOn(store, 'getAll').mockReturnValue(events);
    vi.spyOn(store, 'getSince').mockImplementation((seq) => events.filter((event) => event.seq > seq));
    vi.spyOn(store, 'getLatestSnapshot').mockReturnValue(snapshot);
    const restored = new FSMEngine({ ...ws, eventStore: store, jobId: 'run' });
    try {
      expect(restored.getCurrentState()).toBe(engine.getCurrentState());
      expect(restored.getContext()).toEqual(engine.getContext());
    } finally {
      restored.close();
    }
  }
}

function manifest(overrides: Record<string, any> = {}, state: Record<string, any> = {}) {
  return {
    schema_version: '2.1.0', name: 'probe', description: 'probe', initial_state: 'WORK',
    runtime_requirements: { required_capabilities: [RUNTIME_ACTIONS_CAPABILITY] },
    context_keys: ['result'],
    states: {
      WORK: { transitions: { DONE: 'CHECK' } },
      CHECK: {
        runtime_action: { kind: 'path_exists', path: 'out.txt', record_as: 'result', on_success: 'OK', on_failure: 'BAD' },
        transitions: { OK: 'END', BAD: 'WORK' },
        ...state,
      },
      END: {},
    },
    ...overrides,
  };
}

function issues(value: unknown): string[] {
  const parsed = SkillManifestSchema.safeParse(value);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
}

describe('runtime action decider (Given observation / When decided / Then outcome)', () => {
  const command = (expect_exit?: 'zero' | 'nonzero'): RuntimeAction => ({ kind: 'command', command: 'node', timeout_ms: 1, expect_exit, on_success: 'S', on_failure: 'F' });

  it.each([
    [command(), { exit_code: 0 }, 'success'],
    [command(), { exit_code: 1 }, 'failure'],
    [command('nonzero'), { exit_code: 1 }, 'success'],
    [command('nonzero'), { exit_code: 0 }, 'failure'],
    [command('nonzero'), { exit_code: null, signal: 'SIGKILL', timed_out: true }, 'failure'],
    [command('nonzero'), { error: 'Command failed to start: ENOENT' }, 'failure'],
    [command(), { exit_code: null, signal: 'SIGTERM' }, 'failure'],
  ] as const)('command %#', (action, observation, outcome) => {
    expect(decideRuntimeOutcome(action, { duration_ms: 1, ...observation })).toBe(outcome);
  });

  it('path, schema and expression kinds succeed only on their positive observation', () => {
    const file: RuntimeAction = { kind: 'path_exists', path: 'a', type: 'file', on_success: 'S', on_failure: 'F' };
    expect(decideRuntimeOutcome(file, { duration_ms: 0, exists: true, entry_type: 'file' })).toBe('success');
    expect(decideRuntimeOutcome(file, { duration_ms: 0, exists: true, entry_type: 'directory' })).toBe('failure');
    expect(decideRuntimeOutcome(file, { duration_ms: 0, exists: false, entry_type: null })).toBe('failure');
    const schema: RuntimeAction = { kind: 'json_schema', value: 'v', schema: {}, on_success: 'S', on_failure: 'F' };
    expect(decideRuntimeOutcome(schema, { duration_ms: 0, valid: true })).toBe('success');
    expect(decideRuntimeOutcome(schema, { duration_ms: 0, valid: false, errors: ['x'] })).toBe('failure');
    const expression: RuntimeAction = { kind: 'expression', expression: 'true', on_success: 'S', on_failure: 'F' };
    expect(decideRuntimeOutcome(expression, { duration_ms: 0, value: true })).toBe('success');
    expect(decideRuntimeOutcome(expression, { duration_ms: 0, value: 1 })).toBe('failure');
  });

  it('validates the supported JSON Schema subset with bounded error lists', () => {
    const thresholds = {
      type: 'object', additionalProperties: false, required: ['lines', 'branches'],
      properties: { lines: { type: 'number', minimum: 0, maximum: 100 }, branches: { type: 'integer', minimum: 0, maximum: 100 } },
    } as const;
    expect(validateJsonSchemaSubset(thresholds, { lines: 80.5, branches: 70 })).toEqual([]);
    expect(validateJsonSchemaSubset(thresholds, { lines: 101, branches: 7.5, extra: 1 })).toEqual([
      '$.lines: above maximum 100', '$.branches: expected integer, got number', '$.extra: not allowed',
    ]);
    expect(validateJsonSchemaSubset(thresholds, 'text')).toEqual(['$: expected object, got string']);
    expect(validateJsonSchemaSubset({ type: 'array', items: { enum: ['a'] }, maxItems: 1 }, ['a', 'b'])).toEqual([
      '$: more than 1 items', '$[1]: not one of the allowed values',
    ]);
    expect(validateJsonSchemaSubset({ type: 'string', minLength: 2, const: 'ab' }, 'a')).toEqual(['$: does not equal the constant', '$: shorter than 2']);
    expect(validateJsonSchemaSubset({ type: 'array', items: { type: 'string' } }, [1, 2, 3, 4, 5, 6, 7])).toHaveLength(5);
  });

  it('evaluates expressions over a context copy only, without code generation', () => {
    const action = (expression: string) => ({ kind: 'expression' as const, expression, on_success: 'S', on_failure: 'F' });
    const context = { thresholds: { lines: 80 } };
    expect(evaluatePureRuntimeAction(action('context.thresholds.lines >= 50'), context)).toEqual({ value: true });
    expect(evaluatePureRuntimeAction(action('context.thresholds.lines = 1'), context)).toEqual({ value: 1 });
    expect(context.thresholds.lines).toBe(80);
    expect(evaluatePureRuntimeAction(action('process.exit(1)'), context).error).toMatch(/process is not defined/);
    expect(evaluatePureRuntimeAction(action("eval('1')"), context).error).toMatch(/Expression failed/);
    expect(evaluatePureRuntimeAction(action('(() => { for (;;) {} })()'), context).error).toMatch(/timed out/);
  });

  it('folds the current visit: attempts started and a completed but uncommitted result', () => {
    const event = (type: string, state: string, seq: number) => ({ id: String(seq), seq, timestamp: '', type, payload: { state } });
    expect(foldRuntimeActionWindow([], 'RED_RUN')).toEqual({ attempts: 0 });
    const completed = event(RUNTIME_ACTION_COMPLETED, 'RED_RUN', 3);
    expect(foldRuntimeActionWindow([event(RUNTIME_ACTION_STARTED, 'RED_RUN', 1), event(RUNTIME_ACTION_STARTED, 'OTHER', 2), completed], 'RED_RUN'))
      .toEqual({ attempts: 1, completed });
  });
});

describe('runtime_action manifest validation (safe by default)', () => {
  it('accepts the tdd-refactor variant and advertises the capability', () => {
    expect(issues(yaml.load(fs.readFileSync(path.join(FIXTURE, 'skill.yaml'), 'utf8')))).toEqual([]);
    expect(issues(manifest())).toEqual([]);
    expect(STATIC_RUNTIME_CAPABILITIES).toContain(RUNTIME_ACTIONS_CAPABILITY);
  });

  it.each([
    ['opt-in capability', manifest({ runtime_requirements: undefined }), /require state\.runtime_actions/],
    ['undeclared outcome transition', manifest({}, { transitions: { OK: 'END' } }), /on_failure 'BAD' must be a transition declared on this state/],
    ['guarded outcome transition', manifest({}, { transitions: { OK: { target: 'END', guard: 'true' }, BAD: 'WORK' } }), /decided by the runtime action/],
    ['unknown outcome target', manifest({}, { transitions: { OK: 'NOWHERE', BAD: 'WORK' } }), /target 'NOWHERE' is not a declared state/],
    ['record_as outside context_keys', manifest({ context_keys: [] }), /record_as 'result' must be listed in context_keys/],
    ['prompt template', manifest({}, { prompt_template: 'states/check.md' }), /never delivered to the model/],
    ['human gate', manifest({}, { human_gate: { type: 'approval' } }), /cannot declare a human_gate/],
    ['composite state', manifest({}, { substates: { A: {} }, initial_substate: 'A' }), /must be a leaf state/],
    ['runtime initial state', manifest({ initial_state: 'CHECK' }), /initial state cannot be a runtime_action state/],
    ['templated argument', manifest({}, { runtime_action: { kind: 'command', command: 'node', args: ['{{context.file}}'], timeout_ms: 10, on_success: 'OK', on_failure: 'BAD' } }), /never interpolated/],
    ['shell command string', manifest({}, { runtime_action: { kind: 'command', command: 'npm test', timeout_ms: 10, on_success: 'OK', on_failure: 'BAD' } }), /without spaces or shell syntax/],
    ['missing timeout', manifest({}, { runtime_action: { kind: 'command', command: 'node', on_success: 'OK', on_failure: 'BAD' } }), /Required/],
    ['escaping path', manifest({}, { runtime_action: { kind: 'path_exists', path: '../secret', on_success: 'OK', on_failure: 'BAD' } }), /without \.\. segments/],
    ['absolute path', manifest({}, { runtime_action: { kind: 'path_exists', path: '/etc/passwd', on_success: 'OK', on_failure: 'BAD' } }), /without \.\. segments/],
    ['unsupported schema keyword', manifest({}, { runtime_action: { kind: 'json_schema', value: 'result', schema: { pattern: 'x' }, on_success: 'OK', on_failure: 'BAD' } }), /Unrecognized key/],
    ['unknown action kind', manifest({}, { runtime_action: { kind: 'http', on_success: 'OK', on_failure: 'BAD' } }), /Invalid discriminator/],
  ])('rejects %s', (_name, value, message) => {
    expect(issues(value).join('\n')).toMatch(message);
  });

  it('rejects a cycle made only of runtime states', () => {
    const value = manifest();
    value.states.CHECK.transitions = { OK: 'END', BAD: 'CHECK2' } as any;
    (value.states as any).CHECK2 = {
      runtime_action: { kind: 'expression', expression: 'true', on_success: 'OK', on_failure: 'BAD' },
      transitions: { OK: 'CHECK', BAD: 'WORK' },
    };
    expect(issues(value).join('\n')).toMatch(/cycle with no model-visible state: CHECK -> CHECK2 -> CHECK|CHECK2 -> CHECK -> CHECK2/);
  });
});

describe('runtime-executed states in the engine', () => {
  it('runs mechanical states without delivering them and records each result as ledger evidence', async () => {
    const ws = workspace();
    const executor = counting();
    const engine = open(ws, executor);
    await toRedSpec(engine, ws);
    const red = await engine.handleSignal('TEST_WRITTEN', { requirement: 'normalize email' });
    expect(red).toMatchObject({ transitioned: true, previousState: 'RED_SPEC', newState: 'GREEN_CODE' });
    expect(red.runtimeActions).toEqual([expect.objectContaining({ state: 'RED_RUN', kind: 'command', outcome: 'success', signal: 'RED_CONFIRMED', attempt: 1, newState: 'GREEN_CODE' })]);
    expect(engine.getContext().red_result).toMatchObject({ kind: 'command', outcome: 'success', attempt: 1, exit_code: 1 });
    expect(engine.getContext().red_result).not.toHaveProperty('stdout_tail');
    await finish(engine, ws);
    expect(executor.runs).toEqual(['command', 'command', 'command']);
    expect(engine.getContext()).toMatchObject({ green_result: { outcome: 'success', exit_code: 0 }, audit_result: { outcome: 'success', exit_code: 0 } });

    const events = engine.getEventStore().getAll();
    const completed = events.filter((event) => event.type === RUNTIME_ACTION_COMPLETED);
    expect(completed.map((event) => event.payload.state)).toEqual(['RED_RUN', 'GREEN_RUN', 'AUDIT_VERIFY']);
    expect(completed[0].payload.observation).toMatchObject({ exit_code: 1, stdout_tail: 'not ok 1 - normalizes email\n' });
    expect(completed[0].payload.observation.duration_ms).toBeGreaterThan(0);
    const outcome = events.find((event) => event.type === 'SIGNAL_EMITTED' && event.payload.signal === 'RED_CONFIRMED')!;
    expect(outcome).toMatchObject({ source: 'runtime_action', causation_id: completed[0].id });
    const visited = events.filter((event) => event.type === 'STATE_TRANSITION').map((event) => event.payload.to);
    expect(visited).toEqual(['RED_SPEC', 'RED_RUN', 'GREEN_CODE', 'GREEN_RUN', 'REFACTOR.CLEAN_CODE', 'REFACTOR.PERF_AUDIT', 'AUDIT_VERIFY', 'COMPLETED']);
    // Strict mode never counted a turn in a runtime state.
    expect(events.filter((event) => event.type === 'AGENT_TURN_STARTED' && RUNTIME_STATES.has(event.payload.state))).toEqual([]);
    assertLedgerRecovery(engine, ws);
  });

  it('routes failures to the declared state with the recorded result', async () => {
    const ws = workspace();
    const engine = open(ws);
    await toRedSpec(engine, ws);
    // The implementation already exists, so the new test passes: not a valid red step.
    fs.writeFileSync(path.join(ws.workspaceDir, 'src', 'auth.mjs'), IMPLEMENTATION);
    const result = await engine.handleSignal('TEST_WRITTEN', { requirement: 'normalize email' });
    expect(result.newState).toBe('RED_SPEC');
    expect(result.runtimeActions?.[0]).toMatchObject({ outcome: 'failure', signal: 'RED_NOT_FAILING' });
    expect(engine.getContext().red_result).toMatchObject({ outcome: 'failure', exit_code: 0 });
    expect(engine.generatePromptSlice().formattedXml).toContain('RED_SPEC');
  });

  it('records timeouts and missing commands as failures', async () => {
    const ws = workspace();
    const local = new LocalRuntimeActionExecutor();
    const action = (command: string, args: string[], timeout_ms = 5_000): RuntimeAction => ({ kind: 'command', command, args, timeout_ms, on_success: 'S', on_failure: 'F' });
    const slow = await local.execute(action('node', ['-e', 'setTimeout(() => {}, 10000)'], 100), { workspaceDir: ws.workspaceDir, context: {} });
    expect(slow).toMatchObject({ timed_out: true, exit_code: null, signal: 'SIGKILL' });
    expect(decideRuntimeOutcome(action('node', []), slow)).toBe('failure');
    const missing = await local.execute(action('rsa-no-such-command', []), { workspaceDir: ws.workspaceDir, context: {} });
    expect(missing.error).toMatch(/ENOENT/);
    const chatty = await local.execute(action('node', ['-e', "process.stdout.write('x'.repeat(10000) + 'END')"]), { workspaceDir: ws.workspaceDir, context: {} });
    expect(Buffer.byteLength(chatty.stdout_tail!)).toBe(2048);
    expect(chatty.stdout_tail!.endsWith('END')).toBe(true);
  });

  it('passes arguments literally, without a shell, and keeps paths inside the workspace', async () => {
    const ws = workspace();
    const local = new LocalRuntimeActionExecutor();
    const echoed = await local.execute({ kind: 'command', command: 'node', args: ['-e', 'console.log(process.argv[1])', '$(touch pwned); `touch pwned`'], timeout_ms: 5_000, on_success: 'S', on_failure: 'F' }, { workspaceDir: ws.workspaceDir, context: {} });
    expect(echoed.stdout_tail).toBe('$(touch pwned); `touch pwned`\n');
    expect(fs.existsSync(path.join(ws.workspaceDir, 'pwned'))).toBe(false);
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-outside-'));
    workspaces.push(outside);
    fs.symlinkSync(outside, path.join(ws.workspaceDir, 'link'));
    const escaped = await local.execute({ kind: 'path_exists', path: 'link', on_success: 'S', on_failure: 'F' }, { workspaceDir: ws.workspaceDir, context: {} });
    expect(escaped.error).toMatch(/outside the workspace/);
    const cwd = await local.execute({ kind: 'command', command: 'node', args: ['-e', ''], cwd: 'link', timeout_ms: 5_000, on_success: 'S', on_failure: 'F' }, { workspaceDir: ws.workspaceDir, context: {} });
    expect(cwd.error).toMatch(/outside the workspace/);
    expect(await local.execute({ kind: 'path_exists', path: 'tests', type: 'directory', on_success: 'S', on_failure: 'F' }, { workspaceDir: ws.workspaceDir, context: {} }))
      .toMatchObject({ exists: true, entry_type: 'directory' });
  });

  it('records an executor fault as a failure that routes to the declared state', async () => {
    const ws = workspace();
    const engine = open(ws, { execute: async () => { throw new Error('adapter unavailable'); } });
    await toRedSpec(engine, ws);
    const result = await engine.handleSignal('TEST_WRITTEN');
    expect(result.newState).toBe('RED_SPEC');
    expect(engine.getContext().red_result).toMatchObject({ outcome: 'failure', error: 'Runtime action executor failed: adapter unavailable' });
  });
});

describe('recovery from an interruption during a runtime-executed state', () => {
  async function uninterrupted(): Promise<Record<string, any>> {
    const ws = workspace();
    const engine = open(ws);
    await toRedSpec(engine, ws);
    await engine.handleSignal('TEST_WRITTEN', { requirement: 'normalize email' });
    await finish(engine, ws);
    return comparable(engine.getContext());
  }

  it.each([
    ['after entering the state, before the action started', (type: string) => type === RUNTIME_ACTION_STARTED, 1, 1, false],
    ['after the action started, before its result was recorded', (type: string) => type === RUNTIME_ACTION_COMPLETED, 2, 2, false],
    ['after the result was recorded, before the outcome signal', (type: string, payload: any) => type === 'SIGNAL_EMITTED' && payload.signal === 'RED_CONFIRMED', 1, 1, true],
    ['after the outcome signal, before its transition', (type: string, payload: any) => type === 'STATE_TRANSITION' && payload.signal === 'RED_CONFIRMED', 1, 1, true],
  ])('resumes %s', async (_point, matches, executions, attempt, reused) => {
    const expected = await uninterrupted();
    const ws = workspace();
    const executor = counting();
    const crashed = open(ws, executor);
    await toRedSpec(crashed, ws);
    crashOn(crashed, matches);
    await expect(crashed.handleSignal('TEST_WRITTEN', { requirement: 'normalize email' })).rejects.toThrow('simulated process death');
    close(crashed);

    const resumed = open(ws, executor);
    expect(resumed.getCurrentState()).toBe('RED_RUN');
    // A runtime-owned outcome cannot be forged while the action is pending.
    const forged = await resumed.handleSignal('RED_CONFIRMED', {});
    expect(forged.newState).toBe('GREEN_CODE');
    expect(forged.runtimeActions?.[0]).toMatchObject({ state: 'RED_RUN', outcome: 'success', attempt, ...(reused ? { reused_result: true } : {}) });
    expect(executor.runs).toHaveLength(executions);
    expect(resumed.getContext().red_result).toMatchObject({ exit_code: 1, attempt });
    const events = resumed.getEventStore().getAll();
    expect(events.filter((event) => event.type === RUNTIME_ACTION_COMPLETED)).toHaveLength(1);
    expect(events.filter((event) => event.type === 'STATE_TRANSITION' && event.payload.signal === 'RED_CONFIRMED')).toHaveLength(1);
    assertLedgerRecovery(resumed, ws);

    await finish(resumed, ws);
    expect(comparable(resumed.getContext())).toEqual(expected);
    assertLedgerRecovery(resumed, ws);
  });

  it('refuses a runtime-owned outcome signal submitted from outside while its state is active', async () => {
    const ws = workspace();
    const engine = open(ws, { execute: async () => { throw new Error('unused'); } });
    await toRedSpec(engine, ws);
    crashOn(engine, (type) => type === RUNTIME_ACTION_STARTED);
    await expect(engine.handleSignal('TEST_WRITTEN')).rejects.toThrow('simulated process death');
    close(engine);
    // Reproduce a pending state whose resume did not transition: a direct dispatch without resuming.
    const pending = open(ws);
    const processSignal = (pending as any).processSignal.bind(pending);
    const refused = await processSignal('RED_CONFIRMED', {}, {}, true);
    expect(refused).toMatchObject({ transitioned: false, refusalReason: "Signal 'RED_CONFIRMED' is decided by the runtime action of RED_RUN and cannot be submitted." });
    expect(pending.getCurrentState()).toBe('RED_RUN');
  });

  it('re-runs an action whose process was killed mid-command (at-least-once)', async () => {
    const ws = workspace();
    const engine = open(ws);
    await toRedSpec(engine, ws);
    close(engine);
    // The test blocks until it is killed on the first run, and fails normally on the second.
    const marker = path.join(ws.workspaceDir, 'started');
    fs.writeFileSync(path.join(ws.workspaceDir, 'tests', 'auth.test.mjs'), [
      "import fs from 'node:fs';",
      `if (!fs.existsSync(${JSON.stringify(marker)})) { fs.writeFileSync(${JSON.stringify(marker)}, ''); setInterval(() => {}, 1000); }`,
      FAILING_TEST,
    ].join('\n'));
    const script = [
      `import { FSMEngine } from ${JSON.stringify(path.resolve('packages/runtime/src/core/fsm-engine.ts'))};`,
      `const engine = new FSMEngine({ skillDir: ${JSON.stringify(ws.skillDir)}, workspaceDir: ${JSON.stringify(ws.workspaceDir)}, jobId: 'run' });`,
      "await engine.handleSignal('TEST_WRITTEN', { requirement: 'normalize email' });",
    ].join('\n');
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: path.resolve('packages/runtime'), stdio: 'ignore', detached: true });
    const deadline = Date.now() + 20_000;
    while (!fs.existsSync(marker) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fs.existsSync(marker)).toBe(true);
    process.kill(-child.pid!, 'SIGKILL');
    await new Promise((resolve) => child.once('exit', resolve));

    const resumed = open(ws);
    expect(resumed.getCurrentState()).toBe('RED_RUN');
    expect(resumed.getEventStore().getAll().filter((event) => event.type === RUNTIME_ACTION_STARTED)).toHaveLength(1);
    const summaries = await resumed.resumeRuntimeActions();
    expect(summaries).toEqual([expect.objectContaining({ state: 'RED_RUN', outcome: 'success', attempt: 2, newState: 'GREEN_CODE' })]);
    assertLedgerRecovery(resumed, ws);
  }, 30_000);
});

describe('strict MCP delivery through runtime-executed states', () => {
  async function connect(workspaceDir: string) {
    const server = createReactiveMcpServer({ workspaceDir, defaultSkill: 'tdd-refactor' });
    const client = new Client({ name: 'runtime-actions-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as Array<{ text: string }>)[0].text;
      expect(result.isError, text).not.toBe(true);
      return JSON.parse(text);
    };
    return { call, close: async () => { await client.close(); await server.close(); } };
  }

  it('delivers only model-visible states, counts one turn each, and drains a pending action before a resumed view', async () => {
    const ws = workspace();
    const session = await connect(ws.workspaceDir);
    const delivered: string[] = [];
    const first = await session.call('reactive_state', { job_id: 'run' });
    delivered.push(first.state);
    const emit = async (signal: string, payload: Record<string, unknown> = {}) => {
      const response = await session.call('reactive_emit_signal', { job_id: 'run', signal, payload });
      delivered.push(response.view.state);
      return response;
    };
    await emit('RUNTIME_READY', READY);
    fs.writeFileSync(path.join(ws.workspaceDir, 'tests', 'auth.test.mjs'), FAILING_TEST);
    const red = await emit('TEST_WRITTEN', { requirement: 'normalize email' });
    expect(red.receipt).toMatchObject({ transitioned: true, newState: 'GREEN_CODE' });
    expect(JSON.stringify(red.view)).toContain('red_result');
    await session.close();

    // A crash after entering GREEN_RUN: the next session resumes the action before delivering any view.
    fs.writeFileSync(path.join(ws.workspaceDir, 'src', 'auth.mjs'), IMPLEMENTATION);
    const crashed = open(ws);
    crashOn(crashed, (type) => type === RUNTIME_ACTION_STARTED);
    await expect(crashed.handleSignal('CODE_WRITTEN')).rejects.toThrow('simulated process death');
    close(crashed);
    const next = await connect(ws.workspaceDir);
    const resumedView = await next.call('reactive_state', { job_id: 'run' });
    expect(resumedView.state).toBe('REFACTOR.CLEAN_CODE');
    delivered.push(resumedView.state);
    const response = await next.call('reactive_emit_signal', { job_id: 'run', signal: 'CLEANING_DONE', payload: {} });
    delivered.push(response.view.state);
    const done = await next.call('reactive_emit_signal', { job_id: 'run', signal: 'AUDIT_PASSED', payload: {} });
    delivered.push(done.view.state);
    await next.close();

    expect(delivered).toEqual(['INIT', 'RED_SPEC', 'GREEN_CODE', 'REFACTOR.CLEAN_CODE', 'REFACTOR.PERF_AUDIT', 'COMPLETED']);
    const engine = open(ws);
    const events = engine.getEventStore().getAll();
    expect(events.some((event) => event.type === 'BYPASS_DETECTED')).toBe(false);
    expect(events.filter((event) => event.type === 'AGENT_TURN_STARTED').map((event) => event.payload.state))
      .toEqual(['INIT', 'RED_SPEC', 'GREEN_CODE', 'REFACTOR.CLEAN_CODE', 'REFACTOR.PERF_AUDIT', 'COMPLETED']);
    assertLedgerRecovery(engine, ws);
  });
});
