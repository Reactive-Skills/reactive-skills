import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { jobsCommand } from '../../src/commands/jobs.js';
import { stateCommand } from '../../src/commands/state.js';
import { emitCommand } from '../../src/commands/emit.js';
import { JobManager } from '@reactive-skills/runtime';

describe('AXI jobs Command Suite (Leaf 5)', () => {
  let tmpDir: string;
  let originalCwd: string;
  let skillDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-jobs-test-'));
    process.chdir(tmpDir);

    skillDir = path.join(tmpDir, 'skills', 'test-jobs-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.mkdirSync(path.join(skillDir, 'templates'), { recursive: true });

    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "2.1.0"
name: "test-jobs-skill"
description: "Test skill for AXI jobs command"
initial_state: "INIT"
states:
  INIT:
    transitions:
      ADVANCE:
        target: "COMPLETE"
  COMPLETE:
    transitions: {}
deliverable_projections:
  - template: "templates/progress.md.hbs"
    output: ".docs/test-jobs-skill/PROGRESS.md"
    trigger_on:
      - "STATE_TRANSITION"
`
    );

    fs.writeFileSync(path.join(skillDir, 'states', 'init.md'), '# Init State');
    fs.writeFileSync(path.join(skillDir, 'states', 'complete.md'), '# Complete State');
    fs.writeFileSync(
      path.join(skillDir, 'templates', 'progress.md.hbs'),
      '# Progress for {{skillName}}\nCurrent State: {{currentState}}'
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('jobs list renders toon table: shows all jobs with status and active marker', async () => {
    // Run two distinct jobs
    await emitCommand(['test-jobs-skill', 'ADVANCE', '--job', 'slice-one']);
    await emitCommand(['test-jobs-skill', 'ADVANCE', '--job', 'slice-two']);

    const listOutput = await jobsCommand(['test-jobs-skill']);
    expect(listOutput).toContain('jobs');
    expect(listOutput).toContain('slice-one');
    expect(listOutput).toContain('slice-two');
  });

  it('jobs switch re-mirrors root deliverables: switches active pointer and mirrors archive files', async () => {
    // Run slice-alpha to COMPLETE
    await emitCommand(['test-jobs-skill', 'ADVANCE', '--job', 'slice-alpha']);

    // Run slice-beta but set it active and stay in INIT
    const jobManager = new JobManager(tmpDir);
    jobManager.createJob('test-jobs-skill', { id: 'slice-beta', name: 'slice-beta', setActive: true });
    await stateCommand(['test-jobs-skill']);

    // Root file should reflect slice-beta or be empty
    const rootFile = path.join(tmpDir, '.docs', 'test-jobs-skill', 'PROGRESS.md');

    // Switch to slice-alpha
    const switchOutput = await jobsCommand(['switch', 'test-jobs-skill', 'slice-alpha']);
    expect(switchOutput).toContain('slice-alpha');
    expect(jobManager.getActiveJobId('test-jobs-skill')).toBe('slice-alpha');

    // Root file should now be re-mirrored from slice-alpha's archive!
    expect(fs.existsSync(rootFile)).toBe(true);
    expect(fs.readFileSync(rootFile, 'utf8')).toContain('Current State: COMPLETE');
  });

  it('jobs archive rotates pointer: marks target job as archived and rotates active pointer', async () => {
    const jobManager = new JobManager(tmpDir);
    jobManager.setActiveJobId('test-jobs-skill', 'job-to-archive');
    await stateCommand(['test-jobs-skill']);

    const archiveOutput = await jobsCommand(['archive', 'test-jobs-skill', 'job-to-archive']);
    expect(archiveOutput).toContain('job-to-archive');

    const archivedJob = jobManager.getJob('test-jobs-skill', 'job-to-archive');
    expect(archivedJob?.status).toBe('archived');

    // Pointer rotated
    expect(jobManager.getActiveJobId('test-jobs-skill')).not.toBe('job-to-archive');
  });
});
