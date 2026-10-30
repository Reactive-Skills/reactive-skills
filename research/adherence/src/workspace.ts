// Builds one isolated trial workspace outside the repository, so the agent under test never sees repo instructions.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AXI_BIN, FIXTURES, PINNED_TDD_DIR, PINNED_TDD_PROVENANCE } from './paths.ts';
import type { Arm, TaskId } from './types.ts';

export const TASKS: Record<TaskId, { fixture: string; acceptance: string; tracked: string[] }> = {
  tdd: { fixture: 'tdd-task', acceptance: 'tdd-acceptance', tracked: ['src/auth.ts', 'tests/auth.test.ts'] },
  workflow: {
    fixture: 'workflow-task',
    acceptance: 'workflow-acceptance',
    tracked: ['src/cart.ts', 'tests/cart.test.ts', 'CHANGELOG.md', 'docs/API.md', 'package.json', '.work/triage.md'],
  },
};

export const LIBRARY_SKILLS = ['triage-bug', 'regression-fix', 'release-note', 'perf-profile', 'api-docs', 'dependency-bump'];

function gitBlobHash(content: Buffer): string {
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline setup; < 100ms)
 * - Complexity: O(f*b), f = pinned files
 * - Cyclomatic Complexity (CC): 2 (threshold <= 20) */
export function verifyPinnedTdd(): void {
  const provenance = JSON.parse(fs.readFileSync(PINNED_TDD_PROVENANCE, 'utf8')) as { files: { path: string; git_blob: string }[] };
  for (const file of provenance.files) {
    const actual = gitBlobHash(fs.readFileSync(path.join(PINNED_TDD_DIR, file.path)));
    if (actual !== file.git_blob) throw new Error(`Pinned tdd-refactor file ${file.path} does not match its Git blob hash`);
  }
}

export function sha16(file: string): string | null {
  return fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16) : null;
}

function copyDir(from: string, to: string): void {
  fs.cpSync(from, to, { recursive: true });
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline setup; < 2000ms including git init)
 * - Complexity: O(f*b), fixture files and bytes
 * - Cyclomatic Complexity (CC): 5 (threshold <= 20) */
export function prepareWorkspace(dir: string, task: TaskId, arm: Arm): { pathPrefix: string | null } {
  const spec = TASKS[task];
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  copyDir(path.join(FIXTURES, spec.fixture), dir);
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, 'shared/check.mjs'), path.join(dir, 'scripts/check.mjs'));

  if (task === 'tdd' && arm === 'flat') {
    copyDir(path.join(FIXTURES, 'skills/flat/tdd-refactor'), path.join(dir, '.skills/tdd-refactor'));
  } else if (task === 'tdd') {
    verifyPinnedTdd();
    copyDir(PINNED_TDD_DIR, path.join(dir, 'skills/tdd-refactor'));
  } else if (arm === 'flat') {
    for (const skill of LIBRARY_SKILLS) copyDir(path.join(FIXTURES, 'skills/library', skill), path.join(dir, '.skills', skill));
  } else {
    copyDir(path.join(FIXTURES, 'skills/reactive/ship-bugfix'), path.join(dir, 'skills/ship-bugfix'));
  }

  const ignore = ['.harness/', '.reactive/', 'bin/', 'node_modules/'];
  fs.writeFileSync(path.join(dir, '.gitignore'), ignore.join('\n') + '\n');
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: dir,
      stdio: 'ignore',
      env: { ...process.env, GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' },
    });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'Initial import');

  fs.mkdirSync(path.join(dir, '.harness'), { recursive: true });
  const baseline = Object.fromEntries(spec.tracked.map((rel) => [rel, sha16(path.join(dir, rel))]));
  fs.writeFileSync(path.join(dir, '.harness/baseline.json'), JSON.stringify(baseline, null, 2));

  if (arm === 'flat') return { pathPrefix: null };
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const shim = path.join(bin, 'reactive-skills-axi');
  fs.writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" --no-warnings "${AXI_BIN}" "$@"\n`);
  fs.chmodSync(shim, 0o755);
  return { pathPrefix: bin };
}
