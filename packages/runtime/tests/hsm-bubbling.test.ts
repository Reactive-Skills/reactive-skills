import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

describe('Hierarchical State Machine (HSM): Bubbling & Lifecycle Hooks', () => {
  const tempSkillDir = path.resolve(process.cwd(), 'skills', '_test_hsm_skill');

  beforeEach(() => {
    // Create a temporary test skill manifest with nested substates and lifecycle hooks
    if (!fs.existsSync(tempSkillDir)) {
      fs.mkdirSync(path.join(tempSkillDir, 'states'), { recursive: true });
    }

    const testYaml = `schema_version: "reactive/v1"
name: "test-hsm"
description: "Test HSM bubbling and lifecycle hooks"
initial_state: "EXPLORE"

context:
  hook_count: 0
  active_subtask: null

states:
  EXPLORE:
    prompt_template: "states/explore.md"
    on_enter:
      - set_context: { hook_count: 1 }
        emit_signal: "ENTERED_EXPLORE"
    on_exit:
      - emit_signal: "EXITING_EXPLORE"
    transitions:
      START_WORK:
        target: "ACTIVE_WORK"

  ACTIVE_WORK:
    description: "Composite Parent State"
    initial_substate: "TASK_A"
    on_enter:
      - set_context: { active_subtask: "PARENT_ACTIVE" }
    transitions:
      GLOBAL_CANCEL:
        target: "CANCELLED"
      FORCE_RESET:
        target: "EXPLORE"
    substates:
      TASK_A:
        prompt_template: "states/task_a.md"
        on_enter:
          - set_context: { active_subtask: "TASK_A" }
            emit_signal: "TASK_A_STARTED"
        transitions:
          TASK_A_DONE:
            target: "ACTIVE_WORK.TASK_B"

      TASK_B:
        prompt_template: "states/task_b.md"
        on_enter:
          - set_context: { active_subtask: "TASK_B" }
        transitions:
          TASK_B_DONE:
            target: "COMPLETED"

  CANCELLED:
    prompt_template: "states/cancelled.md"

  COMPLETED:
    prompt_template: "states/completed.md"
`;

    fs.writeFileSync(path.join(tempSkillDir, 'skill.yaml'), testYaml, 'utf8');
    fs.writeFileSync(path.join(tempSkillDir, 'states', 'explore.md'), 'Explore', 'utf8');
    fs.writeFileSync(path.join(tempSkillDir, 'states', 'task_a.md'), 'Task A', 'utf8');
    fs.writeFileSync(path.join(tempSkillDir, 'states', 'task_b.md'), 'Task B', 'utf8');
    fs.writeFileSync(path.join(tempSkillDir, 'states', 'cancelled.md'), 'Cancelled', 'utf8');
    fs.writeFileSync(path.join(tempSkillDir, 'states', 'completed.md'), 'Completed', 'utf8');
  });

  it('should execute on_enter hook and set_context on initial state boot', () => {
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir: tempSkillDir, eventStore });

    expect(engine.getCurrentState()).toBe('EXPLORE');
    expect(engine.getContext().hook_count).toBe(1);

    const entryEvents = eventStore.query({ type: 'STATE_ENTRY_HOOK' });
    expect(entryEvents.length).toBe(1);
    expect(entryEvents[0].payload.signalEmitted).toBe('ENTERED_EXPLORE');
  });

  it('should auto-initialize to nested substate (initial_substate) and execute sequential entry hooks', async () => {
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir: tempSkillDir, eventStore });

    // Transition from EXPLORE -> ACTIVE_WORK (which resolves to ACTIVE_WORK.TASK_A)
    const res = await engine.handleSignal('START_WORK');
    expect(res.transitioned).toBe(true);
    expect(engine.getCurrentState()).toBe('ACTIVE_WORK.TASK_A');
    expect(engine.getContext().active_subtask).toBe('TASK_A');

    // Check exit hook on EXPLORE and entry hook on TASK_A
    const exitEvents = eventStore.query({ type: 'STATE_EXIT_HOOK' });
    expect(exitEvents.some(e => e.payload.state === 'EXPLORE')).toBe(true);

    const entryEvents = eventStore.query({ type: 'STATE_ENTRY_HOOK' });
    expect(entryEvents.some(e => e.payload.state === 'ACTIVE_WORK.TASK_A')).toBe(true);
  });

  it('should bubble unhandled events up to ancestor states', async () => {
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir: tempSkillDir, eventStore });

    // Move into ACTIVE_WORK.TASK_A
    await engine.handleSignal('START_WORK');
    expect(engine.getCurrentState()).toBe('ACTIVE_WORK.TASK_A');

    // Emit GLOBAL_CANCEL (not defined on TASK_A, but defined on parent ACTIVE_WORK)
    const res = await engine.handleSignal('GLOBAL_CANCEL');
    expect(res.transitioned).toBe(true);
    expect(res.newState).toBe('CANCELLED');
    expect(engine.getCurrentState()).toBe('CANCELLED');

    // Verify EVENT_BUBBLED was recorded
    const bubbled = eventStore.query({ type: 'EVENT_BUBBLED' });
    expect(bubbled.length).toBe(1);
    expect(bubbled[0].payload.signal).toBe('GLOBAL_CANCEL');
    expect(bubbled[0].payload.fromLeaf).toBe('ACTIVE_WORK.TASK_A');
    expect(bubbled[0].payload.handledAt).toBe('ACTIVE_WORK');
  });

  it('should transition between sibling substates cleanly', async () => {
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir: tempSkillDir, eventStore });

    await engine.handleSignal('START_WORK');
    expect(engine.getCurrentState()).toBe('ACTIVE_WORK.TASK_A');

    // TASK_A -> TASK_B
    const res = await engine.handleSignal('TASK_A_DONE');
    expect(res.transitioned).toBe(true);
    expect(engine.getCurrentState()).toBe('ACTIVE_WORK.TASK_B');
    expect(engine.getContext().active_subtask).toBe('TASK_B');

    // TASK_B -> COMPLETED
    const res2 = await engine.handleSignal('TASK_B_DONE');
    expect(res2.transitioned).toBe(true);
    expect(engine.getCurrentState()).toBe('COMPLETED');
  });
});
