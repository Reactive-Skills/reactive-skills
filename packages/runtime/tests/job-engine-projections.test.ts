import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { JobManager } from '../src/core/job-manager.js';

describe('FSMEngine & Dual-Write Projections (Leaf 3)', () => {
  let tmpDir: string;
  let skillDir: string;
  let engines: FSMEngine[] = [];

  function createEngine(options: any): FSMEngine {
    const engine = new FSMEngine({
      skillDir,
      workspaceDir: tmpDir,
      ...options,
    });
    engines.push(engine);
    return engine;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-engine-proj-test-'));
    skillDir = path.join(tmpDir, 'skills', 'test-skill');
    engines = [];

    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.mkdirSync(path.join(skillDir, 'templates'), { recursive: true });

    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "2.1.0"
name: "test-skill"
description: "Test skill for job projections"
initial_state: "START"
states:
  START:
    transitions:
      ADVANCE:
        target: "MIDDLE"
  MIDDLE:
    transitions:
      FINISH:
        target: "DONE"
  DONE:
    transitions: {}
deliverable_projections:
  - template: "templates/summary.md.hbs"
    output: ".docs/test-skill/SUMMARY.md"
    trigger_on:
      - "STATE_TRANSITION"
`
    );

    fs.writeFileSync(path.join(skillDir, 'states', 'start.md'), '# Start State');
    fs.writeFileSync(path.join(skillDir, 'states', 'middle.md'), '# Middle State');
    fs.writeFileSync(path.join(skillDir, 'states', 'done.md'), '# Done State');
    fs.writeFileSync(
      path.join(skillDir, 'templates', 'summary.md.hbs'),
      '# Summary for {{skillName}}\nCurrent State: {{currentState}}'
    );
  });

  afterEach(() => {
    for (const e of engines) {
      try {
        e.close();
      } catch {
        // ignore
      }
    }
    engines = [];
    if (fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('fsm rehydration by job: isolates state transitions per job ID', async () => {
    // Run job-1 to MIDDLE
    const engine1 = createEngine({ jobId: 'job-1' });
    await engine1.handleSignal('ADVANCE');
    expect(engine1.getCurrentState()).toBe('MIDDLE');

    // Run job-2 still at START
    const engine2 = createEngine({ jobId: 'job-2' });
    expect(engine2.getCurrentState()).toBe('START');

    // Advance job-2 to MIDDLE then DONE
    await engine2.handleSignal('ADVANCE');
    await engine2.handleSignal('FINISH');
    expect(engine2.getCurrentState()).toBe('DONE');

    // Close before rehydrating to release locks cleanly
    engine1.close();
    engine2.close();

    // Rehydrate job-1, must still be MIDDLE
    const engine1Rehydrated = createEngine({ jobId: 'job-1' });
    expect(engine1Rehydrated.getCurrentState()).toBe('MIDDLE');

    // Rehydrate job-2, must still be DONE
    const engine2Rehydrated = createEngine({ jobId: 'job-2' });
    expect(engine2Rehydrated.getCurrentState()).toBe('DONE');
  });

  it('archive directory projection: writes deliverable to historical archive at .docs/<skill>/jobs/<jobId>/', async () => {
    const engine = createEngine({ jobId: 'auth-slice' });
    await engine.handleSignal('ADVANCE');

    const archiveFile = path.join(tmpDir, '.docs', 'test-skill', 'jobs', 'auth-slice', 'SUMMARY.md');
    expect(fs.existsSync(archiveFile)).toBe(true);
    const content = fs.readFileSync(archiveFile, 'utf8');
    expect(content).toContain('Current State: MIDDLE');
  });

  it('canonical root mirror: active job dual-writes deliverables to canonical root declared in skill.yaml', async () => {
    const jobManager = new JobManager(tmpDir);
    jobManager.setActiveJobId('test-skill', 'active-slice');

    const engine = createEngine({ jobId: 'active-slice' });
    await engine.handleSignal('ADVANCE');

    const rootFile = path.join(tmpDir, '.docs', 'test-skill', 'SUMMARY.md');
    expect(fs.existsSync(rootFile)).toBe(true);
    const content = fs.readFileSync(rootFile, 'utf8');
    expect(content).toContain('Current State: MIDDLE');

    const archiveFile = path.join(tmpDir, '.docs', 'test-skill', 'jobs', 'active-slice', 'SUMMARY.md');
    expect(fs.existsSync(archiveFile)).toBe(true);
  });

  it('inactive job does not overwrite root: secondary job preserves active root deliverables', async () => {
    const jobManager = new JobManager(tmpDir);
    jobManager.setActiveJobId('test-skill', 'primary-job');

    // Primary job writes root
    const primaryEngine = createEngine({ jobId: 'primary-job' });
    await primaryEngine.handleSignal('ADVANCE');

    const rootFile = path.join(tmpDir, '.docs', 'test-skill', 'SUMMARY.md');
    expect(fs.readFileSync(rootFile, 'utf8')).toContain('Current State: MIDDLE');

    // Secondary job transitions to DONE but is NOT the active job
    const secondaryEngine = createEngine({ jobId: 'secondary-job' });
    await secondaryEngine.handleSignal('ADVANCE');
    await secondaryEngine.handleSignal('FINISH');

    // Secondary archive should have DONE
    const secondaryArchive = path.join(tmpDir, '.docs', 'test-skill', 'jobs', 'secondary-job', 'SUMMARY.md');
    expect(fs.existsSync(secondaryArchive)).toBe(true);
    expect(fs.readFileSync(secondaryArchive, 'utf8')).toContain('Current State: DONE');

    // Root file must STILL be MIDDLE from primary job!
    expect(fs.readFileSync(rootFile, 'utf8')).toContain('Current State: MIDDLE');
  });

  it('template receives jobId: exposes jobId directly in projection context', async () => {
    fs.writeFileSync(
      path.join(skillDir, 'templates', 'summary.md.hbs'),
      '# Summary for {{skillName}}\nJob: {{jobId}}\nState: {{currentState}}'
    );
    const engine = createEngine({ jobId: 'feature-abc' });
    await engine.handleSignal('ADVANCE');

    const archiveFile = path.join(tmpDir, '.docs', 'test-skill', 'jobs', 'feature-abc', 'SUMMARY.md');
    expect(fs.existsSync(archiveFile)).toBe(true);
    const content = fs.readFileSync(archiveFile, 'utf8');
    expect(content).toContain('Job: feature-abc');
  });
});
