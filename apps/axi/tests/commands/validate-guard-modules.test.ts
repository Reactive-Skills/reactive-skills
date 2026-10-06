import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createReactiveBootloaderReference } from '@reactive-skills/runtime';
import { validateSkill } from '../../src/commands/validate.js';

// Issue #10: validate reports guardFunction files Node will not load, without running them.

const esmGuard = `export default function guard() { return true; }\n`;
const cjsGuard = `module.exports = function guard() { return true; };\n`;

describe('validate guardFunction module format (#10)', () => {
  let skillDir: string;

  beforeEach(() => {
    skillDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-validate-guard-'));
  });

  afterEach(() => {
    fs.rmSync(skillDir, { recursive: true, force: true });
  });

  const write = (name: string, content: string) => {
    const file = path.join(skillDir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  const skillWith = (guardFunction: string) => {
    write('skill.yaml', `schema_version: 2.1.0
name: guard-skill
version: 1.0.0
description: Guard format fixture
initial_state: START
states:
  START:
    description: Initial state
    transitions:
      ADVANCE:
        target: DONE
        guardFunction: ${guardFunction}
  DONE:
    description: Done
`);
    write('SKILL.md', `# guard-skill\n\n${createReactiveBootloaderReference('guard-skill')}\n`);
    return validateSkill(skillDir);
  };

  it('accepts ESM in a .mjs guard', () => {
    write('guards/g.mjs', esmGuard);
    expect(skillWith('guards/g.mjs').errors).toEqual([]);
  });

  it('accepts CommonJS in a .cjs guard', () => {
    write('guards/g.cjs', cjsGuard);
    expect(skillWith('guards/g.cjs').errors).toEqual([]);
  });

  it('accepts CommonJS in a .js guard under a commonjs scope', () => {
    write('package.json', '{"type":"commonjs"}');
    write('guards/g.js', cjsGuard);
    expect(skillWith('guards/g.js').errors).toEqual([]);
  });

  it('accepts ESM in a .js guard under a module scope', () => {
    write('package.json', '{"type":"module"}');
    write('guards/g.js', esmGuard);
    expect(skillWith('guards/g.js').errors).toEqual([]);
  });

  it('rejects ESM in a .js guard under a commonjs scope, naming the file and the fix', () => {
    write('package.json', '{"type":"commonjs"}');
    write('guards/g.js', esmGuard);
    const result = skillWith('guards/g.js');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('guards/g.js');
    expect(result.errors[0]).toContain('Rename it to .mjs');
  });

  it('does not execute guard code', () => {
    const marker = path.join(skillDir, 'ran');
    write('package.json', '{"type":"commonjs"}');
    write('guards/g.js', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'x');\nexport default () => true;\n`);
    skillWith('guards/g.js');
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('keeps path containment, extension, and existence checks', () => {
    expect(skillWith('../outside.js').errors.join('\n')).toContain('escapes the skill directory');
    expect(skillWith('guards/g.ts').errors.join('\n')).toContain('must be a JavaScript file');
    expect(skillWith('guards/missing.js').errors.join('\n')).toContain('not found on disk');
  });
});
