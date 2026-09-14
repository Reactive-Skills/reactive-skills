import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateCommand, validateSkill, discoverSkillDirs } from '../../src/commands/validate.js';
import { AxiError } from '../../src/errors.js';

describe('validateCommand', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-validate-test-'));
    process.chdir(tmpDir);
    process.exitCode = 0;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = 0;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('validates a well-formed reactive skill cleanly', async () => {
    const skillDir = path.join(tmpDir, 'skills', 'good-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });

    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: 2.1.0
name: good-skill
version: 1.0.0
description: A clean test skill
initial_state: START
states:
  START:
    description: Initial state
    prompt_template: states/start.md
    transitions:
      ADVANCE:
        target: DONE
  DONE:
    description: Completed state
    prompt_template: states/done.md
`
    );

    fs.writeFileSync(path.join(skillDir, 'states', 'start.md'), '# Start prompt');
    fs.writeFileSync(path.join(skillDir, 'states', 'done.md'), '# Done prompt');
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '<!-- REACTIVE BOOTLOADER -->\n# Good Skill Documentation'
    );

    const output = await validateCommand(['skills/good-skill']);
    expect(output).toContain('status: valid');
    expect(output).toContain('skill: good-skill');
    expect(output).toContain('errors: "0"');
    expect(process.exitCode).toBe(0);
  });

  it('detects missing prompt templates and unknown transition targets', async () => {
    const skillDir = path.join(tmpDir, 'skills', 'broken-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });

    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: 2.1.0
name: broken-skill
description: A broken skill
initial_state: START
states:
  START:
    prompt_template: states/nonexistent.md
    transitions:
      ADVANCE:
        target: NON_EXISTENT_STATE
`
    );

    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '<!-- REACTIVE BOOTLOADER -->\n# Broken Skill'
    );

    const output = await validateCommand(['skills/broken-skill']);
    expect(output).toContain('status: invalid');
    expect(output).toContain('prompt template not found on disk: states/nonexistent.md');
    expect(output).toContain('targets unknown state "NON_EXISTENT_STATE"');
    expect(process.exitCode).toBe(1);
  });

  it('flags missing universal bootloader in SKILL.md', async () => {
    const skillDir = path.join(tmpDir, 'skills', 'no-bootloader-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });

    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: 2.1.0
name: no-bootloader-skill
description: Skill without bootloader
initial_state: START
states:
  START:
    prompt_template: states/start.md
`
    );
    fs.writeFileSync(path.join(skillDir, 'states', 'start.md'), '# Start');
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Passive Markdown Only');

    const output = await validateCommand(['skills/no-bootloader-skill']);
    expect(output).toContain('status: invalid');
    expect(output).toContain('SKILL.md is missing the universal reactive bootloader marker');
    expect(process.exitCode).toBe(1);
  });

  it('flags initial_state not defined in states', async () => {
    const skillDir = path.join(tmpDir, 'skills', 'bad-initial');
    fs.mkdirSync(skillDir, { recursive: true });

    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: 2.1.0
name: bad-initial
description: Bad initial state
initial_state: MISSING_START
states:
  ACTUAL_START:
    description: Other
`
    );

    const output = await validateCommand(['skills/bad-initial']);
    expect(output).toContain('status: invalid');
    expect(output).toContain('initial_state "MISSING_START" is not defined in states');
    expect(process.exitCode).toBe(1);
  });

  it('throws NOT_FOUND when target path does not exist', async () => {
    await expect(validateCommand(['skills/non-existent-skill'])).rejects.toThrow(AxiError);
  });

  it('discovers and validates multiple skills in ./skills/', async () => {
    const skillA = path.join(tmpDir, 'skills', 'skill-a');
    const skillB = path.join(tmpDir, 'skills', 'skill-b');
    fs.mkdirSync(skillA, { recursive: true });
    fs.mkdirSync(skillB, { recursive: true });

    fs.writeFileSync(
      path.join(skillA, 'skill.yaml'),
      `schema_version: 2.1.0
name: skill-a
description: Skill A
initial_state: START
states:
  START: {}
`
    );
    fs.writeFileSync(path.join(skillA, 'SKILL.md'), '<!-- REACTIVE BOOTLOADER -->\n# Skill A');

    fs.writeFileSync(
      path.join(skillB, 'skill.yaml'),
      `schema_version: 2.1.0
name: skill-b
description: Skill B
initial_state: START
states:
  START: {}
`
    );
    fs.writeFileSync(path.join(skillB, 'SKILL.md'), '<!-- REACTIVE BOOTLOADER -->\n# Skill B');

    const output = await validateCommand([]);
    expect(output).toContain('skill-a');
    expect(output).toContain('skill-b');
    expect(output).toContain('All 2 reactive skill(s) validated successfully');
    expect(process.exitCode).toBe(0);
  });
});
