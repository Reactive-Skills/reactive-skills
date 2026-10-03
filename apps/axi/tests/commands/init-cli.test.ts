import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../../dist/cli/index.js', import.meta.url));

function inWorkspace(check: (workspace: string) => void) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-init-cli-'));
  try {
    check(workspace);
  } finally {
    const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(workspace));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Refusing cleanup outside the test temporary directory');
    }
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

function run(workspace: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: workspace, encoding: 'utf8', timeout: 15_000,
  });
  expect(result.error).toBeUndefined();
  return result;
}

it.each(['--help', '-h'])('shows creation help for %s without creating files', flag => {
  inWorkspace(workspace => {
    const result = run(workspace, 'init', flag);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readdirSync(workspace)).toEqual([]);
    expect(result.stdout).toContain('Usage: reactive-skills-axi init <name>');
    expect(result.stdout).toContain('skills/<name>');
  });
});

it('rejects an unsupported leading option without creating files', () => {
  inWorkspace(workspace => {
    const result = run(workspace, 'init', '--unknown');
    expect(fs.readdirSync(workspace)).toEqual([]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VALIDATION_ERROR');
  });
});

it('still scaffolds a valid named skill through the compiled CLI', () => {
  inWorkspace(workspace => {
    const result = run(workspace, 'init', 'valid-fixture');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('ok: created skill valid-fixture');
    const skill = path.join(workspace, 'skills', 'valid-fixture');
    expect(fs.existsSync(path.join(skill, 'states/init.md'))).toBe(true);
    const validation = run(workspace, 'validate', skill);
    expect(validation.status, validation.stderr).toBe(0);
    expect(validation.stdout).toContain('status: valid');
  });
});
