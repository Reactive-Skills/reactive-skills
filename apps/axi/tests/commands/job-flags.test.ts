import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { stateCommand } from '../../src/commands/state.js';
import { emitCommand } from '../../src/commands/emit.js';
import { resetCommand } from '../../src/commands/reset.js';
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
  PHASE_2:
    transitions: {}
`
    );

    fs.writeFileSync(path.join(skillDir, 'states', 'phase_1.md'), '# Phase 1');
    fs.writeFileSync(path.join(skillDir, 'states', 'phase_2.md'), '# Phase 2');
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
  });

  it('emit targeted job transition: transitions only targeted job', async () => {
    await emitCommand(['flags-skill', 'ADVANCE', '--job', 'isolated-run']);

    const isolatedState = await stateCommand(['flags-skill', '--job', 'isolated-run']);
    expect(isolatedState).toContain('PHASE_2');

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
});
