import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { JobManager } from '../src/core/job-manager.js';

describe('Parent run continuation', () => {
  let tmpDir: string;
  let skillDir: string;
  const engines: FSMEngine[] = [];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-parent-run-test-'));
    skillDir = path.join(tmpDir, 'skills', 'continuation-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });

    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "2.1.0"
name: "continuation-skill"
description: "Parent run continuation test skill"
initial_state: "START"
context_keys:
  - mission
  - glossary
  - baseline
states:
  START:
    prompt_template: "states/start.md"
    transitions:
      FINISH:
        target: "DONE"
  DONE:
    prompt_template: "states/done.md"
`
    );

    fs.writeFileSync(path.join(skillDir, 'states', 'start.md'), '# Start');
    fs.writeFileSync(path.join(skillDir, 'states', 'done.md'), '# Done');
  });

  afterEach(() => {
    for (const engine of engines) {
      try {
        engine.close();
      } catch {
        // Ignore cleanup failures after a failed test.
      }
    }
    engines.length = 0;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('inherits the parent snapshot before applying child overrides', () => {
    const parent = new FSMEngine({
      skillDir,
      workspaceDir: tmpDir,
      jobId: 'parent-mission',
      initialContext: {
        mission: 'Original mission',
        glossary: ['existing-term'],
        baseline: { status: 'verified', nested: { owner: 'platform' } },
      },
    });
    engines.push(parent);

    const jobManager = new JobManager(tmpDir);
    const parentRunId = jobManager.resolveRunId('continuation-skill', 'parent-mission');
    expect(parentRunId).toBeTruthy();

    const child = new FSMEngine({
      skillDir,
      workspaceDir: tmpDir,
      jobId: 'follow-up-mission',
      parentRunId: parentRunId!,
      initialContext: { mission: 'Follow-up mission' },
    });
    engines.push(child);

    expect(child.getContext()).toMatchObject({
      mission: 'Follow-up mission',
      glossary: ['existing-term'],
      baseline: { status: 'verified', nested: { owner: 'platform' } },
    });

    const childRunId = jobManager.resolveRunId('continuation-skill', 'follow-up-mission');
    const childJob = jobManager.getJob('continuation-skill', childRunId!);
    expect(childJob?.parentRunId).toBe(parentRunId);
    expect(child.getEventStore().getAll()[0].parent_run_id).toBe(parentRunId);
  });

  it('rejects a missing parent before creating a child execution', () => {
    expect(() => new FSMEngine({
      skillDir,
      workspaceDir: tmpDir,
      jobId: 'orphan-mission',
      parentRunId: 'missing-parent',
    })).toThrow(/parent run/i);

    const jobManager = new JobManager(tmpDir);
    expect(jobManager.resolveRunId('continuation-skill', 'orphan-mission')).toBeNull();
  });
});
