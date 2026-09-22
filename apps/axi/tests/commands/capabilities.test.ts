import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { capabilitiesCommand } from '../../src/commands/capabilities.js';
import { preflightCommand } from '../../src/commands/preflight.js';

describe('runtime capability commands', () => {
  let originalCwd: string;
  let tempDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-capabilities-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('reports machine-readable AXI and runtime capabilities', async () => {
    const result = JSON.parse(await capabilitiesCommand(['--json']));

    expect(result.transport).toBe('axi');
    expect(result.launcher).toBe('direct');
    expect(result.scope).toBe('local');
    expect(result.runtime_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.axi_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.capabilities).toContain('runtime.preflight');
  });

  it('preflights declared runtime requirements without creating a job', async () => {
    const skillDir = path.join(tempDir, 'skills', 'compatible-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      [
        'schema_version: "2.1.0"',
        'name: compatible-skill',
        'description: Compatible test skill',
        'initial_state: INIT',
        'runtime_requirements:',
        '  min_runtime_version: "0.10.0"',
        '  required_capabilities:',
        '    - runtime.preflight',
        'states:',
        '  INIT:',
        '    description: Init',
      ].join('\n'),
      'utf8'
    );

    const result = JSON.parse(await preflightCommand(['compatible-skill', '--json']));

    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe('compatible');
    expect(result.results[0].requirements.missing_capabilities).toEqual([]);
    expect(fs.existsSync(path.join(tempDir, '.reactive'))).toBe(false);
  });
});
