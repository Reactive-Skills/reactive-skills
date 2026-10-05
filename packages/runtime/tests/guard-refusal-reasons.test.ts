import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { createReactiveMcpServer } from '../src/mcp/server.js';

// Spec 0019 criteria 20 to 23 (#32): a refused guard tells the agent why.

const skillYaml = `
schema_version: "2.0.0"
name: guard-skill
description: "Guard refusal fixture"
initial_state: REVIEW
states:
  REVIEW:
    description: "Review"
    transitions:
      CHECK_REASON:
        target: DONE
        guardFunction: guards/with-reason.js
      CHECK_BOOLEAN_FUNCTION:
        target: DONE
        guardFunction: guards/boolean.js
      CHECK_MESSAGE:
        target: DONE
        guard: "payload.ok === true"
        guard_message: "Set payload.ok to true once every criterion has evidence."
      CHECK_PLAIN:
        target: DONE
        guard: "payload.ok === true"
  DONE:
    description: "Done"
`;

const withReason = `export default function guard({ event }) {
  if (event.payload.evidence) return { passed: true };
  return { passed: false, reason: 'criterion C2 has no evidence_method' };
}
`;

const booleanGuard = `export default function guard({ event }) {
  return event.payload.ok === true;
}
`;

describe('Guard refusal reasons (#32)', () => {
  let workspaceDir: string;
  let skillDir: string;
  let engines: FSMEngine[] = [];

  beforeEach(() => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-guard-reasons-'));
    skillDir = path.join(workspaceDir, 'skills', 'guard-skill');
    fs.mkdirSync(path.join(skillDir, 'guards'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), skillYaml);
    fs.writeFileSync(path.join(skillDir, 'guards', 'with-reason.js'), withReason);
    fs.writeFileSync(path.join(skillDir, 'guards', 'boolean.js'), booleanGuard);
  });

  afterEach(() => {
    for (const engine of engines) engine.close();
    engines = [];
    try {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch {
      // Windows may still hold engine files open.
    }
  });

  const newEngine = () => {
    const engine = new FSMEngine({ skillDir, workspaceDir });
    engines.push(engine);
    return engine;
  };

  it('surfaces the reason a guard function returns with passed: false (criterion 20)', async () => {
    const engine = newEngine();

    const refused = await engine.handleSignal('CHECK_REASON', {});

    expect(refused.transitioned).toBe(false);
    expect(refused.refusalReason).toBe('criterion C2 has no evidence_method');
    const guardEvent = engine.getEventStore().query({ type: 'GUARD_EVALUATED' }).at(-1)!;
    expect(guardEvent.payload).toMatchObject({ passed: false, error: 'criterion C2 has no evidence_method' });

    const accepted = await engine.handleSignal('CHECK_REASON', { evidence: 'tests/c2.test.ts' });
    expect(accepted.transitioned).toBe(true);
    expect(accepted.newState).toBe('DONE');
  });

  it('returns guard_message when an inline guard refuses (criterion 21)', async () => {
    const engine = newEngine();

    const refused = await engine.handleSignal('CHECK_MESSAGE', { ok: false });

    expect(refused.transitioned).toBe(false);
    expect(refused.refusalReason).toBe('Set payload.ok to true once every criterion has evidence.');
  });

  it('names the expression or function file when no message is declared (criterion 22)', async () => {
    const engine = newEngine();

    const inline = await engine.handleSignal('CHECK_PLAIN', { ok: false });
    const fn = await engine.handleSignal('CHECK_BOOLEAN_FUNCTION', { ok: false });

    expect(inline.refusalReason).toBe('Guard refused: payload.ok === true');
    expect(fn.refusalReason).toBe('Guard function guards/boolean.js refused');
  });

  it('keeps boolean guards working unchanged (criterion 23)', async () => {
    const inline = await newEngine().handleSignal('CHECK_PLAIN', { ok: true });
    expect(inline.transitioned).toBe(true);

    for (const engine of engines) engine.close();
    engines = [];
    fs.rmSync(path.join(workspaceDir, '.reactive'), { recursive: true, force: true });

    const fn = await newEngine().handleSignal('CHECK_BOOLEAN_FUNCTION', { ok: true });
    expect(fn.transitioned).toBe(true);
    expect(fn.refusalReason).toBeUndefined();
  });

  it('returns a guard function reason through MCP reactive_emit_signal (H14)', async () => {
    const server = createReactiveMcpServer({ workspaceDir, defaultSkill: 'guard-skill' });
    const emit = (server as any)._registeredTools['reactive_emit_signal'];

    const response = await emit.handler({ signal: 'CHECK_REASON', skill: 'guard-skill', payload: {} }, {} as any);
    const parsed = JSON.parse(response.content[0].text);

    expect(parsed.transitioned).toBe(false);
    expect(parsed.refusalReason).toBe('criterion C2 has no evidence_method');
  });

  it('returns guard_message through MCP reactive_emit_signal', async () => {
    const server = createReactiveMcpServer({ workspaceDir, defaultSkill: 'guard-skill' });
    const emit = (server as any)._registeredTools['reactive_emit_signal'];

    const response = await emit.handler({ signal: 'CHECK_MESSAGE', skill: 'guard-skill', payload: { ok: false } }, {} as any);
    const parsed = JSON.parse(response.content[0].text);

    expect(parsed.transitioned).toBe(false);
    expect(parsed.refusalReason).toBe('Set payload.ok to true once every criterion has evidence.');
  });
});
