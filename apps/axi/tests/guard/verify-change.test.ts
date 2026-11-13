import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CLI, cleanEnv, createFixture, type Fixture } from './harness.js';

const GOVERNANCE = `version: 1
governed:
  - paths: ["site/**"]
    skill: fixture
    checks:
      - name: page-has-title
        run: ["node", "checks/has-title.mjs", "site/index.html"]
`;

// Leaves a sentinel so the test can prove the check really ran, then fails unless the page has a title.
const CHECK = `import fs from 'node:fs';
fs.appendFileSync(process.env.CHECK_SENTINEL, 'ran\\n');
const page = fs.readFileSync(process.argv[2], 'utf8');
process.exit(page.includes('<title>') ? 0 : 1);
`;

interface Repo extends Fixture {
  git: (...args: string[]) => string;
  commit: (message: string) => string;
  verify: (base: string, head: string, extra?: string[]) => { status: number | null; out: string };
  sentinel: string;
  /** Drive the fixture skill to its terminal state and export the run bundle. */
  completeRun: (checkExit?: number) => string;
}

function createRepo(governance: string | null = GOVERNANCE): Repo {
  const fx = createFixture('reactive-verify-');
  const sentinel = path.join(fx.root, 'check-sentinel.txt');
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: fx.workspace, encoding: 'utf8', env: cleanEnv(fx.home) });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  fs.writeFileSync(path.join(fx.workspace, '.gitignore'), '.reactive/\n');
  fs.mkdirSync(path.join(fx.workspace, 'site'), { recursive: true });
  fs.writeFileSync(path.join(fx.workspace, 'site', 'index.html'), '<html><title>v1</title></html>\n');
  fs.mkdirSync(path.join(fx.workspace, 'checks'), { recursive: true });
  fs.writeFileSync(path.join(fx.workspace, 'checks', 'has-title.mjs'), CHECK);
  fs.writeFileSync(path.join(fx.workspace, 'README.md'), 'docs\n');
  if (governance !== null) {
    fs.mkdirSync(path.join(fx.workspace, '.reactive-governance'), { recursive: true });
    fs.writeFileSync(path.join(fx.workspace, '.reactive-governance', 'governance.yaml'), governance);
  }
  const commit = (message: string) => {
    git('add', '-A');
    git('commit', '-q', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  const verify = (base: string, head: string, extra: string[] = []) => {
    const result = spawnSync(process.execPath, [CLI, 'verify-change', '--base', base, '--head', head, ...extra], {
      cwd: fx.workspace, encoding: 'utf8', timeout: 60_000, env: cleanEnv(fx.home, { CHECK_SENTINEL: sentinel }),
    });
    return { status: result.status, out: result.stdout + result.stderr };
  };
  const completeRun = (checkExit = 0) => {
    for (const args of [
      ['invoke', 'fixture'],
      ['emit', 'fixture', 'BRIEFED'],
      ['emit', 'fixture', 'BUILT', '--payload', JSON.stringify({ check_exit: checkExit, check_status: 'passed' })],
    ]) {
      const result = fx.axi(args, { session: 'S1' });
      if (result.status !== 0 || /^error:/m.test(result.stdout)) throw new Error(`${args.join(' ')}: ${result.stdout}${result.stderr}`);
    }
    const exported = fx.axi(['export-run', 'fixture'], { session: 'S1' });
    if (exported.status !== 0) throw new Error(exported.stdout + exported.stderr);
    return fx.runId();
  };
  return { ...fx, git, commit, verify, sentinel, completeRun };
}

const bundleDir = (repo: Repo, runId: string) => path.join(repo.workspace, '.reactive-governance', 'attestations', runId);

describe('verify-change exit check', () => {
  let repo: Repo;
  let base: string;
  beforeEach(() => {
    repo = createRepo();
    base = repo.commit('base');
  });
  afterEach(() => repo.cleanup());

  it('fails a change to a governed path that has no run record', () => {
    fs.writeFileSync(path.join(repo.workspace, 'site', 'index.html'), '<html><title>v2</title></html>\n');
    const head = repo.commit('unrecorded edit');
    const result = repo.verify(base, head);
    expect(result.status).toBe(1);
    expect(result.out).toContain('site/index.html');
    expect(result.out).toContain('no run record');
  });

  it('fails a deleted governed path that has no run record', () => {
    fs.rmSync(path.join(repo.workspace, 'site', 'index.html'));
    const head = repo.commit('unrecorded delete');
    expect(repo.verify(base, head).status).toBe(1);
  });

  it('passes a recorded run whose sealed files match the change, re-running the declared check', () => {
    fs.writeFileSync(path.join(repo.workspace, 'site', 'index.html'), '<html><title>v2</title></html>\n');
    const runId = repo.completeRun();
    expect(fs.existsSync(path.join(bundleDir(repo, runId), 'manifest.json'))).toBe(true);
    const head = repo.commit('recorded edit');
    const result = repo.verify(base, head);
    expect(result.out).toContain('result: pass');
    expect(result.status).toBe(0);
    expect(fs.readFileSync(repo.sentinel, 'utf8')).toBe('ran\n');
  });

  it('re-executes the declared check and fails even though the run recorded a pass', () => {
    fs.writeFileSync(path.join(repo.workspace, 'site', 'index.html'), '<html>no title</html>\n');
    const runId = repo.completeRun(0);
    const ledger = fs.readFileSync(path.join(bundleDir(repo, runId), 'events.jsonl'), 'utf8');
    expect(ledger).toContain('"check_status":"passed"');
    const head = repo.commit('recorded pass, failing page');
    const result = repo.verify(base, head);
    expect(result.status).toBe(1);
    expect(result.out).toContain('page-has-title');
    expect(fs.readFileSync(repo.sentinel, 'utf8')).toBe('ran\n');
  });

  it('fails a bundle whose hash chain is broken', () => {
    fs.writeFileSync(path.join(repo.workspace, 'site', 'index.html'), '<html><title>v2</title></html>\n');
    const runId = repo.completeRun();
    const file = path.join(bundleDir(repo, runId), 'events.jsonl');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines[2] = lines[2].replace('"BRIEFED"', '"SKIPPED"');
    fs.writeFileSync(file, lines.join('\n'));
    const head = repo.commit('tampered bundle');
    const result = repo.verify(base, head);
    expect(result.status).toBe(1);
    expect(result.out).toContain('chain');
  });

  it('fails a governed file edited after the run sealed it', () => {
    fs.writeFileSync(path.join(repo.workspace, 'site', 'index.html'), '<html><title>v2</title></html>\n');
    repo.completeRun();
    fs.writeFileSync(path.join(repo.workspace, 'site', 'index.html'), '<html><title>v3 after the run</title></html>\n');
    const head = repo.commit('late edit');
    const result = repo.verify(base, head);
    expect(result.status).toBe(1);
    expect(result.out).toContain('sealed');
  });

  it('passes a change that touches only ungoverned paths', () => {
    fs.writeFileSync(path.join(repo.workspace, 'README.md'), 'more docs\n');
    const head = repo.commit('docs');
    const result = repo.verify(base, head);
    expect(result.status).toBe(0);
    expect(fs.existsSync(repo.sentinel)).toBe(false);
  });

  it('reads governance from the base commit, so a change cannot un-govern its own paths', () => {
    fs.writeFileSync(path.join(repo.workspace, '.reactive-governance', 'governance.yaml'), 'version: 1\ngoverned: []\n');
    fs.writeFileSync(path.join(repo.workspace, 'site', 'index.html'), '<html><title>v2</title></html>\n');
    const head = repo.commit('loosen governance');
    expect(repo.verify(base, head).status).toBe(1);
  });

  it('refuses to run declared checks on a checkout that is not the head commit', () => {
    fs.writeFileSync(path.join(repo.workspace, 'site', 'index.html'), '<html><title>v2</title></html>\n');
    repo.completeRun();
    const head = repo.commit('recorded edit');
    repo.git('checkout', '-q', base);
    const result = repo.verify(base, head);
    expect(result.status).toBe(1);
    expect(result.out).toContain('checkout');
    expect(fs.existsSync(repo.sentinel)).toBe(false);
  });

  it('fails a run exported from a skill that does not match the pinned digest', () => {
    fs.writeFileSync(path.join(repo.workspace, '.reactive-governance', 'governance.yaml'), GOVERNANCE.replace('skill: fixture', `skill: fixture\n    skill_digest: "sha256:${'0'.repeat(64)}"`));
    const pinned = repo.commit('pin digest');
    fs.writeFileSync(path.join(repo.workspace, 'site', 'index.html'), '<html><title>v2</title></html>\n');
    repo.completeRun();
    const head = repo.commit('recorded edit');
    const result = repo.verify(pinned, head);
    expect(result.status).toBe(1);
    expect(result.out).toContain('digest');
  });

  it('export-run refuses a run that has not reached a terminal state', () => {
    expect(repo.axi(['invoke', 'fixture'], { session: 'S1' }).status).toBe(0);
    const exported = repo.axi(['export-run', 'fixture'], { session: 'S1' });
    expect(exported.stdout + exported.stderr).toContain('terminal');
    expect(fs.existsSync(path.join(repo.workspace, '.reactive-governance', 'attestations'))).toBe(false);
  });
});

describe('verify-change without a governance map', () => {
  it('passes with an explicit notice that nothing is governed', () => {
    const repo = createRepo(null);
    try {
      const base = repo.commit('base');
      fs.writeFileSync(path.join(repo.workspace, 'site', 'index.html'), '<html><title>v2</title></html>\n');
      const head = repo.commit('edit');
      const result = repo.verify(base, head);
      expect(result.status).toBe(0);
      expect(result.out).toContain('nothing is governed');
    } finally {
      repo.cleanup();
    }
  });
});
