import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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
    tmpDir = path.resolve(process.cwd(), '.tmp-emit-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns validation error when missing arguments', async () => {
    const { emitCommand } = await import('../../src/commands/emit.js');
    const result = await emitCommand(['test-skill']);
    expect(result).toContain('error:');
    expect(result).toContain('Missing arguments');
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
