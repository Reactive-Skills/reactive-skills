import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@reactive-skills/runtime', () => ({
  FSMEngine: vi.fn().mockImplementation(() => ({
    getManifest: vi.fn(() => ({
      name: 'test-skill',
      schema_version: '2.0.0',
      description: 'Test skill',
      initial_state: 'START',
      states: {
        START: { description: 'Initial', transitions: { DONE: { target: 'DONE' } } },
        DONE: { description: 'Done' },
      },
    })),
  })),
}));

describe('inspectCommand', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    vi.clearAllMocks();
    tmpDir = path.resolve(process.cwd(), '.tmp-inspect-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('defaults to first discovered skill when no args', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\nschema_version: 2.0.0\ninitial_state: START\nstates:\n  START:\n    description: Initial\n    transitions:\n      DONE:\n        target: DONE\n  DONE:\n    description: Done\n');

    const { inspectCommand } = await import('../../src/commands/inspect.js');
    const result = await inspectCommand([]);
    expect(result).toContain('test-skill');
  });

  it('returns skill metadata', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\nschema_version: 2.0.0\ninitial_state: START\nstates:\n  START:\n    description: Initial\n    transitions:\n      DONE:\n        target: DONE\n  DONE:\n    description: Done\n');

    const { inspectCommand } = await import('../../src/commands/inspect.js');
    const result = await inspectCommand(['skills/test-skill']);
    expect(result).toContain('skill:');
    expect(result).toContain('name: test-skill');
    expect(result).toContain('version: 2.0.0');
  });

  it('contains states and transitions', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\nschema_version: 2.0.0\ninitial_state: START\nstates:\n  START:\n    description: Initial\n    transitions:\n      DONE:\n        target: DONE\n  DONE:\n    description: Done\n');

    const { inspectCommand } = await import('../../src/commands/inspect.js');
    const result = await inspectCommand(['skills/test-skill']);
    expect(result).toContain('states[');
    expect(result).toContain('transitions[');
  });

  it('uses TOON format with skill: key from renderDetail', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\nschema_version: 2.0.0\ninitial_state: START\nstates:\n  START:\n    description: Initial\n    transitions:\n      DONE:\n        target: DONE\n  DONE:\n    description: Done\n');

    const { inspectCommand } = await import('../../src/commands/inspect.js');
    const result = await inspectCommand(['skills/test-skill']);
    expect(result).toContain('skill:');
  });
});

