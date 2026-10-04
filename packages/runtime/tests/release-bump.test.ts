import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bumpScript = path.join(repositoryRoot, 'packages', 'runtime', 'scripts', 'bump-version.js');
let fixtureRoot: string | undefined;

afterEach(() => {
  if (!fixtureRoot) return;

  const resolvedFixtureRoot = path.resolve(fixtureRoot);
  const resolvedTempRoot = path.resolve(os.tmpdir());
  if (!resolvedFixtureRoot.toLowerCase().startsWith(`${resolvedTempRoot.toLowerCase()}${path.sep}`)) {
    throw new Error(`Refusing to remove fixture outside the temporary directory: ${resolvedFixtureRoot}`);
  }

  fs.rmSync(resolvedFixtureRoot, { recursive: true, force: true });
  fixtureRoot = undefined;
});

function createReleaseFixture(options: { includePreviousTag?: boolean; syncExitCode?: number } = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-skills-release-bump-'));
  fixtureRoot = tempRoot;
  const runtimeRoot = path.join(tempRoot, 'packages', 'runtime');
  const axiRoot = path.join(tempRoot, 'apps', 'axi');
  const siteRoot = path.join(tempRoot, 'apps', 'site');
  const skillRoot = path.join(tempRoot, 'skills', 'alpha');
  const runtimeScriptsRoot = path.join(runtimeRoot, 'scripts');
  const rootScriptsRoot = path.join(tempRoot, 'scripts');
  const archivedBundle = path.join(runtimeRoot, 'reactive-skills-runtime-0.0.9.tgz');
  const archivedBundleContents = Buffer.from('archived release bytes');
  const skillManifest = 'name: alpha\nversion: "5.4.3"\n';

  for (const directory of [runtimeRoot, runtimeScriptsRoot, axiRoot, siteRoot, skillRoot, rootScriptsRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  fs.writeFileSync(
    path.join(tempRoot, 'package.json'),
    JSON.stringify({ name: '@reactive-skills/workspace', version: '0.1.0' }, null, 2),
  );
  fs.writeFileSync(
    path.join(runtimeRoot, 'package.json'),
    JSON.stringify(
      {
        name: '@reactive-skills/runtime',
        version: '0.1.0',
        scripts: { build: 'node scripts/build.js' },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(runtimeRoot, 'scripts', 'build.js'), 'process.exit(0);\n');
  fs.writeFileSync(path.join(axiRoot, 'package.json'), JSON.stringify({ version: '0.1.0' }, null, 2));
  fs.writeFileSync(path.join(siteRoot, 'package.json'), JSON.stringify({ version: '0.1.0' }, null, 2));
  fs.writeFileSync(path.join(runtimeRoot, 'CHANGELOG.md'), '# Runtime Changelog\n');
  fs.writeFileSync(path.join(axiRoot, 'CHANGELOG.md'), '# AXI Changelog\n');
  fs.writeFileSync(path.join(skillRoot, 'skill.yaml'), skillManifest);
  fs.writeFileSync(archivedBundle, archivedBundleContents);
  fs.writeFileSync(
    path.join(rootScriptsRoot, 'sync-changelog.js'),
    `process.exit(${options.syncExitCode ?? 0});\n`,
  );

  const git = (...args: string[]) =>
    spawnSync('git', args, { cwd: tempRoot, encoding: 'utf8', stdio: 'pipe', timeout: 30_000,
      env: { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.fsmonitor', GIT_CONFIG_VALUE_0: 'false' } });
  for (const args of [
    ['init'],
    ['config', 'user.name', 'Release Test'],
    ['config', 'user.email', 'release-test@example.invalid'],
    ['add', '-A'],
    ['commit', '-m', 'feat: already released behavior'],
  ]) {
    const result = git(...args);
    if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }

  if (options.includePreviousTag !== false) {
    const result = git('tag', 'v0.1.0');
    if (result.status !== 0) throw new Error(result.stderr || 'git tag failed');
  }

  fs.writeFileSync(path.join(tempRoot, 'change.txt'), 'unreleased change\n');
  const commitResult = git('add', '-A');
  if (commitResult.status !== 0) throw new Error(commitResult.stderr || 'git add failed');
  const finalCommit = git('commit', '-m', 'feat(sync): add multi-skill selection');
  if (finalCommit.status !== 0) throw new Error(finalCommit.stderr || 'git commit failed');

  return { tempRoot, runtimeRoot, skillRoot, skillManifest, archivedBundle, archivedBundleContents, rootScriptsRoot };
}

function runBump(runtimeRoot: string, env: NodeJS.ProcessEnv = process.env, requestedBump = 'minor') {
  return spawnSync(process.execPath, [bumpScript, requestedBump], {
    cwd: runtimeRoot,
    encoding: 'utf8',
    timeout: 30_000,
    env,
  });
}

function failingCommandEnv(root: string, name: 'pnpm' | 'npm', exitCode: number) {
  const binRoot = path.join(root, 'bin');
  fs.mkdirSync(binRoot, { recursive: true });

  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(binRoot, `${name}.cmd`), `@echo off\r\nexit /b ${exitCode}\r\n`);
  } else {
    const commandPath = path.join(binRoot, name);
    fs.writeFileSync(commandPath, `#!/bin/sh\nexit ${exitCode}\n`);
    fs.chmodSync(commandPath, 0o755);
  }

  const pathVariable = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  const existingPath = process.env[pathVariable] ?? '';
  return { ...process.env, [pathVariable]: `${binRoot}${path.delimiter}${existingPath}` };
}

// Real Git, package-manager and archive processes exceed five seconds on Windows.
describe('release version bump', { timeout: 60_000 }, () => {
  it('uses the previous version tag, preserves skill versions, and keeps archived tarballs', () => {
    const fixture = createReleaseFixture();
    const result = runBump(fixture.runtimeRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Bump and packaging to 0.2.0 complete!');

    for (const packagePath of [
      path.join(fixture.tempRoot, 'package.json'),
      path.join(fixture.runtimeRoot, 'package.json'),
      path.join(fixture.tempRoot, 'apps', 'axi', 'package.json'),
      path.join(fixture.tempRoot, 'apps', 'site', 'package.json'),
    ]) {
      expect(JSON.parse(fs.readFileSync(packagePath, 'utf8')).version).toBe('0.2.0');
    }

    const changelog = fs.readFileSync(path.join(fixture.runtimeRoot, 'CHANGELOG.md'), 'utf8');
    expect(changelog).toContain('feat(sync): add multi-skill selection');
    expect(changelog).not.toContain('feat: already released behavior');
    expect(fs.readFileSync(path.join(fixture.skillRoot, 'skill.yaml'), 'utf8')).toBe(fixture.skillManifest);
    expect(fs.readFileSync(fixture.archivedBundle)).toEqual(fixture.archivedBundleContents);
    expect(fs.existsSync(path.join(fixture.runtimeRoot, 'reactive-skills-runtime-0.2.0.tgz'))).toBe(true);
  });

  it('accepts an explicit stable version that advances the current version', () => {
    const fixture = createReleaseFixture();
    const result = runBump(fixture.runtimeRoot, process.env, '0.3.0');

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(fixture.runtimeRoot, 'package.json'), 'utf8')).version).toBe('0.3.0');
  });

  it('fails before writing release metadata when the previous tag is missing', () => {
    const fixture = createReleaseFixture({ includePreviousTag: false });
    const result = runBump(fixture.runtimeRoot);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Required previous release tag v0.1.0 was not found');
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('Bump and packaging to 0.2.0 complete!');
    expect(JSON.parse(fs.readFileSync(path.join(fixture.runtimeRoot, 'package.json'), 'utf8')).version).toBe('0.1.0');
    expect(fs.readFileSync(path.join(fixture.runtimeRoot, 'CHANGELOG.md'), 'utf8')).toBe('# Runtime Changelog\n');
  });

  it.each(['0.1.0', '0.0.9'])('rejects an explicit version that does not advance the current version: %s', (version) => {
    const fixture = createReleaseFixture();
    const result = runBump(fixture.runtimeRoot, process.env, version);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(`Requested version ${version} must be greater than current version 0.1.0`);
    expect(JSON.parse(fs.readFileSync(path.join(fixture.runtimeRoot, 'package.json'), 'utf8')).version).toBe('0.1.0');
    expect(fs.readFileSync(path.join(fixture.runtimeRoot, 'CHANGELOG.md'), 'utf8')).toBe('# Runtime Changelog\n');
  });

  it.each(['changelog sync', 'build', 'packaging'])('fails without a completion message when %s fails', (step) => {
    const fixture = createReleaseFixture({ syncExitCode: step === 'changelog sync' ? 19 : 0 });
    let env = process.env;

    if (step === 'build') env = failingCommandEnv(fixture.tempRoot, 'pnpm', 23);
    if (step === 'packaging') env = failingCommandEnv(fixture.tempRoot, 'npm', 29);

    const result = runBump(fixture.runtimeRoot, env);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('Bump and packaging to 0.2.0 complete!');
  });
});
