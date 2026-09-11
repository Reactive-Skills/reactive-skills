import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

describe('Reactive Skills Engine & Event Store', () => {
  const skillDir = path.resolve(process.cwd(), 'skills', '_test_fsm_skill');
  let eventStore: EventStore;
  let engine: FSMEngine;

  beforeEach(async () => {
    eventStore = new EventStore({ inMemory: true });
    engine = new FSMEngine({
      skillDir,
      eventStore,
      initialContext: {
        target_file: 'src/calc.ts',
        test_file: 'tests/calc.test.ts',
      },
    });
    await engine.handleSignal('RUNTIME_READY');
  });

  it('should initialize to initial_state with event #1 logged', () => {
    expect(engine.getCurrentState()).toBe('RED_SPEC');
    const events = eventStore.getAll();
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe('SKILL_INITIALIZED');
  });

  it('should generate active state prompt slice on demand', () => {
    const slice = engine.generatePromptSlice();
    expect(slice.state).toBe('RED_SPEC');
    expect(slice.formattedXml).toContain('<reactive_skill_state name="RED_SPEC"');
    expect(slice.formattedXml).toContain('src/calc.ts');
  });

  it('should block transition if guard condition fails', async () => {
    // In RED_SPEC, test must fail (exit_code != 0). If exit_code == 0, transition should be blocked.
    const res = await engine.handleSignal('TEST_RAN', { exit_code: 0 });
    expect(res.transitioned).toBe(false);
    expect(engine.getCurrentState()).toBe('RED_SPEC');
  });

  it('should execute state transition when guard condition passes', async () => {
    // In RED_SPEC, test fails (exit_code = 1) -> transitions to GREEN_CODE
    const res = await engine.handleSignal('TEST_RAN', { exit_code: 1 });
    expect(res.transitioned).toBe(true);
    expect(res.newState).toBe('GREEN_CODE');
    expect(engine.getCurrentState()).toBe('GREEN_CODE');
  });

  it('should transition through Red -> Green -> Refactor -> Regression -> Green -> Completed cycle', async () => {
    // 1. Red -> Green
    let res = await engine.handleSignal('TEST_RAN', { exit_code: 1 });
    expect(engine.getCurrentState()).toBe('GREEN_CODE');

    // 2. Green -> Refactor (auto-resolves to REFACTOR.CLEAN_CODE)
    res = await engine.handleSignal('TEST_RAN', { exit_code: 0 });
    expect(engine.getCurrentState()).toBe('REFACTOR.CLEAN_CODE');

    // 3. Regression! In Refactor, tests fail -> rolls back to GREEN_CODE
    res = await engine.handleSignal('TEST_RAN', { exit_code: 1 });
    expect(engine.getCurrentState()).toBe('GREEN_CODE');

    // 4. Fix regression -> back to Refactor
    res = await engine.handleSignal('TEST_RAN', { exit_code: 0 });
    expect(engine.getCurrentState()).toBe('REFACTOR.CLEAN_CODE');

    // 5. Complete cleaning and audit -> Audit Verify
    await engine.handleSignal('CLEANING_DONE');
    res = await engine.handleSignal('AUDIT_PASSED');
    expect(engine.getCurrentState()).toBe('AUDIT_VERIFY');

    // 6. All checks pass -> Completed
    res = await engine.handleSignal('ALL_CHECKS_PASSED', { exit_code: 0 });
    expect(engine.getCurrentState()).toBe('COMPLETED');
    expect(res.deliverablesWritten.length).toBeGreaterThanOrEqual(1);
  });

  it('should emit a signal when a command result is dispatched', async () => {
    const result = await engine.handleSignal('COMMAND_RAN', {
      command: 'npm test',
      output: 'FAIL - 1 test failed',
      exit_code: 1,
    });

    expect(result.event.type).toBe('SIGNAL_EMITTED');
    expect(result.event.payload.signal).toBe('COMMAND_RAN');
    expect(engine.getCurrentState()).toBe('RED_SPEC');
  });

  it('should surface child-run failure summary in parent event history', () => {
    engine.recordChildRunStarted('_test_fsm_skill', 'run-tdd-1', 'request-1');
    engine.recordChildRunCompleted({
      child_skill_id: '_test_fsm_skill',
      child_run_id: 'run-tdd-1',
      outcome: 'failed',
      failed_state: 'REFACTOR.AUDIT_VERIFY',
      error_code: 'CHECK_FAILED',
      summary: '3 tests failed',
      suggested_action: 'Fix failing tests and resume parent workflow',
    });

    expect(eventStore.query({ type: 'CHILD_RUN_FAILED' })[0].payload).toMatchObject({
      child_skill_id: '_test_fsm_skill',
      child_run_id: 'run-tdd-1',
      error_code: 'CHECK_FAILED',
    });
  });

  it('should maintain immutable audit log in EventStore', async () => {
    await engine.handleSignal('TEST_RAN', { exit_code: 1 });
    await engine.handleSignal('TEST_RAN', { exit_code: 0 });

    const allEvents = eventStore.getAll();
    const transitions = eventStore.query({ type: 'STATE_TRANSITION' });

    expect(allEvents.length).toBeGreaterThanOrEqual(4);
    expect(transitions.length).toBe(3);
    expect(transitions[0].payload.from).toBe('INIT');
    expect(transitions[0].payload.to).toBe('RED_SPEC');
    expect(transitions[1].payload.from).toBe('RED_SPEC');
    expect(transitions[1].payload.to).toBe('GREEN_CODE');
    expect(transitions[2].payload.from).toBe('GREEN_CODE');
    expect(transitions[2].payload.to).toBe('REFACTOR.CLEAN_CODE');
  });
});


