import { afterEach, beforeEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JobManager } from '../src/core/job-manager.js';
import { FSMEngine } from '../src/core/fsm-engine.js';

let sandbox: string;
let root: string;
let linked: string;
let skill: string;
beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-workspace-metadata-'));
  root = path.join(sandbox, 'project');
  linked = path.join(sandbox, 'linked');
  skill = path.join(sandbox, 'skill');
  fs.mkdirSync(root);
  fs.symlinkSync(root, linked, 'junction');
  fs.mkdirSync(skill);
  fs.writeFileSync(path.join(skill, 'skill.yaml'), 'schema_version: "2.1.0"\nname: metadata-fixture\ndescription: Workspace metadata fixture\ninitial_state: INIT\nstates:\n  INIT:\n    transitions: {}\n');
});
afterEach(() => fs.rmSync(sandbox, { recursive: true, force: true }));

it.each(['create', 'engine', 'rotation'])('records the canonical workspace through %s', mode => {
  const manager = new JobManager(linked);
  let id: string;
  if (mode === 'engine') {
    const engine = new FSMEngine({ skillDir: skill, workspaceDir: linked, initialContext: { workspace_root: sandbox } });
    id = engine.getJobId();
    engine.close();
  } else if (mode === 'rotation') {
    const job = manager.createJob('metadata-fixture', { setActive: true });
    manager.updateJob('metadata-fixture', job.id, { status: 'completed' });
    id = manager.rotateIfTerminal('metadata-fixture').activeJobId;
  } else {
    id = manager.createJob('metadata-fixture').id;
  }
  expect(manager.getJob('metadata-fixture', id)?.workspaceRoot).toBe(fs.realpathSync(root));
  expect(fs.existsSync(path.join(sandbox, '.reactive'))).toBe(false);
});

it('keeps a legacy job without a recorded root readable and resumable', () => {
  const manager = new JobManager(root);
  const job = manager.createJob('metadata-fixture', { setActive: true });
  const file = path.join(manager.getJobDir('metadata-fixture', job.id), 'job.json');
  const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete metadata.workspaceRoot;
  fs.writeFileSync(file, JSON.stringify(metadata));
  const engine = new FSMEngine({ skillDir: skill, workspaceDir: root, jobId: job.id });
  try {
    expect(engine.getJobId()).toBe(job.id);
    expect(engine.getCurrentState()).toBe('INIT');
    expect(manager.getJob('metadata-fixture', job.id)?.workspaceRoot).toBeUndefined();
  } finally { engine.close(); }
});
