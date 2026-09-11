import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

describe('REL-02 — Signal Queue Cycle Detection', () => {
  let tempDir: string;
  let skillDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel02-test-'));
    skillDir = path.join(tempDir, 'skill');
    fs.mkdirSync(skillDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore Windows file lock during test cleanup
    }
  });

  it('should throw RangeError and record SIGNAL_QUEUE_CYCLE_DETECTED when on_enter emissions loop infinitely', async () => {
    // Skill where IDLE -> A -> B -> A -> B... forms an infinite cycle via on_enter emissions
    const cyclicYaml = `
schema_version: "reactive/v1"
name: "cyclic-skill"
description: "Test cyclic on_enter signal emission detection"
initial_state: "IDLE"
states:
  IDLE:
    transitions:
      START: "STATE_A"
  STATE_A:
    on_enter:
      - emit_signal: "GO_B"
    transitions:
      GO_B: "STATE_B"
  STATE_B:
    on_enter:
      - emit_signal: "GO_A"
    transitions:
      GO_A: "STATE_A"
`;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), cyclicYaml, 'utf8');

    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir, eventStore });

    // Emitting START -> STATE_A (emits GO_B) -> STATE_B (emits GO_A) -> STATE_A (repeats infinitely)
    // This will trip the cycle guard at MAX_QUEUE_DRAIN_DEPTH (50)
    await expect(engine.handleSignal('START')).rejects.toThrowError(/Signal queue cycle detected/);

    // SIGNAL_QUEUE_CYCLE_DETECTED event must be recorded for auditability
    const cycleEvents = eventStore.query({ type: 'SIGNAL_QUEUE_CYCLE_DETECTED' });
    expect(cycleEvents.length).toBeGreaterThanOrEqual(1);
    expect(cycleEvents[0].payload.skill).toBe('cyclic-skill');
  });

  it('should drain a legitimate finite on_enter chain without throwing', async () => {
    // WAIT → STATE_A (on_enter NEXT) → STATE_B (on_enter DONE) → STATE_C (terminal, no on_enter)
    const linearYaml = `
schema_version: "reactive/v1"
name: "linear-chain-skill"
description: "Test linear on_enter chain completes normally"
initial_state: "WAIT"
states:
  WAIT:
    transitions:
      START: "STATE_A"
  STATE_A:
    on_enter:
      - emit_signal: "NEXT"
    transitions:
      NEXT: "STATE_B"
  STATE_B:
    on_enter:
      - emit_signal: "DONE"
    transitions:
      DONE: "STATE_C"
  STATE_C:
    description: "Terminal"
  `;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), linearYaml, 'utf8');

    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir, eventStore });

    const result = await engine.handleSignal('START');
    expect(result.transitioned).toBe(true);
    expect(engine.getCurrentState()).toBe('STATE_C');

    // No cycle events should be recorded
    const cycleEvents = eventStore.query({ type: 'SIGNAL_QUEUE_CYCLE_DETECTED' });
    expect(cycleEvents.length).toBe(0);
  });
});
