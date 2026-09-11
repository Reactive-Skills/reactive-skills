import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@reactive-skills/runtime', () => ({
  createSortableId: vi.fn(() => '01a06e96-test-sortable-id'),
  FSMEngine: vi.fn().mockImplementation(() => ({
    getCurrentState: vi.fn(() => 'INIT'),
    generatePromptSlice: vi.fn(() => ({
      rawPrompt: 'Verify reactive runtime instructions',
      allowedTools: ['run_command', 'view_file'],
      exitConditions: ['RUNTIME_READY'],
    })),
    getEventStore: vi.fn(() => ({
      getAll: vi.fn(() => [
        { id: '01a06e96-initial-event-id', type: 'SKILL_INITIALIZED' },
      ]),
    })),
  })),
}));

describe('stateCommand', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    vi.clearAllMocks();
    tmpDir = path.resolve(process.cwd(), '.tmp-state-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns validation error if no skill name and not in a skill directory', async () => {
    const { stateCommand } = await import('../../src/commands/state.js');
    const result = await stateCommand([]);
    expect(result).toContain('error:');
    expect(result).toContain('Missing skill name');
  });

  it('returns state and prompt details for a valid skill', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\nschema_version: 2.0.0\ninitial_state: INIT\nstates:\n  INIT:\n    description: Initial\n');

    const { stateCommand } = await import('../../src/commands/state.js');
    const result = await stateCommand(['test-skill']);
    expect(result).toContain('state:');
    expect(result).toContain('skill_id: test-skill');
    expect(result).toContain('current_state: INIT');
    expect(result).toContain('event_id: 01a06e96-initial-event-id');
    expect(result).toContain('raw_prompt: Verify reactive runtime instructions');
    expect(result).toContain('allowed_tools: "run_command,view_file"');
  });
});
