import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../../dist/cli/index.js', import.meta.url));
let sandbox: string;
let home: string;
let tree: string;

interface Report {
  action: string;
  dry_run: boolean;
  added: Array<{ root: string }>;
  already_known: Array<{ root: string }>;
  skipped: Array<{ path: string; reason: string }>;
  scanned_directories?: number;
  skipped_directories?: number;
  workspaces?: Array<{ root: string; has_store: boolean }>;
}

function run(args: string[], cwd = sandbox) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, HOME: home, USERPROFILE: home, XDG_STATE_HOME: path.join(home, 'state'), WORKSPACE_DIR: '', REACTIVE_JOB_ID: '', NODE_NO_WARNINGS: '1' },
  });
  expect(result.error).toBeUndefined();
  return { text: result.stdout + result.stderr, status: result.status, stdout: result.stdout };
}
function json(args: string[]): Report {
  const { stdout, status } = run([...args, '--json']);
  expect(status).toBe(0);
  return JSON.parse(stdout);
}
function makeStore(dir: string): string {
  const skillDir = path.join(dir, '.reactive', 'skills', 'fixture', 'runs', 'r1');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'job.json'), '{}');
  return fs.realpathSync(dir);
}
function catalogFiles(): string[] {
  const dir = path.join(home, 'state', 'reactive-skills', 'workspaces');
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
}
function snapshot(dir: string): string {
  const entries: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const stat = fs.statSync(full);
      entries.push(`${full}:${stat.size}:${stat.mtimeMs}`);
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(dir);
  return entries.sort().join('\n');
}

beforeEach(() => {
  sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-workspaces-register-')));
  home = path.join(sandbox, 'home');
  tree = path.join(sandbox, 'tree');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(tree, { recursive: true });
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe('workspaces register --scan', () => {
  it('registers stores at the parent and below, and lists them', () => {
    const roots = [tree, path.join(tree, 'a'), path.join(tree, 'b', 'c')].map(dir => { fs.mkdirSync(dir, { recursive: true }); return makeStore(dir); });
    const report = json(['workspaces', 'register', '--scan', tree]);
    expect(report.added.map(entry => entry.root).sort()).toEqual([...roots].sort());
    expect(report.already_known).toEqual([]);
    expect(catalogFiles()).toHaveLength(3);
    const listed = json(['workspaces', 'list']);
    expect(listed.workspaces?.map(entry => entry.root).sort()).toEqual([...roots].sort());
    expect(listed.workspaces?.every(entry => entry.has_store)).toBe(true);
  });

  it('stops at --max-depth, counting the scan parent as depth 0', () => {
    const shallow = path.join(tree, 'one');
    const deep = path.join(tree, 'one', 'two', 'three');
    for (const dir of [shallow, deep]) fs.mkdirSync(dir, { recursive: true });
    const shallowRoot = makeStore(shallow);
    const deepRoot = makeStore(deep);
    expect(json(['workspaces', 'register', '--scan', tree, '--max-depth', '1', '--dry-run']).added.map(entry => entry.root)).toEqual([shallowRoot]);
    expect(json(['workspaces', 'register', '--scan', tree, '--max-depth', '3', '--dry-run']).added.map(entry => entry.root).sort()).toEqual([shallowRoot, deepRoot].sort());
    expect(json(['workspaces', 'register', '--scan', tree, '--max-depth', '0', '--dry-run']).added).toEqual([]);
  });

  it('skips dependency and build folders and does not follow symlinks', () => {
    const real = path.join(tree, 'real');
    fs.mkdirSync(real, { recursive: true });
    const realRoot = makeStore(real);
    for (const name of ['node_modules', '.git', 'dist', 'build', 'target', '.venv', '.next']) {
      const dir = path.join(tree, name, 'inner');
      fs.mkdirSync(dir, { recursive: true });
      makeStore(dir);
    }
    const outside = path.join(sandbox, 'outside');
    fs.mkdirSync(outside, { recursive: true });
    makeStore(outside);
    fs.symlinkSync(outside, path.join(tree, 'link'), 'dir');
    const report = json(['workspaces', 'register', '--scan', tree]);
    expect(report.added.map(entry => entry.root)).toEqual([realRoot]);
    expect(report.skipped_directories).toBeGreaterThanOrEqual(7);
  });

  it('is idempotent and reports roots it already knew', () => {
    const first = path.join(tree, 'first');
    const second = path.join(tree, 'second');
    for (const dir of [first, second]) fs.mkdirSync(dir, { recursive: true });
    const firstRoot = makeStore(first);
    json(['workspaces', 'register', '--scan', tree]);
    const before = catalogFiles();
    const secondRoot = makeStore(second);
    const report = json(['workspaces', 'register', '--scan', tree]);
    expect(report.added.map(entry => entry.root)).toEqual([secondRoot]);
    expect(report.already_known.map(entry => entry.root)).toEqual([firstRoot]);
    expect(catalogFiles()).toHaveLength(before.length + 1);
    const again = json(['workspaces', 'register', '--scan', tree]);
    expect(again.added).toEqual([]);
    expect(again.already_known).toHaveLength(2);
    expect(catalogFiles()).toHaveLength(before.length + 1);
  });

  it('writes nothing in a dry run and reports what it would add', () => {
    const project = path.join(tree, 'project');
    fs.mkdirSync(project, { recursive: true });
    const root = makeStore(project);
    const report = json(['workspaces', 'register', '--scan', tree, '--dry-run']);
    expect(report.dry_run).toBe(true);
    expect(report.added.map(entry => entry.root)).toEqual([root]);
    expect(fs.existsSync(path.join(home, 'state'))).toBe(false);
    expect(json(['workspaces', 'list']).workspaces).toEqual([]);
  });

  it('never modifies or moves a store', () => {
    const project = path.join(tree, 'project');
    fs.mkdirSync(project, { recursive: true });
    makeStore(project);
    const before = snapshot(tree);
    json(['workspaces', 'register', '--scan', tree]);
    json(['workspaces', 'register', '--scan', tree]);
    expect(snapshot(tree)).toBe(before);
  });
});

describe('workspaces register <paths>', () => {
  it('registers listed workspace roots without descending and skips paths with no store', () => {
    const project = path.join(tree, 'project');
    const empty = path.join(tree, 'empty');
    const nested = path.join(project, 'nested');
    for (const dir of [project, empty, nested]) fs.mkdirSync(dir, { recursive: true });
    const root = makeStore(project);
    makeStore(nested);
    const missing = path.join(tree, 'missing');
    const report = json(['workspaces', 'register', project, empty, missing]);
    expect(report.added.map(entry => entry.root)).toEqual([root]);
    expect(report.skipped.map(entry => [entry.path, entry.reason])).toEqual([[fs.realpathSync(empty), 'no_store'], [missing, 'not_found']]);
  });

  it('requires at least one path or --scan and rejects a bad depth', () => {
    expect(run(['workspaces', 'register']).status).not.toBe(0);
    expect(run(['workspaces', 'register', '--scan', tree, '--max-depth', 'deep']).status).not.toBe(0);
    expect(run(['workspaces', 'bogus']).status).not.toBe(0);
  });

  it('prints readable output without --json', () => {
    const project = path.join(tree, 'project');
    fs.mkdirSync(project, { recursive: true });
    const root = makeStore(project);
    const { text, status } = run(['workspaces', 'register', '--scan', tree]);
    expect(status).toBe(0);
    expect(text).toContain(root);
    expect(text).toContain('added');
  });
});
