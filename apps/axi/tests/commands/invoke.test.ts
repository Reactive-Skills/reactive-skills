import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { JobManager } from '@reactive-skills/runtime';

describe('invokeCommand job behavior', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-invoke-test-'));
    process.chdir(tmpDir);

    const skillDir = path.join(tmpDir, 'skills', 'invoke-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "2.1.0"
name: "invoke-skill"
description: "Invoke test skill"
initial_state: "INIT"
states:
  INIT:
    prompt_template: "states/init.md"
    transitions:
      READY:
        target: "DONE"
  DONE:
    prompt_template: "states/done.md"
`
    );
    fs.writeFileSync(path.join(skillDir, 'states', 'init.md'), '# Init');
    fs.writeFileSync(path.join(skillDir, 'states', 'done.md'), '# Done');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('starts a fresh active job by default', async () => {
    const { invokeCommand } = await import('../../src/commands/invoke.js');
    const output = await invokeCommand(['invoke-skill']);
    const jobManager = new JobManager(tmpDir);
    const activeJobId = jobManager.getActiveJobId('invoke-skill');

    expect(output).toContain('invoke:');
    expect(output).toContain('run_id:');
    expect(activeJobId).not.toBe('default');
    expect(jobManager.getJob('invoke-skill', activeJobId)?.currentState).toBe('INIT');
  });

  it('starts a named isolated job without changing the global active pointer', async () => {
    const { invokeCommand } = await import('../../src/commands/invoke.js');
    const output = await invokeCommand(['invoke-skill', '--job', 'mission-alpha']);
    const jobManager = new JobManager(tmpDir);

    expect(output).toContain('run_id: mission-alpha');
    expect(jobManager.getActiveJobId('invoke-skill')).toBe('default');
    expect(fs.existsSync(path.join(tmpDir, '.reactive', 'skills', 'invoke-skill', 'jobs', 'mission-alpha', 'events.jsonl'))).toBe(true);
  });
});
