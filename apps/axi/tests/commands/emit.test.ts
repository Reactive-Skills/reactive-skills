import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const mockHandleSignal = vi.fn().mockResolvedValue({
  transitioned: true,
  previousState: 'INIT',
  newState: 'PHASE_1',
  event: { id: '01a06e96-new-event-id' },
  handledAtDepth: 0,
  deliverablesWritten: [],
});

vi.mock('@reactive-skills/runtime', () => ({
  createSortableId: vi.fn(() => '01a06e96-test-sortable-id'),
  FSMEngine: vi.fn().mockImplementation(() => ({
    handleSignal: mockHandleSignal,
    generatePromptSlice: vi.fn(() => ({
      rawPrompt: 'Phase 1 instructions',
      allowedTools: ['run_command'],
      exitConditions: ['PHASE_1_DONE'],
    })),
    getEventStore: vi.fn(() => ({
      getAll: vi.fn(() => [
        { id: '01a06e96-auto-causation-event-id', type: 'SKILL_INITIALIZED' },
      ]),
    })),
    close: vi.fn(),
  })),
}));

describe('emitCommand', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-emit-test-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      expect(path.dirname(fs.realpathSync(tmpDir))).toBe(fs.realpathSync(os.tmpdir()));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns validation error when missing arguments', async () => {
    const { emitCommand } = await import('../../src/commands/emit.js');
    const result = await emitCommand(['test-skill']);
    expect(result).toContain('error:');
    expect(result).toContain('Missing arguments');
  });

  const payloadForms = [
    { name: 'none', args: [], payload: {} },
    { name: 'JSON', args: ['{"exit_code":0}'], payload: { exit_code: 0 } },
    { name: 'file', args: ['@payload.json'], payload: { exit_code: 0 } },
    { name: 'flag JSON', args: ['--payload', '{"exit_code":0}'], payload: { exit_code: 0 } },
    { name: 'flag file', args: ['--payload', '@payload.json'], payload: { exit_code: 0 } },
  ];

  for (const signal of ['BASELINE_ESTABLISHED', 'AUTHORING_BASELINE_ESTABLISHED']) {
    it.each(payloadForms)(`preserves shorthand ${signal} with $name payload`, async ({ args, payload }) => {
      const skillDir = path.join(tmpDir, 'skills', 'test-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\n');
      fs.writeFileSync(path.join(tmpDir, 'payload.json'), '{"exit_code":0}');
      const { emitCommand } = await import('../../src/commands/emit.js');
      const { FSMEngine } = await import('@reactive-skills/runtime');

      const output = await emitCommand([
        'test-skill', signal, ...args, '--job', 'isolated-trial', '--idempotency-key', 'trial-1',
      ]);

      expect(mockHandleSignal).toHaveBeenCalledExactlyOnceWith(signal, payload, {
        source: 'cli', causationId: '01a06e96-auto-causation-event-id', idempotencyKey: 'trial-1',
      });
      expect(FSMEngine).toHaveBeenCalledWith(expect.objectContaining({
        jobId: 'isolated-trial', eventContext: { run_id: 'isolated-trial' },
      }));
      expect(output).toContain(`signal: ${signal}`);
    });
  }

  for (const eventId of ['01a06e96-8414-7c46-bf87-dd09d5547385', '01ARZ3NDEKTSV4RRFFQ69G5FAV']) {
    it.each(payloadForms)(`preserves explicit ${eventId} with $name payload`, async ({ args, payload }) => {
      const skillDir = path.join(tmpDir, 'skills', 'test-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\n');
      fs.writeFileSync(path.join(tmpDir, 'payload.json'), '{"exit_code":0}');
      const { emitCommand } = await import('../../src/commands/emit.js');

      await emitCommand(['test-skill', eventId, 'BASELINE_ESTABLISHED', ...args]);

      expect(mockHandleSignal).toHaveBeenCalledExactlyOnceWith('BASELINE_ESTABLISHED', payload, {
        source: 'cli', causationId: eventId, idempotencyKey: undefined,
      });
    });
  }

  it.each([
    ['BASELINE_ESTABLISHED', '{broken'],
    ['BASELINE_ESTABLISHED', '--payload', '{broken'],
    ['BASELINE_ESTABLISHED', '@missing.json'],
  ])('rejects malformed or missing payload for %s (%s)', async (...args) => {
    const skillDir = path.join(tmpDir, 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\n');
    const { emitCommand } = await import('../../src/commands/emit.js');

    const output = await emitCommand(['test-skill', ...args]);

    expect(output).toContain('VALIDATION_ERROR');
    expect(mockHandleSignal).not.toHaveBeenCalled();
  });

  it('shows the refusal reason when a guard refuses the signal (#22)', async () => {
    const skillDir = path.join(tmpDir, 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\n');
    mockHandleSignal.mockResolvedValueOnce({
      transitioned: false,
      previousState: 'REVIEW',
      newState: 'REVIEW',
      event: { id: '01a06e96-refused-event-id' },
      deliverablesWritten: [],
      refusalReason: 'Judgment could not be evaluated: jev is unavailable (timeout). Retry the signal when jev is reachable.',
    });
    const { emitCommand } = await import('../../src/commands/emit.js');

    const output = await emitCommand(['test-skill', 'SUBMIT', '{"exit_code":0}']);

    expect(output).toContain('transitioned: "false"');
    expect(output).toContain('refusal_reason: "Judgment could not be evaluated: jev is unavailable (timeout).');
  });

  it('labels a transition decided by a self-reported judgment (#22)', async () => {
    const skillDir = path.join(tmpDir, 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\n');
    mockHandleSignal.mockResolvedValueOnce({
      transitioned: true,
      previousState: 'REVIEW',
      newState: 'DONE',
      event: { id: '01a06e96-self-reported-event-id' },
      deliverablesWritten: [],
      judgmentBasis: 'self_reported',
    });
    const { emitCommand } = await import('../../src/commands/emit.js');

    const output = await emitCommand(['test-skill', 'SUBMIT', '{"exit_code":0}']);

    expect(output).toContain('judgment_basis: self_reported');
    expect(output).not.toContain('refusal_reason');
  });

  it('shows the self-report warning and a human decision basis (spec 0019 criteria 13 and 15)', async () => {
    const skillDir = path.join(tmpDir, 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\n');
    const base = { transitioned: true, previousState: 'REVIEW', newState: 'DONE', event: { id: '01a06e96-basis-event-id' }, deliverablesWritten: [] };
    mockHandleSignal
      .mockResolvedValueOnce({ ...base, judgmentBasis: 'self_reported', warning: 'Decided from the agent report.' })
      .mockResolvedValueOnce({ ...base, judgmentBasis: 'human' });
    const { emitCommand } = await import('../../src/commands/emit.js');

    const selfReported = await emitCommand(['test-skill', 'SUBMIT']);
    const human = await emitCommand(['test-skill', 'SUBMIT']);

    expect(selfReported).toContain('warning: Decided from the agent report.');
    expect(human).toContain('judgment_basis: human');
    expect(human).not.toContain('warning');
  });

  it('supports 2-arg syntax: emit <skill> <signal> with auto-resolved eventId', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\nschema_version: 2.0.0\ninitial_state: INIT\nstates:\n  INIT:\n    description: Initial\n');

    const { emitCommand } = await import('../../src/commands/emit.js');
    const result = await emitCommand(['test-skill', 'RUNTIME_READY']);

    expect(mockHandleSignal).toHaveBeenCalledWith(
      'RUNTIME_READY',
      {},
      expect.objectContaining({ causationId: '01a06e96-auto-causation-event-id' })
    );
    expect(result).toContain('emit:');
    expect(result).toContain('signal: RUNTIME_READY');
    expect(result).toContain('current_state: PHASE_1');
  });

  it('supports 3-arg syntax with UUID: emit <skill> <event-id> <signal>', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\nschema_version: 2.0.0\ninitial_state: INIT\nstates:\n  INIT:\n    description: Initial\n');

    const { emitCommand } = await import('../../src/commands/emit.js');
    const explicitEventId = '01a06e96-8414-7c46-bf87-dd09d5547385';
    const result = await emitCommand(['test-skill', explicitEventId, 'RUNTIME_READY']);

    expect(mockHandleSignal).toHaveBeenCalledWith(
      'RUNTIME_READY',
      {},
      expect.objectContaining({ causationId: explicitEventId })
    );
    expect(result).toContain('emit:');
    expect(result).toContain('signal: RUNTIME_READY');
  });

  it('supports payload JSON argument: emit <skill> <signal> \'{"key":"val"}\'', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\nschema_version: 2.0.0\ninitial_state: INIT\nstates:\n  INIT:\n    description: Initial\n');

    const { emitCommand } = await import('../../src/commands/emit.js');
    const result = await emitCommand(['test-skill', 'RUNTIME_READY', '{"project_type":"greenfield"}']);

    expect(mockHandleSignal).toHaveBeenCalledWith(
      'RUNTIME_READY',
      { project_type: 'greenfield' },
      expect.any(Object)
    );
    expect(result).toContain('emit:');
  });
});
