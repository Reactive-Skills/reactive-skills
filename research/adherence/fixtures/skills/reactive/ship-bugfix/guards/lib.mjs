// Shared helpers for ship-bugfix guards. Guards read the workspace and run checks themselves;
// they never trust a reported exit code.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function workspace(ctx) {
  return path.resolve(ctx.skillDir, '..', '..');
}

export function read(ctx, rel) {
  const file = path.join(workspace(ctx), rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

export function digest(ctx, rel) {
  const text = read(ctx, rel);
  return text === null ? null : createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** Hashes recorded when the workspace was created. */
export function baseline(ctx) {
  return JSON.parse(read(ctx, '.harness/baseline.json') ?? '{}');
}

export function runCheck(ctx, kind) {
  const result = spawnSync(process.execPath, ['--no-warnings', 'scripts/check.mjs', kind], {
    cwd: workspace(ctx),
    encoding: 'utf8',
    env: { ...process.env, HARNESS_CHECK_SOURCE: 'guard' },
  });
  return { exitCode: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

export const NEXT_STEP = {
  TRIAGE: 'write .work/triage.md (sections: Observed, Root cause, Affected file, Fix plan), then emit TRIAGE_DONE',
  REPRO: 'add a regression test for the issue to tests/cart.test.ts, run npm test and see it fail, then emit REPRO_FAILING',
  PATCH: 'fix src/cart.ts, run npm test and npm run lint until both pass, then emit FIX_VERIFIED',
  RELEASE_NOTE: 'add a bullet under "## Unreleased" / "### Fixed" in CHANGELOG.md ending with the issue number, then emit NOTE_WRITTEN',
};

export function leaf(state) {
  return String(state).split('.').pop();
}
