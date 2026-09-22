import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { stateCommand } from '../../src/commands/state.js';
import { emitCommand } from '../../src/commands/emit.js';
import { resetCommand } from '../../src/commands/reset.js';
import { extractJobFlag, resolveWorkspaceDir } from '../../src/args.js';
import { JobManager } from '@reactive-skills/runtime';


describe('AXI CLI Job Flags & Fallbacks (Leaf 4)', () => {
  let tmpDir: string;
  let originalCwd: string;
  let skillDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-job-flags-'));
    process.chdir(tmpDir);

    skillDir = path.join(tmpDir, 'skills', 'flags-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.mkdirSync(path.join(skillDir, 'templates'), { recursive: true });

    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "2.1.0"
name: "flags-skill"
description: "Test skill for CLI job flags"
initial_state: "PHASE_1"
states:
  PHASE_1:
    transitions:
      ADVANCE:
        target: "PHASE_2"
      FINISH:
        target: "DONE"
  PHASE_2:
    transitions:
      FINISH:
        target: "DONE"
  DONE:
    transitions: {}
`
    );

    fs.writeFileSync(path.join(skillDir, 'states', 'phase_1.md'), '# Phase 1');
    fs.writeFileSync(path.join(skillDir, 'states', 'phase_2.md'), '# Phase 2');
    fs.writeFileSync(path.join(skillDir, 'states', 'done.md'), '# Done');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('state default job resolution: reads state from active job when --job is omitted', async () => {
    const output = await stateCommand(['flags-skill']);
    expect(output).toContain('flags-skill');
    expect(output).toContain('PHASE_1');
    expect(output).toContain('active');
  });

  it('state explicit job flag: isolates read to specified job', async () => {
    // Advance custom job custom-slice to PHASE_2
    await emitCommand(['flags-skill', 'ADVANCE', '--job', 'custom-slice']);

    // Default job must still be PHASE_1
    const defaultOutput = await stateCommand(['flags-skill']);
    expect(defaultOutput).toContain('PHASE_1');

    // custom-slice must be PHASE_2
    const customOutput = await stateCommand(['flags-skill', '--job', 'custom-slice']);
    expect(customOutput).toContain('PHASE_2');
    expect(customOutput).toContain('emit flags-skill <signal> --job custom-slice');
  });

  it('emit targeted job transition: transitions only targeted job', async () => {
    await emitCommand(['flags-skill', 'ADVANCE', '--job', 'isolated-run']);

    const isolatedState = await stateCommand(['flags-skill', '--job', 'isolated-run']);
    expect(isolatedState).toContain('PHASE_2');
    expect(isolatedState).toContain('emit flags-skill <signal> --job isolated-run');

    const defaultState = await stateCommand(['flags-skill']);
    expect(defaultState).toContain('PHASE_1');
  });

  it('reset archives active job: archives current active job without destroying historical jobs', async () => {
    const jobManager = new JobManager(tmpDir);

    // Run active job to PHASE_2
    await emitCommand(['flags-skill', 'ADVANCE']);

    // Reset without --purge
    const resetOutput = await resetCommand(['flags-skill']);
    expect(resetOutput).toContain('flags-skill');

    // After reset, fresh active state is back to initial state PHASE_1
    const freshState = await stateCommand(['flags-skill']);
    expect(freshState).toContain('PHASE_1');

    // Historical job files in jobs/ are preserved
    const jobs = jobManager.listJobs('flags-skill');
    expect(jobs.length).toBeGreaterThanOrEqual(1);
  });

  it('reset of an explicit isolated job does not change the global active pointer', async () => {
    const jobManager = new JobManager(tmpDir);

    await emitCommand(['flags-skill', 'ADVANCE']);
    const activeJobId = jobManager.getActiveJobId('flags-skill');
    await emitCommand(['flags-skill', 'ADVANCE', '--job', 'isolated-job']);

    const output = await resetCommand(['flags-skill', '--job', 'isolated-job']);

    expect(output).toContain('archived_and_replaced');
    expect(jobManager.getActiveJobId('flags-skill')).toBe(activeJobId);
  });

  it('resolveWorkspaceDir resolves cwd when skill is outside cwd', () => {
    const externalSkillPath = path.join(os.homedir(), '.agents', 'skills', 'global-skill');
    const resolved = resolveWorkspaceDir(externalSkillPath);
    expect(resolved).toBe(process.cwd());
  });

  it('stateCommand terminal auto-rotation: auto-rotates to fresh job when active job is terminal, but preserves historical read on explicit --job', async () => {
    const jobManager = new JobManager(tmpDir);

    // Initial state is PHASE_1
    const initialOutput = await stateCommand(['flags-skill']);
    expect(initialOutput).toContain('PHASE_1');
    const initialJobId = jobManager.getActiveJobId('flags-skill');

    // Advance to terminal state via signal emission
    await emitCommand(['flags-skill', 'FINISH']);

    // Calling state without --job should auto-rotate and boot into PHASE_1 with a fresh job ID
    const autoRotatedOutput = await stateCommand(['flags-skill']);
    expect(autoRotatedOutput).toContain('PHASE_1');
    const newActiveJobId = jobManager.getActiveJobId('flags-skill');
    expect(newActiveJobId).not.toBe(initialJobId);

    // Calling state WITH explicit --job on the old job should still inspect the old job without rotating
    const explicitOldOutput = await stateCommand(['flags-skill', '--job', initialJobId]);
    expect(explicitOldOutput).toContain('DONE');
    expect(jobManager.getActiveJobId('flags-skill')).toBe(newActiveJobId);
  });

  it('supports --run and --run-id as synonyms for --job', async () => {
    // Advance custom run isolated-run-a using --run
    await emitCommand(['flags-skill', 'ADVANCE', '--run', 'isolated-run-a']);
    const runAState = await stateCommand(['flags-skill', '--run', 'isolated-run-a']);
    expect(runAState).toContain('PHASE_2');

    // Advance custom run isolated-run-b using --run-id
    await emitCommand(['flags-skill', 'ADVANCE', '--run-id', 'isolated-run-b']);
    const runBState = await stateCommand(['flags-skill', '--run-id', 'isolated-run-b']);
    expect(runBState).toContain('PHASE_2');
  });

  it('extracts an explicit parent job without passing it into the skill payload', () => {
    expect(extractJobFlag([
      'flags-skill',
      '--job',
      'child-run',
      '--parent=parent-run',
      '--payload',
      '{"mission":"delta"}',
    ])).toMatchObject({
      jobId: 'child-run',
      parentJobId: 'parent-run',
      filteredArgs: ['flags-skill', '--payload', '{"mission":"delta"}'],
    });
  });

  it('prioritizes REACTIVE_JOB_ID environment variable across stateCommand and emitCommand', async () => {
    const originalEnv = process.env.REACTIVE_JOB_ID;
    try {
      process.env.REACTIVE_JOB_ID = 'worker-subagent-99';

      // State without --job flag should pick up REACTIVE_JOB_ID
      const output = await stateCommand(['flags-skill']);
      expect(output).toContain('flags-skill');
      expect(output).toContain('worker-subagent-99');

      // Emit without --job flag should transition worker-subagent-99
      await emitCommand(['flags-skill', 'ADVANCE']);
      const transitioned = await stateCommand(['flags-skill']);
      expect(transitioned).toContain('PHASE_2');
      expect(transitioned).toContain('worker-subagent-99');
    } finally {
      if (originalEnv === undefined) {
        delete process.env.REACTIVE_JOB_ID;
      } else {
        process.env.REACTIVE_JOB_ID = originalEnv;
      }
    }
  });
});
