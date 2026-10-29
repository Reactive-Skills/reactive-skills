import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';
import { GuardEvaluator } from '../src/core/guard-evaluator.js';
import { SkillManifestSchema, type SkillManifest, type StateDefinition } from '../src/core/types.js';

const catalog = JSON.parse(fs.readFileSync(new URL('./fixtures/public-catalog.json', import.meta.url), 'utf8')) as {
  manifests: Array<{ path: string; git_blob: string; yaml: string }>;
};
const workspaces: string[] = [];
const engines: FSMEngine[] = [];
const bootSnapshots = new WeakMap<FSMEngine, ReturnType<EventStore['getLatestSnapshot']>>();

afterEach(() => {
  vi.restoreAllMocks();
  for (const engine of engines.splice(0)) engine.close();
  for (const workspace of workspaces.splice(0)) fs.rmSync(workspace, { recursive: true, force: true });
});

function workspace() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-replay-equivalence-'));
  workspaces.push(directory);
  return directory;
}

function open(skillDir: string, workspaceDir: string, eventStore?: EventStore) {
  const engine = new FSMEngine({ skillDir, workspaceDir, eventStore, jobId: 'recovery', perfThresholds: { maxTransitionDurationMs: Infinity } });
  engines.push(engine);
  bootSnapshots.set(engine, engine.getEventStore().getLatestSnapshot());
  return engine;
}

function assertRecovery(engine: FSMEngine, skillDir: string, workspaceDir: string, legacy = false) {
  const source = engine.getEventStore();
  const original = source.getAll();
  const events = legacy ? original.map((event) => {
    if (!['SKILL_INITIALIZED', 'STATE_TRANSITION'].includes(event.type)) return event;
    const { contextUpdates: _receipt, ...payload } = event.payload;
    return { ...event, payload };
  }) : original;
  const state = engine.getCurrentState();
  const context = engine.getContext();
  const latest = source.getLatestSnapshot()!;
  const snapshots = [null, latest, bootSnapshots.get(engine)!];
  for (const snapshot of snapshots) {
    // Fresh engines and a frozen ledger view exercise constructor recovery, including a snapshot with a nonempty tail.
    const store = new EventStore({ inMemory: true, ...source.getEventContext() });
    vi.spyOn(store, 'getAll').mockReturnValue(events);
    vi.spyOn(store, 'getSince').mockImplementation((seq) => events.filter((event) => event.seq > seq));
    vi.spyOn(store, 'getLatestSnapshot').mockReturnValue(snapshot);
    const append = vi.spyOn(store, 'append');
    const restored = open(skillDir, workspaceDir, store);
    expect(restored.getCurrentState()).toBe(state);
    expect(restored.getContext(), `recovery from seq ${snapshot?.seq ?? 0}`).toEqual(context);
    expect(append).not.toHaveBeenCalled();
    restored.close();
  }
  expect(source.getAll()).toEqual(original);
}

function definitions(manifest: SkillManifest) {
  const result = new Map<string, StateDefinition>();
  function visit(states: Record<string, StateDefinition>, prefix = '') {
    for (const [name, definition] of Object.entries(states)) {
      const key = prefix ? `${prefix}.${name}` : name;
      result.set(key, definition);
      if (definition.substates) visit(definition.substates, key);
    }
  }
  visit(manifest.states);
  return result;
}

