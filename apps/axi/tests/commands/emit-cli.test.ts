import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

it('transitions a named job through the compiled CLI with a long signal and payload file', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-emit-cli-'));
  const cli = fileURLToPath(new URL('../../dist/cli/index.js', import.meta.url));
  const run = (...args: string[]) => {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: workspace, encoding: 'utf8', timeout: 15_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('error:');
    return result.stdout;
  };
  try {
    const skill = path.join(workspace, 'skills', 'emit-fixture');
    fs.mkdirSync(path.join(skill, 'states'), { recursive: true });
    fs.writeFileSync(path.join(skill, 'skill.yaml'), `schema_version: "2.1.0"
name: emit-fixture
description: Long signal regression fixture
initial_state: INIT
states:
  INIT:
    prompt_template: states/init.md
    transitions:
      BASELINE_ESTABLISHED:
        target: DONE
        guard: payload.exit_code == 0
  DONE:
    prompt_template: states/done.md
`);
    fs.writeFileSync(path.join(skill, 'states/init.md'), 'Establish the baseline.');
    fs.writeFileSync(path.join(skill, 'states/done.md'), 'Baseline established.');
    const payload = path.join(workspace, 'payload with spaces.json');
    fs.writeFileSync(payload, '{"exit_code":0}');

    expect(run('invoke', skill, '--job', 'baseline')).toContain('current_state: INIT');
    expect(run('invoke', skill, '--job', 'untouched')).toContain('current_state: INIT');
    const output = run('emit', skill, 'BASELINE_ESTABLISHED', '--payload', `@${payload}`, '--job', 'baseline');
    expect(output).toContain('signal: BASELINE_ESTABLISHED');
    expect(output).toContain('transitioned: "true"');
    expect(output).toContain('current_state: DONE');
    expect(run('state', skill, '--job', 'baseline')).toContain('current_state: DONE');
    expect(run('state', skill, '--job', 'untouched')).toContain('current_state: INIT');
  } finally {
    const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(workspace));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Refusing cleanup outside the test temporary directory');
    }
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 30_000);
