import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

describe('Human-in-the-Loop (HITL) State Gates', () => {
  const tempSkillDir = path.resolve(process.cwd(), 'skills', '_test_hitl_skill');

  beforeEach(() => {
    if (!fs.existsSync(tempSkillDir)) {
      fs.mkdirSync(path.join(tempSkillDir, 'states'), { recursive: true });
    }

    const testYaml = `schema_version: "reactive/v1"
name: "test-hitl"
description: "Test HITL state gates and user approval signals"
initial_state: "PLAN_DRAFT"

context:
  user_feedback: null
  user_choice: null

states:
  PLAN_DRAFT:
    prompt_template: "states/01_draft.md"
    transitions:
      DRAFT_READY:
        target: "PLAN_APPROVAL"

  PLAN_APPROVAL:
    description: "Human Gate: Review plan"
    prompt_template: "states/02_approval.md"
    human_gate:
      type: "choice"
      tool: "ask_question"
      options: ["Approve Plan", "Request Changes", "Abort"]
    transitions:
      USER_APPROVED:
        target: "EXECUTION"
      USER_REVISION_REQUESTED:
        target: "PLAN_DRAFT"
      USER_REJECTED:
        target: "CANCELLED"

  EXECUTION:
    prompt_template: "states/03_execution.md"

  CANCELLED:
    prompt_template: "states/04_cancelled.md"
`;

    fs.writeFileSync(path.join(tempSkillDir, 'skill.yaml'), testYaml, 'utf8');
    fs.writeFileSync(path.join(tempSkillDir, 'states', '01_draft.md'), 'Drafting plan...', 'utf8');
    fs.writeFileSync(path.join(tempSkillDir, 'states', '02_approval.md'), 'Awaiting human review...', 'utf8');
    fs.writeFileSync(path.join(tempSkillDir, 'states', '03_execution.md'), 'Executing approved plan...', 'utf8');
    fs.writeFileSync(path.join(tempSkillDir, 'states', '04_cancelled.md'), 'Cancelled.', 'utf8');
  });

  it('should detect human gate and format XML directives in prompt slice', async () => {
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir: tempSkillDir, eventStore });

    expect(engine.isWaitingForHuman()).toBe(false);

    // Transition into PLAN_APPROVAL
    await engine.handleSignal('DRAFT_READY');
    expect(engine.getCurrentState()).toBe('PLAN_APPROVAL');
    expect(engine.isWaitingForHuman()).toBe(true);

    const promptSlice = engine.generatePromptSlice();
    expect(promptSlice.formattedXml).toContain('<human_gate type="choice" tool="ask_question">');
    expect(promptSlice.formattedXml).toContain('<options>Approve Plan | Request Changes | Abort</options>');

    const gateEvents = eventStore.query({ type: 'HUMAN_GATE_ENTERED' });
    expect(gateEvents.length).toBe(1);
    expect(gateEvents[0].payload.state).toBe('PLAN_APPROVAL');
  });

  it('should transition to EXECUTION when user approves via onHumanResponse', async () => {
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir: tempSkillDir, eventStore });

    await engine.handleSignal('DRAFT_READY');
    expect(engine.getCurrentState()).toBe('PLAN_APPROVAL');

    // Simulate Human clicking "Approve Plan"
    engine.recordDecision({ choice: 'Approve Plan', approved: true });
    const res = await engine.handleSignal('USER_APPROVED', {
      choice: 'Approve Plan',
      approved: true,
    });

    expect(res.transitioned).toBe(true);
    expect(res.newState).toBe('EXECUTION');
    expect(engine.getCurrentState()).toBe('EXECUTION');
    expect(engine.isWaitingForHuman()).toBe(false);
    expect(eventStore.query({ type: 'DECISION_RECORDED' })[0].payload).toMatchObject({
      choice: 'Approve Plan',
      approved: true,
    });
  });

  it('should loop back to PLAN_DRAFT with feedback when user requests changes', async () => {
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir: tempSkillDir, eventStore });

    await engine.handleSignal('DRAFT_READY');
    expect(engine.getCurrentState()).toBe('PLAN_APPROVAL');

    // Simulate Human requesting revisions
    engine.updateContext({ user_feedback: 'Please include database migration steps in the plan' });
    const res = await engine.handleSignal('USER_REVISION_REQUESTED', {
      choice: 'Request Changes',
      feedback: 'Please include database migration steps in the plan',
    });

    expect(res.transitioned).toBe(true);
    expect(res.newState).toBe('PLAN_DRAFT');
    expect(engine.getCurrentState()).toBe('PLAN_DRAFT');
    expect(engine.getContext().user_feedback).toBe('Please include database migration steps in the plan');
  });

  it('should transition automatically from ask_question tool output', async () => {
    const eventStore = new EventStore({ inMemory: true });
    const engine = new FSMEngine({ skillDir: tempSkillDir, eventStore });

    await engine.handleSignal('DRAFT_READY');

    // Agent executes ask_question and user responds "Approve Plan"
    const res = await engine.handleSignal('USER_APPROVED', {
      choice: 'Approve Plan',
      result: { choice: 'Approve Plan' },
    });

    expect(res.transitioned).toBe(true);
    expect(res.newState).toBe('EXECUTION');
  });
});