describe('Replay and snapshot accepted-context equivalence', () => {
  it('recovers a strict-execution bypass without running lifecycle assignments', () => {
    const directory = workspace();
    const skillDir = path.join(directory, 'skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump({
      schema_version: '2.1.0', name: 'bypass-recovery', description: 'Bypass recovery fixture',
      initial_state: 'READY', strict_execution: true, default_context: { value: 'original' },
      states: {
        READY: { max_idle_turns: 1, on_exit: [{ set_context: { value: 'exited' } }] },
        BYPASS_DETECTED: { on_enter: [{ set_context: { value: 'entered' } }] },
      },
    }));
    const engine = open(skillDir, directory);
    engine.recordTurnStart();
    expect(() => engine.recordTurnStart()).toThrow('BYPASS_DETECTED');
    expect(engine.getContext().value).toBe('original');
    assertRecovery(engine, skillDir, directory);
    assertRecovery(engine, skillDir, directory, true);
  });

  it.each([false, true])('preserves ordered initial, exit, signal and entry patches (legacy=%s)', async (legacy) => {
    const directory = workspace();
    const skillDir = path.join(directory, 'skill');
    fs.mkdirSync(skillDir);
    const manifest = {
      schema_version: '2.1.0', name: 'hook-order', description: 'Recovery ordering fixture',
      initial_state: 'ACTIVE', context_keys: ['value'], default_context: { value: 'default' },
      states: {
        ACTIVE: {
          initial_substate: 'LEAF',
          on_enter: [{ set_context: { value: 'parent-entry' } }],
          on_exit: [{ set_context: { value: 'parent-exit' } }],
          transitions: { NEXT: { target: 'WORK', guard: 'payload.approved === true' } },
          substates: { LEAF: {
            on_enter: [{ set_context: { value: 'leaf-entry' } }],
            on_exit: [{ set_context: { value: 'leaf-exit' } }],
          } },
        },
        WORK: { transitions: { NEXT: { target: 'DONE' } } },
        DONE: { on_enter: [{ set_context: { value: 'final-entry' }, emit_signal: 'ENTERED' }] },
      },
    };
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump(manifest));
    const engine = open(skillDir, directory);
    expect(engine.getContext().value).toBe('leaf-entry');
    assertRecovery(engine, skillDir, directory, legacy);
    expect((await engine.handleSignal('NEXT', { approved: false, value: 'refused', contextUpdates: { rejected: true } })).transitioned).toBe(false);
    await engine.handleSignal('NEXT', { approved: true, value: 'signal' });
    expect(engine.getContext().value).toBe('parent-exit');
    assertRecovery(engine, skillDir, directory, legacy);
    await engine.handleSignal('NEXT', { value: 'signal', contextUpdates: { value: 'nested', accepted: true } });
    expect(engine.getContext()).toEqual({ value: 'final-entry', accepted: true });
    if (!legacy) {
      // A recorded patch is authoritative even when the installed statechart's context bindings change later.
      manifest.context_keys = [];
      manifest.states.ACTIVE.on_enter[0].set_context.value = 'changed';
      manifest.states.ACTIVE.on_exit[0].set_context.value = 'changed';
      manifest.states.ACTIVE.substates.LEAF.on_enter[0].set_context.value = 'changed';
      manifest.states.DONE.on_enter[0].set_context.value = 'changed';
      fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump(manifest));
    }
    assertRecovery(engine, skillDir, directory, legacy);
  });

  it('recovers an accepted transition interrupted before its snapshot is saved', async () => {
    const directory = workspace();
    const skillDir = path.join(directory, 'skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump({
      schema_version: '2.1.0', name: 'interrupted-hook', description: 'Snapshot interruption fixture',
      initial_state: 'READY', context_keys: ['value'],
      states: {
        READY: { transitions: { GO: { target: 'DONE' } } },
        DONE: { on_enter: [{ set_context: { value: 'accepted-entry' } }] },
      },
    }));
    const engine = open(skillDir, directory);
    vi.spyOn(engine.getEventStore(), 'saveSnapshot').mockImplementationOnce(() => { throw new Error('interrupted snapshot'); });
    await expect(engine.handleSignal('GO', { value: 'signal', contextUpdates: { value: 'nested' } })).rejects.toThrow('interrupted snapshot');
    expect(engine.getContext().value).toBe('accepted-entry');
    // The persisted snapshot predates the committed transition; full replay and delta replay must agree.
    const restored = open(skillDir, directory);
    expect(restored.getContext()).toEqual(engine.getContext());
    assertRecovery(engine, skillDir, directory);
  });

  it('recovers the public TDD entry-hook counter with refused and unhandled updates excluded', async () => {
    const directory = workspace();
    const skillDir = path.join(directory, 'tdd-refactor');
    fs.cpSync(new URL('../scripts/transport-benchmark/fixtures/tdd-refactor/', import.meta.url), skillDir, { recursive: true });
    const engine = open(skillDir, directory);
    await engine.handleSignal('RUNTIME_READY');
    expect((await engine.handleSignal('TEST_RAN', { exit_code: 0, contextUpdates: { rejected: true } })).transitioned).toBe(false);
    await engine.handleSignal('TEST_RAN', { exit_code: 1, contextUpdates: { accepted: 'red' } });
    await engine.handleSignal('TEST_RAN', { exit_code: 0, contextUpdates: { accepted: 'green', refactor_cycles: 8 } });
    expect((await engine.handleSignal('UNKNOWN', { contextUpdates: { rejected: true, refactor_cycles: 99 } })).transitioned).toBe(false);
    expect(engine.getCurrentState()).toBe('REFACTOR.CLEAN_CODE');
    expect(engine.getContext()).toMatchObject({ refactor_cycles: 1, accepted: 'green' });
    expect(engine.getContext()).not.toHaveProperty('rejected');
    assertRecovery(engine, skillDir, directory);
    assertRecovery(engine, skillDir, directory, true);
  });

  it.each(catalog.manifests)('preserves accepted context across recovery for $path', async (fixture) => {
    const content = Buffer.from(fixture.yaml);
    expect(createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex')).toBe(fixture.git_blob);
    const manifest = SkillManifestSchema.parse(yaml.load(fixture.yaml));
    const directory = workspace();
    const skillDir = path.join(directory, 'skill');
    fs.mkdirSync(skillDir);
    // The public statechart and hooks are unchanged. Templates and external judgments are outside this recovery test.
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml.dump({ ...manifest, deliverable_projections: [] }));
    vi.spyOn(GuardEvaluator, 'evaluate').mockResolvedValue({ passed: true });
    const states = definitions(manifest);
    const queue: string[][] = [[]];
    const visited = new Set<string>();
    while (queue.length) {
      const signals = queue.shift()!;
      const store = new EventStore({ inMemory: true, skillId: manifest.name });
      const engine = open(skillDir, directory, store);
      for (const signal of signals) {
        const contextKey = manifest.context_keys?.[0] ?? 'accepted_value';
        const result = await engine.handleSignal(signal, { [contextKey]: 'accepted', contextUpdates: { accepted_value: signals.join('/') } });
        expect(result.transitioned, `${fixture.path}: ${signals.join('/')}`).toBe(true);
      }
      const state = engine.getCurrentState();
      if (visited.has(state)) { engine.close(); continue; }
      visited.add(state);
      const before = engine.getContext();
      await engine.handleSignal('__UNHANDLED_RECOVERY_PROBE__', { contextUpdates: { rejected_value: true } });
      expect(engine.getContext()).toEqual(before);
      assertRecovery(engine, skillDir, directory);
      assertRecovery(engine, skillDir, directory, true);
      // Traverse each reachable state through real dispatch, including ancestor handlers and composite entry hooks.
      const handlers = new Map<string, string>();
      const segments = state.split('.');
      for (let depth = segments.length; depth > 0; depth--) {
        for (const [signal, transition] of Object.entries(states.get(segments.slice(0, depth).join('.'))?.transitions ?? {})) {
          if (!handlers.has(signal)) handlers.set(signal, transition.target);
        }
      }
      for (const [signal, target] of handlers) {
        if (states.has(target) && !visited.has(target)) queue.push([...signals, signal]);
      }
      engine.close();
    }
    expect(visited.size).toBeGreaterThan(1);
  }, 30_000);
});
