import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FSMEngine, JobManager } from '@reactive-skills/runtime';

describe('invokeCommand job behavior', () => {
  let tmpDir: string;
  let originalCwd: string;
  let skillDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-invoke-test-'));
    process.chdir(tmpDir);

    skillDir = path.join(tmpDir, 'skills', 'invoke-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "2.1.0"
name: "invoke-skill"
description: "Invoke test skill"
initial_state: "INIT"
context_keys:
  - mission
  - notes
default_context:
  mission: "Default mission"
  notes: []
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

    const runId = jobManager.resolveRunId('invoke-skill', 'mission-alpha');
    expect(runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/i);
    expect(output).toContain(`run_id: ${runId}`);
    expect(jobManager.getActiveJobId('invoke-skill')).toBe('default');
    expect(fs.existsSync(path.join(tmpDir, '.reactive', 'skills', 'invoke-skill', 'runs', runId!, 'artifacts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.reactive', 'skills', 'invoke-skill', 'events.jsonl'))).toBe(true);
  });

  it('starts a child job with inherited parent context and explicit overrides', async () => {
    const { invokeCommand } = await import('../../src/commands/invoke.js');

    await invokeCommand([
      'invoke-skill',
      '--job',
      'baseline',
      '--payload',
      '{"mission":"Baseline mission","notes":["existing note"]}',
    ]);

    const jobManager = new JobManager(tmpDir);
    const baselineRunId = jobManager.resolveRunId('invoke-skill', 'baseline');
    const parent = new FSMEngine({
      skillDir,
      workspaceDir: tmpDir,
      jobId: baselineRunId!,
    });
    try {
      expect(parent.getContext()).toMatchObject({
        mission: 'Baseline mission',
        notes: ['existing note'],
      });
    } finally {
      parent.close();
    }

    const output = await invokeCommand([
      'invoke-skill',
      '--job',
      'follow-up',
      '--parent',
      'baseline',
      '--payload',
      '{"mission":"Follow-up mission"}',
    ]);

    const followUpRunId = jobManager.resolveRunId('invoke-skill', 'follow-up');
    expect(jobManager.getJob('invoke-skill', followUpRunId!)?.parentRunId).toBe(baselineRunId);
    expect(output).toContain(`run_id: ${followUpRunId}`);

    const child = new FSMEngine({
      skillDir,
      workspaceDir: tmpDir,
      jobId: followUpRunId!,
    });
    try {
      expect(child.getContext()).toMatchObject({
        mission: 'Follow-up mission',
        notes: ['existing note'],
      });
    } finally {
      child.close();
    }
  });
});
