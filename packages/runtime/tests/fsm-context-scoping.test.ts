import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

describe('Context Scoping & State Visitation Tracking', () => {
  let tempDir: string;
  let skillDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-context-test-'));
    skillDir = path.join(tempDir, 'skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore Windows file lock during test cleanup
    }
  });

  const makeSkill = (extraStates: string = '') => {
    const yaml = `schema_version: "reactive/v1"
name: "context-scope-skill"
description: "Test context scoping and state visitation"
initial_state: "ENTRY"
context_keys:
  - mission
  - glossary
  - slices
  - depth_tree
  - active_leaf
  - perf_budgets
  - execution_log
  - internal_counter
default_context:
  mission: "Original mission"
  glossary: ["term1", "term2"]
  slices: []
  depth_tree: []
  active_leaf: null
  perf_budgets: {}
  execution_log: []
  internal_counter: 0
states:
  ENTRY:
    prompt_template: "states/entry.md"
    context_scope:
      - mission
      - internal_counter
    transitions:
      PROCEED: "WORK"
  WORK:
    initial_substate: "TASK_A"
    substates:
      TASK_A:
        prompt_template: "states/task_a.md"
        context_scope:
          - slices
          - depth_tree
        transitions:
          GOTO_B: "WORK.TASK_B"
      TASK_B:
        prompt_template: "states/task_b.md"
        context_scope:
          - active_leaf
          - execution_log
        transitions:
          GOTO_A: "WORK.TASK_A"
  COMPLETED:
    prompt_template: "states/completed.md"
${extraStates}
`;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml, 'utf8');
    fs.writeFileSync(path.join(skillDir, 'states', 'entry.md'), 'Entry state', 'utf8');
    fs.writeFileSync(path.join(skillDir, 'states', 'task_a.md'), 'Task A', 'utf8');
    fs.writeFileSync(path.join(skillDir, 'states', 'task_b.md'), 'Task B', 'utf8');
    fs.writeFileSync(path.join(skillDir, 'states', 'completed.md'), 'Done', 'utf8');
  };

  it('should scope prompt context to only keys declared in context_scope', () => {
    makeSkill();
    const engine = new FSMEngine({
      skillDir,
      eventStore: new EventStore({ inMemory: true }),
    });

    const slice = engine.generatePromptSlice();

    // ENTRY's context_scope = [mission, internal_counter]
    // scopedContext should only have those two keys from context_keys
    expect(slice.scopedContext).toHaveProperty('mission', 'Original mission');
    expect(slice.scopedContext).toHaveProperty('internal_counter', 0);
    // These should NOT be in scoped context
    expect(slice.scopedContext).not.toHaveProperty('glossary');
    expect(slice.scopedContext).not.toHaveProperty('slices');
    expect(slice.scopedContext).not.toHaveProperty('depth_tree');
    expect(slice.scopedContext).not.toHaveProperty('execution_log');

    // Full context should still be available
    expect(slice.context).toHaveProperty('glossary');
    expect(slice.context).toHaveProperty('slices');
  });

  it('should return null contextDelta on first visit to a state', () => {
    makeSkill();
    const engine = new FSMEngine({
      skillDir,
      eventStore: new EventStore({ inMemory: true }),
    });

    const slice = engine.generatePromptSlice();
    expect(slice.contextDelta).toBeNull();
  });

  it('should record STATE_VISITED on first entry and STATE_REVISITED on re-entry', async () => {
    makeSkill();
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir, eventStore });

    // First visit to ENTRY
    const events = eventStore.getAll();
    const visitedEvents = events.filter(e => e.type === 'STATE_VISITED');
    expect(visitedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ state: 'ENTRY' }),
        }),
      ])
    );

    // Transition to WORK.TASK_A and back to check revisit
    await engine.handleSignal('PROCEED');
    await engine.handleSignal('GOTO_B'); // WORK.TASK_A -> WORK.TASK_B
    await engine.handleSignal('GOTO_A');  // WORK.TASK_B -> WORK.TASK_A (revisit)

    const revisitEvents = eventStore.query({ type: 'STATE_REVISITED' });
    expect(revisitEvents.length).toBeGreaterThan(0);
    expect(revisitEvents[0].payload.state).toBe('WORK.TASK_A');
    expect(revisitEvents[0].payload).toHaveProperty('previous_visit_seq');
    expect(revisitEvents[0].payload).toHaveProperty('changed_keys');
  });

  it('should compute contextDelta when state is revisited', async () => {
    makeSkill();
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({
      skillDir,
      eventStore,
      initialContext: { mission: 'Original mission', internal_counter: 0 },
    });

    // First visit to ENTRY - no delta
    let slice = engine.generatePromptSlice();
    expect(slice.contextDelta).toBeNull();

    // Transition ENTRY -> WORK.TASK_A
    await engine.handleSignal('PROCEED');
    engine.updateContext({ mission: 'Changed mission' });

    // First visit to WORK.TASK_A - no delta
    slice = engine.generatePromptSlice();
    expect(slice.contextDelta).toBeNull();

    // Transition to TASK_B and back to TASK_A (revisit)
    await engine.handleSignal('GOTO_B');

    // Update a scoped key (slices is in TASK_A's scope) to create a change
    engine.updateContext({
      slices: [{ name: 'slice2' }],
    });

    // Go back to TASK_A - should now have delta
    await engine.handleSignal('GOTO_A');

    slice = engine.generatePromptSlice();
    expect(slice.contextDelta).not.toBeNull();
    expect(slice.contextDelta!.is_revisit).toBe(true);
    expect(slice.contextDelta!.previous_visit_seq).toBeGreaterThan(0);
    expect(slice.contextDelta!.changed_keys.length).toBeGreaterThan(0);
  });

  it('should scope context differently per state based on context_scope', async () => {
    makeSkill();
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({
      skillDir,
      eventStore,
      initialContext: {
        mission: 'Test mission',
        slices: [{ name: 'slice1' }],
        depth_tree: [{ id: 'leaf1' }],
        active_leaf: 'leaf1',
        execution_log: ['op1'],
        internal_counter: 0,
      },
    });

    // ENTRY: scope = [mission, internal_counter]
    let slice = engine.generatePromptSlice();
    expect(Object.keys(slice.scopedContext).sort()).toEqual(['internal_counter', 'mission']);

    // Move to TASK_A: scope = [slices, depth_tree]
    await engine.handleSignal('PROCEED');
    slice = engine.generatePromptSlice();
    // scopedContext should have slices and depth_tree (plus any internal _ keys)
    expect(slice.scopedContext).toHaveProperty('slices');
    expect(slice.scopedContext).toHaveProperty('depth_tree');
    // Should NOT have mission (not in TASK_A's scope)
    expect(slice.scopedContext).not.toHaveProperty('mission');
  });

  it('should include context_delta XML in formattedXml on revisit', async () => {
    makeSkill();
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({
      skillDir,
      eventStore,
      initialContext: {
        mission: 'Mission v1',
        slices: [{ name: 'slice1' }],
        depth_tree: [],
        active_leaf: null,
        internal_counter: 0,
      },
    });

    await engine.handleSignal('PROCEED');
    await engine.handleSignal('GOTO_B');
    await engine.handleSignal('GOTO_A');

    const slice = engine.generatePromptSlice();
    expect(slice.formattedXml).toContain('context_delta');
    expect(slice.formattedXml).toContain('is_revisit="true"');
    expect(slice.formattedXml).toContain('<changed_keys>');
  });

  it('should include context_optimization tag in formattedXml on revisit', async () => {
    makeSkill();
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({
      skillDir,
      eventStore,
    });

    // First visit - context_optimization should NOT be present (no delta)
    let slice = engine.generatePromptSlice();
    expect(slice.formattedXml).not.toContain('context_optimization');

    // Navigate away and come back to trigger a revisit
    await engine.handleSignal('PROCEED');
    await engine.handleSignal('GOTO_B');
    await engine.handleSignal('GOTO_A');

    // On revisit, context_optimization should be present
    slice = engine.generatePromptSlice();
    expect(slice.formattedXml).toContain('context_optimization');
  });

  it('should return empty scopedContext when context_scope is empty array', async () => {
    const yaml = `schema_version: "reactive/v1"
name: "empty-scope-skill"
description: "State with empty context scope"
initial_state: "A"
context_keys:
  - mission
  - glossary
default_context:
  mission: "test"
  glossary: ["a"]
states:
  A:
    context_scope: []
    transitions:
      GO: "B"
  B:
    prompt_template: "states/b.md"
`;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml, 'utf8');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'states', 'b.md'), 'B state', 'utf8');

    const engine = new FSMEngine({
      skillDir,
      eventStore: new EventStore({ inMemory: true }),
    });

    // Empty scope means only internal keys (_*) are included, which there are none
    const slice = engine.generatePromptSlice();
    // State A has no prompt_template, so it falls to default
    // but the scopedContext is computed during generatePromptSlice
    expect(slice.scopedContext).toEqual({});
  });

  it('should return full context when no context_scope is defined', async () => {
    const yaml = `schema_version: "reactive/v1"
name: "no-scope-skill"
description: "State with no context scope"
initial_state: "A"
context_keys:
  - mission
  - glossary
default_context:
  mission: "test"
  glossary: ["a"]
states:
  A:
    prompt_template: "states/a.md"
    transitions:
      GO: "B"
  B:
    prompt_template: "states/b.md"
`;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), yaml, 'utf8');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'states', 'a.md'), 'A state', 'utf8');
    fs.writeFileSync(path.join(skillDir, 'states', 'b.md'), 'B state', 'utf8');

    const engine = new FSMEngine({
      skillDir,
      eventStore: new EventStore({ inMemory: true }),
    });

    const slice = engine.generatePromptSlice();
    expect(slice.scopedContext).toEqual(slice.context);
    expect(slice.scopedContext).toHaveProperty('mission', 'test');
    expect(slice.scopedContext).toHaveProperty('glossary');
  });

  it('should expose scopedContext and contextDelta in MCP-style state response', async () => {
    makeSkill();
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({
      skillDir,
      eventStore,
      initialContext: {
        mission: 'Test mission',
        slices: [{ name: 'slice1' }],
        depth_tree: [],
        active_leaf: null,
        internal_counter: 5,
      },
    });

    // Simulate what the MCP server does: call generatePromptSlice
    let slice = engine.generatePromptSlice();

    // Verify all new fields are present in the returned PromptSlice
    expect(slice).toHaveProperty('scopedContext');
    expect(slice).toHaveProperty('contextDelta');
    expect(slice).toHaveProperty('visitCount');
    expect(slice.scopedContext).toBeDefined();
    expect(slice.contextDelta).toBeNull(); // First visit
    expect(slice.visitCount).toBe(1);

    // Transition and come back to verify revisit detection
    await engine.handleSignal('PROCEED');
    await engine.handleSignal('GOTO_B');
    await engine.handleSignal('GOTO_A');

    slice = engine.generatePromptSlice();
    expect(slice.contextDelta).not.toBeNull();
    expect(slice.contextDelta!.is_revisit).toBe(true);
  });

  it('should compute changed_keys only for scoped context keys', async () => {
    makeSkill();
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({
      skillDir,
      eventStore,
      initialContext: {
        mission: 'Original',
        glossary: ['old'],
        slices: [{ name: 'slice1' }],
        depth_tree: [{ id: 'leaf1' }],
        active_leaf: null,
        internal_counter: 0,
      },
    });

    // First visit TASK_A: scope = [slices, depth_tree]
    await engine.handleSignal('PROCEED');
    engine.generatePromptSlice(); // First visit records snapshot

    // Change non-scoped key and a scoped key
    engine.updateContext({
      mission: 'Changed (not in scope for TASK_A)',
      slices: [{ name: 'slice2' }],
    });

    // Go to TASK_B then back to TASK_A
    await engine.handleSignal('GOTO_B');
    await engine.handleSignal('GOTO_A');

    const slice = engine.generatePromptSlice();
    const changedKeys = slice.contextDelta!.changed_keys;
    const changedKeyNames = changedKeys.map(k => k.key);

    // 'slices' is in scope and changed
    expect(changedKeyNames).toContain('slices');
    // 'mission' is NOT in scope for TASK_A, so it should not appear in changed_keys
    expect(changedKeyNames).not.toContain('mission');
  });
});
