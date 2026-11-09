import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../../dist/cli/index.js', import.meta.url));
let sandbox: string;
let parent: string;
let project: string;
let home: string;
const skill = 'workspace-fixture';

function run(cwd: string, args: string[], workspace = '') {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, HOME: home, USERPROFILE: home, XDG_STATE_HOME: path.join(home, 'state'), WORKSPACE_DIR: workspace, REACTIVE_JOB_ID: '', NODE_NO_WARNINGS: '1' },
  });
  expect(result.error).toBeUndefined();
  return { text: result.stdout + result.stderr, status: result.status };
}
function jobs(root = project): Array<Record<string, string>> {
  const dir = path.join(root, '.reactive', 'skills', skill, 'runs');
  return fs.readdirSync(dir).map(id => JSON.parse(fs.readFileSync(path.join(dir, id, 'job.json'), 'utf8')));
}
function events(root = project): Array<{ run_id: string }> {
  return fs.readFileSync(path.join(root, '.reactive', 'skills', skill, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
}

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-workspace-binding-'));
  parent = path.join(sandbox, 'projects');
  project = path.join(parent, 'nested');
  home = path.join(sandbox, 'home');
  const dir = path.join(home, '.agents', 'skills', skill);
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(path.join(project, 'src'));
  fs.mkdirSync(path.join(dir, 'templates'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skill.yaml'), `schema_version: "2.1.0"
name: ${skill}
description: Workspace binding fixture
initial_state: INIT
states:
  INIT:
    transitions:
      ADVANCE:
        target: DRAFTING
  DRAFTING:
    transitions:
      FINISH:
        target: REVIEW
  REVIEW:
    transitions: {}
deliverable_projections:
  - template: templates/progress.hbs
    output: .docs/${skill}/progress.md
    trigger_on: [STATE_TRANSITION]
`);
  fs.writeFileSync(path.join(dir, 'templates', 'progress.hbs'), 'State: {{currentState}}');
});
afterEach(() => fs.rmSync(sandbox, { recursive: true, force: true }));

describe('explicit workspace binding through the installed CLI', () => {
  it('binds a global skill to a nested project and keeps one run and projections across caller directories (criteria 1, 2, 3)', () => {
    const invoked = run(parent, ['invoke', skill, '--job', 'shared', '--workspace', project, '--payload', JSON.stringify({ workspace_root: parent })]);
    expect(invoked.text).not.toMatch(/^error:/m);
    expect(invoked.text).toContain(project);
    const metadata = jobs()[0];
    expect(metadata.workspaceRoot).toBe(fs.realpathSync(project));
    const state = run(parent, ['state', skill, '--job', 'shared']);
    expect(state.text).toContain(metadata.id);
    expect(state.text).toContain('caller_directory_differs');
    const emitted = run(path.join(project, 'src'), ['emit', skill, 'ADVANCE', '--job', 'shared']);
    expect(emitted.text).toContain('DRAFTING');
    expect(events().every(event => event.run_id === metadata.id)).toBe(true);
    expect(fs.readFileSync(path.join(project, '.docs', skill, 'jobs', 'shared', 'progress.md'), 'utf8')).toContain('DRAFTING');
    expect(fs.existsSync(path.join(parent, '.reactive'))).toBe(false);
    expect(fs.existsSync(path.join(project, 'src', '.reactive'))).toBe(false);
    expect(run(parent, ['jobs', skill]).text).toContain(project);
    expect(run(parent, ['events', '100', skill, '--job', 'shared']).text).toContain('STATE_TRANSITION');
    expect(run(parent, ['reset', skill, '--job', 'shared']).text).toContain('Refusing to reset');
    expect(run(parent, ['reset', skill, '--job', 'shared', '--workspace', project]).text).toContain('archived_and_replaced');
    expect(jobs().find(job => job.id === metadata.id)?.status).toBe('archived');
  });

  it.each(['state', 'emit', 'events', 'jobs', 'reset'])('makes WORKSPACE_DIR visible and consistent for %s (criterion 4)', command => {
    run(parent, ['invoke', skill, '--job', 'shared'], project);
    const args = command === 'emit' ? [command, skill, 'ADVANCE', '--job', 'shared']
      : command === 'jobs' ? [command, skill] : [command, skill, '--job', 'shared'];
    const output = run(parent, args, project);
    expect(output.text).toContain(project);
    expect(output.text).toContain('WORKSPACE_DIR');
    expect(fs.existsSync(path.join(parent, '.reactive'))).toBe(false);
  });

  it('reuses ancestor legacy jobs without a recorded root (criterion 5 and issue 26)', () => {
    run(parent, ['invoke', skill, '--job', 'legacy'], project);
    const metadata = jobs()[0];
    const file = path.join(project, '.reactive', 'skills', skill, 'runs', metadata.id, 'job.json');
    delete metadata.workspaceRoot;
    fs.writeFileSync(file, JSON.stringify(metadata));
    fs.rmSync(path.join(home, 'state'), { recursive: true, force: true });
    const output = run(path.join(project, 'src'), ['emit', skill, 'ADVANCE', '--job', 'legacy']);
    expect(output.text).toContain('DRAFTING');
    expect(events().every(event => event.run_id === metadata.id)).toBe(true);
    expect(fs.existsSync(path.join(project, 'src', '.reactive'))).toBe(false);
  });

  it('fails closed on competing stores and requires an explicit workspace (criterion 6)', () => {
    run(parent, ['invoke', skill, '--job', 'shared', '--workspace', parent]);
    run(parent, ['invoke', skill, '--job', 'shared', '--workspace', project]);
    const before = [events(parent).length, events(project).length];
    for (const command of ['invoke', 'state', 'emit', 'events', 'jobs', 'reset']) {
      const args = command === 'emit' ? [command, skill, 'ADVANCE', '--job', 'shared'] : [command, skill, '--job', 'shared'];
      expect(run(path.join(project, 'src'), args).text).toContain('Ambiguous workspace');
    }
    expect([events(parent).length, events(project).length]).toEqual(before);
    expect(fs.existsSync(path.join(project, 'src', '.reactive'))).toBe(false);
    expect(run(parent, ['state', skill, '--job', 'shared', '--workspace', project]).text).toContain(jobs()[0].id);
  });

  it('starts a new run in the caller directory instead of another cataloged project store', () => {
    const other = path.join(sandbox, 'other');
    fs.mkdirSync(other);
    run(project, ['invoke', skill, '--job', 'shared']);
    const before = events(project).length;
    for (const args of [['invoke', skill, '--job', 'feature-x'], ['invoke', skill]]) {
      const output = run(other, args);
      expect(output.text).not.toMatch(/^error:/m);
      expect(output.text).not.toContain('caller_directory_differs');
    }
    expect(jobs(other).length).toBeGreaterThan(0);
    expect(events(project)).toHaveLength(before);
    expect(jobs(project)).toHaveLength(1);
  });

  it('prefers the caller store over other cataloged stores and fails closed only outside them', () => {
    const other = path.join(sandbox, 'other');
    fs.mkdirSync(other);
    run(project, ['invoke', skill, '--job', 'shared']);
    run(other, ['invoke', skill, '--job', 'shared', '--workspace', other]);
    for (const args of [['state', skill], ['state', skill, '--job', 'shared']]) {
      const output = run(path.join(project, 'src'), args);
      expect(output.text).toContain(`workspace_root: ${JSON.stringify(fs.realpathSync(project))}`);
      expect(output.text).toContain('other_workspace_stores');
    }
    const elsewhere = path.join(sandbox, 'elsewhere');
    fs.mkdirSync(elsewhere);
    expect(run(elsewhere, ['state', skill, '--job', 'shared']).text).toContain('Ambiguous workspace');
    expect(fs.existsSync(path.join(elsewhere, '.reactive'))).toBe(false);
  });

  it('emits to a lone cataloged store from outside it but refuses reset without --workspace', () => {
    const other = path.join(sandbox, 'other');
    fs.mkdirSync(other);
    run(project, ['invoke', skill]);
    const emitted = run(other, ['emit', skill, 'ADVANCE']);
    expect(emitted.text).toContain('DRAFTING');
    expect(emitted.text).toContain('caller_directory_differs');
    for (const args of [['reset', skill], ['reset', skill, '--purge']]) {
      const refused = run(other, args);
      expect(refused.text).toContain('Refusing to reset');
      expect(refused.text).toContain('--workspace');
      expect(refused.text).toContain(fs.realpathSync(project));
    }
    expect(fs.existsSync(path.join(project, '.reactive', 'skills', skill))).toBe(true);
    expect(jobs().every(job => job.status !== 'archived')).toBe(true);
    expect(run(other, ['reset', skill, '--workspace', project]).text).toContain('archived_and_rotated');
    expect(run(other, ['reset', skill, '--purge', '--workspace', project]).text).toContain('purged');
    expect(fs.existsSync(path.join(project, '.reactive', 'skills', skill))).toBe(false);
    expect(fs.existsSync(path.join(other, '.reactive'))).toBe(false);
  });

  it('rejects an unknown global job on emit without bootstrapping a store (issue 26)', () => {
    expect(run(project, ['emit', skill, 'ADVANCE', '--job', 'missing']).text).toContain('invoke');
    expect(fs.existsSync(path.join(project, '.reactive'))).toBe(false);
  });

  it('emits from a subdirectory after mid-workflow progress without returning to INIT (issue 26)', () => {
    run(project, ['invoke', skill, '--job', 'shared']);
    const id = jobs()[0].id;
    expect(run(project, ['emit', skill, 'ADVANCE', '--job', 'shared']).text).toContain('DRAFTING');
    const output = run(path.join(project, 'src'), ['emit', skill, 'FINISH', '--job', 'shared']);
    expect(output.text).toContain('previous_state: DRAFTING');
    expect(output.text).toContain('current_state: REVIEW');
    expect(output.text).toContain(id);
    expect(events().every(event => event.run_id === id)).toBe(true);
    expect(fs.existsSync(path.join(project, 'src', '.reactive'))).toBe(false);
  });

  it('uses canonical paths, gives --workspace precedence, and preserves compact JSON diagnostics', () => {
    const linked = path.join(parent, 'linked');
    fs.symlinkSync(project, linked, 'junction');
    const invoked = run(parent, ['invoke', skill, '--job', 'canonical', '--workspace', linked, '--output', 'compact-v1'], parent);
    const result = JSON.parse(invoked.text);
    expect(result.workspace).toMatchObject({ workspace_root: fs.realpathSync(project), workspace_source: '--workspace', WORKSPACE_DIR: parent });
    expect(jobs()[0].workspaceRoot).toBe(fs.realpathSync(project));
    const elsewhere = path.join(sandbox, 'elsewhere');
    fs.mkdirSync(elsewhere);
    expect(run(elsewhere, ['state', skill, '--job', 'canonical']).text).toContain(jobs()[0].id);
    expect(fs.existsSync(path.join(elsewhere, '.reactive'))).toBe(false);
  });

  it('discovers the selected workspace for events without a skill argument', () => {
    run(parent, ['invoke', skill, '--job', 'shared'], project);
    const output = run(parent, ['events', '--job', 'shared'], project);
    expect(output.text).toContain('SKILL_INITIALIZED');
    expect(output.text).toContain('WORKSPACE_DIR');
  });

  it('rejects an explicit unknown job even when WORKSPACE_DIR selects an empty store', () => {
    run(parent, ['invoke', skill, '--job', 'shared'], project);
    for (const command of ['state', 'emit']) {
      const args = command === 'emit' ? [command, skill, 'ADVANCE', '--job', 'shared'] : [command, skill, '--job', 'shared'];
      expect(run(parent, args, parent).text).toContain('not found');
    }
    expect(fs.existsSync(path.join(parent, '.reactive'))).toBe(false);
  });

  it('refuses a copied store whose recorded root differs rather than appending to it', () => {
    run(parent, ['invoke', skill, '--job', 'shared'], project);
    fs.cpSync(path.join(project, '.reactive'), path.join(parent, '.reactive'), { recursive: true });
    const before = events(parent).length;
    expect(run(parent, ['emit', skill, 'ADVANCE', '--job', 'shared', '--workspace', parent]).text).toContain('records workspace');
    expect(events(parent)).toHaveLength(before);
  });

  it('purges only the selected workspace and leaves a sibling legacy store intact', () => {
    const legacy = path.join(home, '.agents', 'skills', '.reactive', 'skills', skill);
    fs.mkdirSync(legacy, { recursive: true });
    const marker = path.join(legacy, 'keep');
    fs.writeFileSync(marker, 'legacy store');
    run(parent, ['invoke', skill, '--job', 'shared'], project);
    expect(run(parent, ['reset', skill, '--purge', '--workspace', project]).text).toContain('purged');
    expect(fs.existsSync(path.join(project, '.reactive', 'skills', skill))).toBe(false);
    expect(fs.readFileSync(marker, 'utf8')).toBe('legacy store');
  });
});
