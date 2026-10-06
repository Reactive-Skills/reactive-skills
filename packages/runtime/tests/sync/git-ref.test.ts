import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeSyncEngineCommand } from '../../src/sync/cli.js';
import { runDistribution } from '../../src/sync/distribution.js';

const savedEnv: Record<string, string | undefined> = {};
const ISOLATED_GIT_ENV = {
  GIT_CONFIG_GLOBAL: os.devNull,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Sync Test',
  GIT_AUTHOR_EMAIL: 'sync-test@example.com',
  GIT_COMMITTER_NAME: 'Sync Test',
  GIT_COMMITTER_EMAIL: 'sync-test@example.com',
};

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd,
    env: { ...process.env, ...ISOLATED_GIT_ENV },
    encoding: 'utf8',
  }).trim();
}

function commitAll(repo: string, message: string): string {
  git(repo, 'add', '-A');
  git(repo, 'commit', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

function writeSkill(root: string, name: string, version: string | undefined, body: string): void {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `# ${name}\n\n${body}\n`);
  if (version !== undefined) fs.writeFileSync(path.join(dir, 'skill.yaml'), `name: ${name}\nversion: "${version}"\n`);
}

interface Report {
  errors: string[];
  warnings: string[];
  refusals: { skill: string; installedVersion: string; sourceVersion: string; source: string }[];
  results: { skill: string; target: string; action: string; backupPath?: string }[];
  provenance: Record<string, Record<string, unknown>>;
}

describe('syncing from a git ref with downgrade protection', () => {
  let root: string;
  let repo: string;
  let central: string;
  let config: string;
  let statePath: string;

  beforeAll(() => {
    for (const [key, value] of Object.entries(ISOLATED_GIT_ENV)) {
      savedEnv[key] = process.env[key];
      process.env[key] = value;
    }
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-git-ref-'));
    repo = path.join(root, 'source');
    central = path.join(root, 'central');
    config = path.join(root, 'sync.json');
    statePath = path.join(root, 'sync-state.json');
    fs.mkdirSync(repo);
    git(repo, 'init', '-q', '-b', 'main');
    writeConfig([repo]);
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function writeConfig(sources: Array<string | { path: string; ref?: string }>): void {
    fs.writeFileSync(config, JSON.stringify({ sources, central, satellites: [], physicalSatellites: [] }));
  }

  async function sync(...args: string[]): Promise<{ report: Report; exitCode: number; output: string }> {
    const result = await executeSyncEngineCommand(['--config', config, '--json', ...args]);
    return { report: JSON.parse(result.output) as Report, exitCode: result.exitCode, output: result.output };
  }

  function installed(name: string): string {
    return fs.readFileSync(path.join(central, name, 'SKILL.md'), 'utf8');
  }

  /** main holds alpha 2.0.0; `feature` branches from the older 1.0.0 commit and is checked out. */
  function repoWithOlderFeatureBranch(): { oldCommit: string; newCommit: string } {
    writeSkill(repo, 'alpha', '1.0.0', 'old body');
    const oldCommit = commitAll(repo, 'alpha 1.0.0');
    writeSkill(repo, 'alpha', '2.0.0', 'new body');
    const newCommit = commitAll(repo, 'alpha 2.0.0');
    git(repo, 'checkout', '-q', '-b', 'feature', oldCommit);
    return { oldCommit, newCommit };
  }

  it('installs the ref version while the source has another branch checked out, leaving the repository untouched', async () => {
    const { newCommit } = repoWithOlderFeatureBranch();
    writeConfig([{ path: repo, ref: 'main' }]);
    const before = { head: git(repo, 'rev-parse', 'HEAD'), branch: git(repo, 'branch', '--show-current') };

    const { report, exitCode } = await sync();

    expect(report.errors).toEqual([]);
    expect(exitCode).toBe(0);
    expect(installed('alpha')).toContain('new body');
    expect(fs.readFileSync(path.join(central, 'alpha', 'skill.yaml'), 'utf8')).toContain('2.0.0');
    expect(fs.readFileSync(path.join(repo, 'alpha', 'SKILL.md'), 'utf8')).toContain('old body');
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(before.head);
    expect(git(repo, 'branch', '--show-current')).toBe(before.branch);
    expect(git(repo, 'status', '--porcelain')).toBe('');
    expect(report.warnings.filter(warning => warning.includes('branch'))).toEqual([]);
    expect(report.provenance.alpha).toMatchObject({ source: repo, ref: 'main', commit: newCommit, version: '2.0.0' });
  });

  it('accepts --ref on the command line and lets it override a configured ref', async () => {
    const { oldCommit } = repoWithOlderFeatureBranch();
    writeConfig([{ path: repo, ref: 'main' }]);

    const { report } = await sync('--ref', oldCommit);

    expect(report.errors).toEqual([]);
    expect(installed('alpha')).toContain('old body');
    expect(report.provenance.alpha).toMatchObject({ ref: oldCommit, commit: oldCommit });
  });

  it('reads committed content, not the working tree, when a ref is given', async () => {
    writeSkill(repo, 'alpha', '1.0.0', 'committed');
    commitAll(repo, 'alpha');
    fs.writeFileSync(path.join(repo, 'alpha', 'SKILL.md'), '# uncommitted edit\n');
    fs.writeFileSync(path.join(repo, 'alpha', 'untracked.txt'), 'scratch');

    const { report } = await sync('--ref', 'main');

    expect(report.errors).toEqual([]);
    expect(installed('alpha')).toContain('committed');
    expect(fs.existsSync(path.join(central, 'alpha', 'untracked.txt'))).toBe(false);
    expect(report.warnings).toEqual([]);
  });

  it('refuses to replace a newer installed version, naming the skill and both versions', async () => {
    repoWithOlderFeatureBranch();
    expect((await sync('--ref', 'main')).report.errors).toEqual([]);
    const centralBefore = installed('alpha');

    const { report, exitCode, output } = await sync();

    expect(exitCode).toBe(1);
    expect(report.errors).toEqual([]);
    expect(report.refusals).toEqual([{ skill: 'alpha', installedVersion: '2.0.0', sourceVersion: '1.0.0', source: repo }]);
    expect(report.results.find(result => result.skill === 'alpha')?.action).toBe('refused_downgrade');
    expect(installed('alpha')).toBe(centralBefore);
    expect(fs.readFileSync(path.join(central, 'alpha', 'skill.yaml'), 'utf8')).toContain('2.0.0');
    expect(output).toContain('alpha');
    expect(fs.existsSync(path.join(central, '.sync-backups'))).toBe(false);
  });

  it('prints a text report that names the refused skill and both versions', async () => {
    repoWithOlderFeatureBranch();
    await sync('--ref', 'main');

    const result = await executeSyncEngineCommand(['--config', config]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('alpha: installed 2.0.0');
    expect(result.output).toContain('has 1.0.0');
    expect(result.output).toContain('REFUSED');
  });

  it('keeps syncing the other skills when one downgrade is refused', async () => {
    repoWithOlderFeatureBranch();
    await sync('--ref', 'main');
    writeSkill(repo, 'beta', '1.0.0', 'beta body');
    commitAll(repo, 'beta');

    const { report, exitCode } = await sync();

    expect(exitCode).toBe(1);
    expect(report.refusals.map(refusal => refusal.skill)).toEqual(['alpha']);
    expect(installed('beta')).toContain('beta body');
  });

  it('replaces the installed skill with --allow-downgrade and still creates the usual backup', async () => {
    repoWithOlderFeatureBranch();
    await sync('--ref', 'main');

    const { report, exitCode } = await sync('--allow-downgrade');

    expect(exitCode).toBe(0);
    expect(report.refusals).toEqual([]);
    expect(installed('alpha')).toContain('old body');
    const backup = report.results.find(result => result.action === 'backed_up')?.backupPath;
    expect(backup).toBeDefined();
    expect(fs.readFileSync(path.join(backup!, 'SKILL.md'), 'utf8')).toContain('new body');
    expect(report.warnings.some(warning => warning.includes('Downgrading alpha') && warning.includes('2.0.0') && warning.includes('1.0.0'))).toBe(true);
  });

  it('applies the downgrade check to --dry-run without writing anything', async () => {
    repoWithOlderFeatureBranch();
    await sync('--ref', 'main');
    const stateBefore = fs.readFileSync(statePath, 'utf8');
    const centralBefore = installed('alpha');

    const { report, exitCode } = await sync('--dry-run');

    expect(exitCode).toBe(1);
    expect(report.refusals).toHaveLength(1);
    expect(report.results.find(result => result.skill === 'alpha')?.action).toBe('refused_downgrade');
    expect(installed('alpha')).toBe(centralBefore);
    expect(fs.readFileSync(statePath, 'utf8')).toBe(stateBefore);
  });

  it('warns about a source on a non-default branch, naming the branch and the skills that differ', async () => {
    repoWithOlderFeatureBranch();

    const { report } = await sync();

    const warning = report.warnings.find(entry => entry.includes('"feature"'));
    expect(warning).toBeDefined();
    expect(warning).toContain('"main"');
    expect(warning).toContain('alpha');
    expect(report.provenance.alpha).toMatchObject({ source: repo, branch: 'feature' });
  });

  it('warns about uncommitted changes in the synced skills, naming the branch, without touching the repository', async () => {
    writeSkill(repo, 'alpha', '1.0.0', 'one');
    writeSkill(repo, 'beta', '1.0.0', 'two');
    writeSkill(repo, 'gamma', '1.0.0', 'three');
    commitAll(repo, 'skills');
    fs.writeFileSync(path.join(repo, 'alpha', 'SKILL.md'), '# alpha\n\nedited\n');
    fs.writeFileSync(path.join(repo, 'beta', 'new-file.md'), 'untracked');
    fs.writeFileSync(path.join(repo, 'README.md'), 'not a skill change');
    const index = fs.readFileSync(path.join(repo, '.git', 'index'));

    const { report } = await sync('--skill', 'alpha,beta');

    const warning = report.warnings.find(entry => entry.includes('uncommitted'));
    expect(warning).toContain('"main"');
    expect(warning).toContain('alpha, beta');
    expect(warning).not.toContain('gamma');
    expect(report.provenance.alpha).toMatchObject({ dirty: true });
    expect(fs.readFileSync(path.join(repo, '.git', 'index')).equals(index)).toBe(true);
    expect(git(repo, 'status', '--porcelain')).toContain('alpha/SKILL.md');
  });

  it('records the commit SHA for each skill synced from git in sync-state.json', async () => {
    writeSkill(repo, 'alpha', '1.2.0', 'one');
    const head = commitAll(repo, 'alpha');

    const { report } = await sync();

    expect(report.errors).toEqual([]);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    expect(state.version).toBe(1);
    expect(state.skills.alpha).toEqual({ source: repo, branch: 'main', commit: head, version: '1.2.0' });
  });

  it('keeps provenance of skills outside the selection and drops entries for skills no longer installed', async () => {
    writeSkill(repo, 'alpha', '1.0.0', 'one');
    writeSkill(repo, 'beta', '1.0.0', 'two');
    const first = commitAll(repo, 'first');
    await sync();
    writeSkill(repo, 'alpha', '1.1.0', 'one again');
    const second = commitAll(repo, 'second');

    await sync('--skill', 'alpha');

    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    expect(state.skills.alpha.commit).toBe(second);
    expect(state.skills.beta.commit).toBe(first);
    fs.rmSync(path.join(central, 'beta'), { recursive: true });
    await sync('--skill', 'alpha');
    expect(JSON.parse(fs.readFileSync(statePath, 'utf8')).skills.beta).toBeUndefined();
  });

  it('shows configured refs and recorded provenance in --show-config', async () => {
    writeSkill(repo, 'alpha', '1.0.0', 'one');
    const head = commitAll(repo, 'alpha');
    writeConfig([{ path: repo, ref: 'main' }]);
    await sync();

    const shown = JSON.parse((await executeSyncEngineCommand(['--config', config, '--show-config'])).output);

    expect(shown.sources).toEqual([repo]);
    expect(shown.refs).toEqual({ [repo]: 'main' });
    expect(shown.provenance.alpha).toMatchObject({ source: repo, ref: 'main', commit: head });
  });

  it('applies the downgrade check to sources that are not git repositories', async () => {
    const plain = path.join(root, 'plain');
    writeSkill(plain, 'alpha', '2.0.0', 'new');
    writeConfig([plain]);
    expect((await sync()).report.errors).toEqual([]);
    writeSkill(plain, 'alpha', '1.0.0', 'old');

    const { report, exitCode } = await sync();

    expect(exitCode).toBe(1);
    expect(report.refusals).toEqual([{ skill: 'alpha', installedVersion: '2.0.0', sourceVersion: '1.0.0', source: plain }]);
    expect(installed('alpha')).toContain('new');
    expect(report.warnings).toEqual([]);
    expect(report.provenance.alpha).toBeUndefined();
    expect(JSON.parse(fs.readFileSync(statePath, 'utf8')).skills.alpha).toEqual({ source: plain, version: '2.0.0' });
  });

  it('allows upgrades and compares versions with SemVer precedence', async () => {
    const plain = path.join(root, 'plain');
    writeConfig([plain]);
    writeSkill(plain, 'alpha', '1.9.0', 'a');
    await sync();
    writeSkill(plain, 'alpha', '1.10.0', 'b');
    expect((await sync()).report.refusals).toEqual([]);
    expect(installed('alpha')).toContain('b');
    writeSkill(plain, 'alpha', '1.10.0-rc.1', 'c');
    expect((await sync()).report.refusals).toHaveLength(1);
    expect(installed('alpha')).toContain('b');
  });

  it('warns when content changes without a version bump', async () => {
    const plain = path.join(root, 'plain');
    writeConfig([plain]);
    writeSkill(plain, 'alpha', '1.0.0', 'a');
    await sync();
    writeSkill(plain, 'alpha', '1.0.0', 'b');

    const { report, exitCode } = await sync();

    expect(exitCode).toBe(0);
    expect(installed('alpha')).toContain('b');
    expect(report.warnings).toEqual(['alpha content changed without a version bump (still 1.0.0)']);
  });

  it('treats a missing or unparseable version as unknown, warns, and still replaces the skill', async () => {
    const plain = path.join(root, 'plain');
    writeConfig([plain]);
    writeSkill(plain, 'alpha', undefined, 'a');
    writeSkill(plain, 'beta', '1.0', 'a');
    writeSkill(plain, 'gamma', '2.0.0', 'a');
    await sync();
    writeSkill(plain, 'alpha', undefined, 'b');
    writeSkill(plain, 'beta', '1.0', 'b');
    writeSkill(plain, 'gamma', 'not-a-version', 'b');

    const { report, exitCode } = await sync();

    expect(exitCode).toBe(0);
    expect(report.refusals).toEqual([]);
    for (const name of ['alpha', 'beta', 'gamma']) expect(installed(name)).toContain('b');
    expect(report.warnings.filter(warning => warning.startsWith('Cannot compare versions'))).toHaveLength(3);
    expect(report.warnings.find(warning => warning.includes('gamma'))).toContain('installed 2.0.0, source not-a-version');
  });

  it('reads a source folder that is a subdirectory of the repository and preserves links and modes', async () => {
    const skills = path.join(repo, 'skills');
    writeSkill(skills, 'alpha', '1.0.0', 'nested');
    fs.mkdirSync(path.join(skills, 'alpha', 'scripts'));
    fs.writeFileSync(path.join(skills, 'alpha', 'scripts', 'run.sh'), '#!/bin/sh\n');
    fs.chmodSync(path.join(skills, 'alpha', 'scripts', 'run.sh'), 0o755);
    fs.symlinkSync('SKILL.md', path.join(skills, 'alpha', 'link.md'));
    fs.mkdirSync(path.join(skills, 'docs'));
    fs.writeFileSync(path.join(skills, 'docs', 'SKILL.md'), '# excluded folder\n');
    fs.mkdirSync(path.join(skills, 'notes'));
    fs.writeFileSync(path.join(skills, 'notes', 'README.md'), 'no marker');
    writeSkill(repo, 'outside', '1.0.0', 'not under the source folder');
    commitAll(repo, 'skills');
    fs.writeFileSync(path.join(skills, 'alpha', 'SKILL.md'), '# edited after the commit\n');
    writeConfig([skills]);

    const { report } = await sync('--ref', 'main');

    expect(report.errors).toEqual([]);
    expect(installed('alpha')).toContain('nested');
    expect(fs.existsSync(path.join(central, 'outside'))).toBe(false);
    expect(fs.existsSync(path.join(central, 'docs'))).toBe(false);
    expect(fs.existsSync(path.join(central, 'notes'))).toBe(false);
    expect(fs.readlinkSync(path.join(central, 'alpha', 'link.md'))).toBe('SKILL.md');
    if (process.platform !== 'win32') {
      expect(fs.statSync(path.join(central, 'alpha', 'scripts', 'run.sh')).mode & 0o111).not.toBe(0);
    }
    expect(report.provenance.alpha.source).toBe(skills);
  });

  it('maps uncommitted changes to skills when the source is a subdirectory of the repository', async () => {
    const skills = path.join(repo, 'skills');
    writeSkill(skills, 'alpha', '1.0.0', 'one');
    writeSkill(skills, 'beta', '1.0.0', 'two');
    writeSkill(repo, 'outside', '1.0.0', 'elsewhere');
    commitAll(repo, 'skills');
    fs.writeFileSync(path.join(skills, 'beta', 'SKILL.md'), '# beta\n\nedited\n');
    fs.writeFileSync(path.join(repo, 'outside', 'SKILL.md'), '# edited outside the source folder\n');
    writeConfig([skills]);

    const { report } = await sync();

    expect(report.warnings.filter(warning => warning.includes('uncommitted'))).toEqual([
      `Source ${skills} (branch "main") has uncommitted changes in: beta`,
    ]);
  });

  it('reports source precedence with the original source paths when a ref is read', async () => {
    const second = path.join(root, 'second');
    writeSkill(repo, 'alpha', '1.0.0', 'first source');
    commitAll(repo, 'alpha');
    writeSkill(second, 'alpha', '1.0.0', 'second source');
    const report = runDistribution({
      sources: [{ path: repo, ref: 'main' }, second],
      central,
      satellites: [],
      physicalSatellites: [],
      statePath,
    });

    expect(report.errors).toEqual([]);
    expect(report.collisions).toEqual([{ skill: 'alpha', winner: path.join(repo, 'alpha'), shadowed: path.join(second, 'alpha') }]);
    expect(report.sourceDirs).toEqual([repo, second]);
  });

  it('fails with a clear error when the ref does not exist, and leaves the installed skills alone', async () => {
    writeSkill(repo, 'alpha', '1.0.0', 'one');
    commitAll(repo, 'alpha');

    const { report, exitCode } = await sync('--ref', 'no-such-branch');

    expect(exitCode).toBe(1);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain('no-such-branch');
    expect(fs.existsSync(central)).toBe(false);
  });

  it('fails when a ref is requested for a source that is not a git repository', async () => {
    const plain = path.join(root, 'plain');
    writeSkill(plain, 'alpha', '1.0.0', 'one');
    writeConfig([{ path: plain, ref: 'main' }]);

    const { report, exitCode } = await sync();

    expect(exitCode).toBe(1);
    expect(report.errors[0]).toContain('not a git repository');
    expect(report.errors[0]).toContain('"main"');
  });

  it('fails when the source folder does not exist at the ref', async () => {
    writeSkill(repo, 'alpha', '1.0.0', 'one');
    const first = commitAll(repo, 'alpha');
    const skills = path.join(repo, 'skills');
    writeSkill(skills, 'beta', '1.0.0', 'two');
    commitAll(repo, 'beta in a subfolder');
    writeConfig([skills]);

    const { report, exitCode } = await sync('--ref', first);

    expect(exitCode).toBe(1);
    expect(report.errors[0]).toContain('does not exist at ref');
  });

  it('rejects refs that look like git options and malformed source entries', async () => {
    const flag = await executeSyncEngineCommand(['--config', config, '--ref', '--output=/tmp/x']);
    expect(flag.exitCode).toBe(1);
    expect(flag.output).toContain('Invalid ref');
    const missing = await executeSyncEngineCommand(['--config', config, '--ref']);
    expect(missing.exitCode).toBe(1);
    expect(missing.output).toContain('--ref requires');

    fs.writeFileSync(config, JSON.stringify({ sources: [{ ref: 'main' }] }));
    const malformed = await executeSyncEngineCommand(['--config', config]);
    expect(malformed.exitCode).toBe(1);
    expect(malformed.output).toContain('Invalid sources');
    fs.writeFileSync(config, JSON.stringify({ sources: [{ path: repo, ref: '--upload-pack=x' }] }));
    expect((await executeSyncEngineCommand(['--config', config])).output).toContain('Invalid ref');
  });

  it('does not leave temporary exports of the ref behind', async () => {
    writeSkill(repo, 'alpha', '1.0.0', 'one');
    commitAll(repo, 'alpha');
    const scratch = path.join(root, 'tmp');
    fs.mkdirSync(scratch);
    const saved = { TMPDIR: process.env.TMPDIR, TMP: process.env.TMP, TEMP: process.env.TEMP };
    process.env.TMPDIR = process.env.TMP = process.env.TEMP = scratch;
    try {
      await sync('--ref', 'main');
      await sync('--ref', 'missing');
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }

    expect(fs.readdirSync(scratch)).toEqual([]);
  });
});
