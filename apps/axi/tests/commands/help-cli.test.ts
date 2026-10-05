import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { COMMANDS } from '../../src/cli/commands.js';

const cli = fileURLToPath(new URL('../../dist/cli/index.js', import.meta.url));

/** Every file and directory under `root`, so a test can prove help wrote nothing. */
function listTree(root: string): string[] {
  return fs.readdirSync(root, { recursive: true, encoding: 'utf8' }).sort();
}

function inSandbox(check: (workspace: string, home: string) => void) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-help-cli-'));
  try {
    const workspace = path.join(sandbox, 'workspace');
    const home = path.join(sandbox, 'home');
    // A skill under ./skills/ gives commands that default to ./skills/ real work to do.
    fs.mkdirSync(path.join(workspace, 'skills', 'help-fixture'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'skills', 'help-fixture', 'skill.yaml'), 'name: help-fixture\n');
    fs.mkdirSync(home);
    check(workspace, home);
  } finally {
    const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(sandbox));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Refusing cleanup outside the test temporary directory');
    }
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

const cases = Object.keys(COMMANDS).flatMap((command) => [
  [command, '--help'],
  [command, '-h'],
]);

describe('every registered command honors help flags', () => {
  it.each(cases)('%s %s prints usage, exits 0, and writes nothing', (command, flag) => {
    inSandbox((workspace, home) => {
      const workspaceBefore = listTree(workspace);
      const result = spawnSync(process.execPath, [cli, command, flag], {
        cwd: workspace,
        encoding: 'utf8',
        input: '',
        timeout: 15_000,
        env: { ...process.env, HOME: home, USERPROFILE: home, APPDATA: home, XDG_CONFIG_HOME: home, WORKSPACE_DIR: '', REACTIVE_JOB_ID: '', NODE_NO_WARNINGS: '1' },
      });
      expect(result.error, 'command did not exit; help must not start servers or prompts').toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toBe('');
      // Usage must lead the output; an error block that merely suggests usage is not help.
      expect(result.stdout.startsWith(`Usage: reactive-skills-axi ${command}`), result.stdout).toBe(true);
      expect(result.stdout).not.toMatch(/^(error|code):/m);
      expect(listTree(workspace)).toEqual(workspaceBefore);
      expect(listTree(home)).toEqual([]);
    });
  });
});
