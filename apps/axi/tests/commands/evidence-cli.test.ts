import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

it('imports, reads and folds evidence through the compiled CLI across process restarts', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-evidence-cli-'));
  const cli = fileURLToPath(new URL('../../dist/cli/index.js', import.meta.url));
  const run = (...args: string[]) => {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: workspace, env: { ...process.env, WORKSPACE_DIR: workspace }, encoding: 'utf8', timeout: 15_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('error:');
    expect(result.stdout).not.toContain('"error"');
    return result.stdout;
  };
  try {
    const skill = path.join(workspace, 'skills', 'evidence-test');
    fs.mkdirSync(skill, { recursive: true });
    fs.writeFileSync(path.join(skill, 'skill.yaml'), `
schema_version: reactive/v1
name: evidence-test
description: CLI evidence fixture
initial_state: REVIEW
evidence:
  signals:
    CHECK:
      /draft: {media_type: text/plain, projection: utf8}
states:
  REVIEW:
    transitions:
      CHECK: {target: ACCEPTED, guard: 'event.payload.draft === "verified draft"'}
  ACCEPTED:
    description: Accepted
`);
    fs.writeFileSync(path.join(workspace, 'draft with spaces.txt'), 'verified draft');
    const imported = run('evidence', skill, 'import', 'draft with spaces.txt', '--media-type', 'text/plain', '--job', 'standalone');
    expect(imported).not.toContain('verified draft');
    const reference = JSON.parse(imported).reference;
    expect(JSON.parse(run('evidence', skill, 'read', JSON.stringify(reference), '--job', 'standalone')).content).toBe('verified draft');
    const explicit = run('emit', skill, 'CHECK', '--job', 'standalone', '--evidence', JSON.stringify({ '/draft': { reference } }));
    expect(explicit).toContain('transitioned: "true"');
    expect(explicit).not.toContain('verified draft');
    const args = ['emit', skill, 'CHECK', '--job', 'folded', '--evidence=' + JSON.stringify({ '/draft': { path: 'draft with spaces.txt', media_type: 'text/plain' } }), '--idempotency-key', 'once'];
    const first = run(...args);
    expect(first).toContain('transitioned: "true"');
    expect(first).not.toContain('verified draft');
    fs.unlinkSync(path.join(workspace, 'draft with spaces.txt'));
    const retry = run(...args);
    expect(retry).toContain('transitioned: "false"');
    expect(JSON.parse(retry.split('\n')[0]).evidence).toEqual(JSON.parse(first.split('\n')[0]).evidence);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 30_000);
