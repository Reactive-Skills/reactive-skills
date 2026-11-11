import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

const cli = fileURLToPath(new URL('../../dist/cli/index.js', import.meta.url));
const skill = 'dashboard-fixture';
let sandbox: string;
let home: string;
let launch: string;
const children: ChildProcess[] = [];

function env(workspace = ''): NodeJS.ProcessEnv {
  return { ...process.env, HOME: home, USERPROFILE: home, XDG_STATE_HOME: path.join(home, 'state'), WORKSPACE_DIR: workspace, REACTIVE_JOB_ID: '', NODE_NO_WARNINGS: '1' };
}

function run(cwd: string, args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 15_000, env: env() });
  expect(result.error).toBeUndefined();
  return result.stdout + result.stderr;
}

/** Start a long-running dashboard broker and resolve with its URL. */
async function startDashboard(cwd: string, args: string[] = [], workspace = ''): Promise<string> {
  const child = spawn(process.execPath, [cli, 'dashboard', '--port', '0', ...args], { cwd, env: env(workspace), stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`dashboard did not start: ${output}`)), 10_000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/url: "(http:\/\/127\.0\.0\.1:\d+)"/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
}

async function catalogJobs(url: string): Promise<Array<{ jobId: string; name: string; workspaceRoot: string }>> {
  const catalog = await (await fetch(`${url}/catalog`)).json();
  return catalog.skills.filter((entry: any) => entry.skillId === skill).flatMap((entry: any) => entry.jobs);
}

/** Open one SSE stream; `connected` resolves once the broker has registered the client, so later writes are delivered. */
function openStream(url: string, target: string): { connected: Promise<void>; waitFor: (needle: string) => Promise<string> } {
  let buffer = '';
  const listeners: Array<() => void> = [];
  const request = http.get(`${url}/events?target=${encodeURIComponent(target)}`, (response) => {
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      buffer += chunk;
      listeners.forEach((listener) => listener());
    });
  });
  request.on('error', () => undefined);
  const waitFor = (needle: string) => new Promise<string>((resolve, reject) => {
    const check = () => { if (buffer.includes(needle)) { clearTimeout(timer); resolve(buffer); } };
    const timer = setTimeout(() => { request.destroy(); reject(new Error(`no ${needle} in stream: ${buffer}`)); }, 15_000);
    listeners.push(check);
    check();
  });
  return { connected: waitFor('event: connected').then(() => undefined), waitFor };
}

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-dashboard-workspaces-'));
  home = path.join(sandbox, 'home');
  launch = path.join(sandbox, 'launch');
  const dir = path.join(home, '.agents', 'skills', skill);
  fs.mkdirSync(path.join(dir, 'templates'), { recursive: true });
  fs.mkdirSync(path.join(launch, 'app'), { recursive: true });
  fs.mkdirSync(path.join(launch, 'other'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skill.yaml'), `schema_version: "2.1.0"
name: ${skill}
description: Dashboard workspace fixture
initial_state: INIT
states:
  INIT:
    transitions:
      ADVANCE:
        target: DRAFTING
  DRAFTING:
    transitions: {}
`);
});

afterEach(() => {
  for (const child of children.splice(0)) child.kill('SIGTERM');
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe('dashboard workspace scope', () => {
  it('lists and streams jobs started from other project directories', async () => {
    run(path.join(launch, 'app'), ['invoke', skill, '--job', 'feature-a']);
    run(path.join(launch, 'other'), ['invoke', skill, '--job', 'feature-b']);

    const url = await startDashboard(launch);
    const jobs = await catalogJobs(url);
    const roots = new Map(jobs.map((job) => [job.name, job.workspaceRoot]));
    expect(roots.get('feature-a')).toBe(fs.realpathSync(path.join(launch, 'app')));
    expect(roots.get('feature-b')).toBe(fs.realpathSync(path.join(launch, 'other')));

    const job = jobs.find((entry) => entry.name === 'feature-a')!;
    const stream = openStream(url, `${skill}/${job.jobId}`);
    await stream.connected;
    run(path.join(launch, 'app'), ['emit', skill, 'ADVANCE', '--job', 'feature-a']);
    expect(await stream.waitFor('STATE_TRANSITION')).toContain('DRAFTING');
  });

  it('lists a project whose first run starts after the broker is already running', async () => {
    const url = await startDashboard(launch);
    expect((await catalogJobs(url)).map((job) => job.name)).not.toContain('late-feature');

    run(path.join(launch, 'other'), ['invoke', skill, '--job', 'late-feature']);
    const deadline = Date.now() + 12_000;
    let names = (await catalogJobs(url)).map((job) => job.name);
    while (!names.includes('late-feature') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      names = (await catalogJobs(url)).map((job) => job.name);
    }
    expect(names).toContain('late-feature');
  });

  it('still starts and lists the caller store when the user-level workspace catalog is damaged', async () => {
    run(path.join(launch, 'app'), ['invoke', skill, '--job', 'feature-a']);
    const catalog = path.join(home, 'state', 'reactive-skills', 'workspaces');
    fs.mkdirSync(catalog, { recursive: true });
    fs.writeFileSync(path.join(catalog, 'damaged.json'), '"not-an-absolute-path"');

    const url = await startDashboard(path.join(launch, 'app'));
    expect((await catalogJobs(url)).map((job) => job.name)).toContain('feature-a');
  });

  it('keeps an explicit workspace choice to that single store', async () => {
    run(path.join(launch, 'app'), ['invoke', skill, '--job', 'feature-a']);
    run(path.join(launch, 'other'), ['invoke', skill, '--job', 'feature-b']);

    const url = await startDashboard(launch, ['--workspace', path.join(launch, 'other')]);
    expect((await catalogJobs(url)).map((job) => job.name)).toEqual(expect.arrayContaining(['feature-b']));
    expect((await catalogJobs(url)).map((job) => job.name)).not.toContain('feature-a');

    const viaEnvironment = await startDashboard(launch, [], path.join(launch, 'app'));
    expect((await catalogJobs(viaEnvironment)).map((job) => job.name)).not.toContain('feature-b');
  });
});
