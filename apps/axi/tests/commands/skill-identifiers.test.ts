import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JobManager } from '@reactive-skills/runtime';
import { invokeCommand } from '../../src/commands/invoke.js';
import { jobsCommand } from '../../src/commands/jobs.js';
import { resetCommand } from '../../src/commands/reset.js';
import { resolveSkillPath } from '../../src/args.js';

// #45: jobs and reset accept the same skill identifiers as invoke and resolve the same run store,
// which the runtime keys by manifest name even when the skill directory is named differently.

const skillYaml = `schema_version: "2.1.0"
name: "test-fsm"
description: "Skill whose directory name differs from its manifest name"
initial_state: "INIT"
states:
  INIT:
    transitions:
      ADVANCE:
        target: "DONE"
  DONE:
    transitions: {}
`;

/** TOON quotes Windows paths and escapes their backslashes. */
const plain = (text: string) => text.replaceAll('\\\\', '\\').replaceAll('"', '');

describe('skill identifiers for jobs and reset (#45)', () => {
  let originalCwd: string;
  let tmpDir: string;
  let skillDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-identifiers-')));
    skillDir = path.join(tmpDir, 'skills', '_test_fsm_skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), skillYaml);
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Windows may still hold engine files open.
    }
  });

  it('lists a run started by path under the path, the directory name, and the manifest name', async () => {
    await invokeCommand([skillDir, '--job', 'demo']);

    for (const identifier of [skillDir, '_test_fsm_skill', 'test-fsm']) {
      const output = await jobsCommand([identifier]);
      expect(output, identifier).not.toContain('no_jobs_found');
      expect(output, identifier).toContain('demo');
    }
  });

  it('resolves a manifest name to the one workspace skill that declares it', () => {
    expect(resolveSkillPath('test-fsm')).toBe(skillDir);
    expect(resolveSkillPath('missing-skill')).toBeNull();
  });

  it('refuses a manifest name that more than one workspace skill declares', () => {
    const twin = path.join(tmpDir, 'skills', 'twin');
    fs.mkdirSync(twin);
    fs.writeFileSync(path.join(twin, 'skill.yaml'), skillYaml);

    expect(() => resolveSkillPath('test-fsm')).toThrow(/matches more than one skill directory/);
  });

  it("archives the run named by invoke's own reset hint", async () => {
    const output = plain(await invokeCommand([skillDir, '--job', 'demo']));
    const hint = output.match(/`reactive-skills-axi reset (.+) --job (\S+)`/);
    expect(hint).not.toBeNull();
    const [, identifier, runId] = hint!;
    expect(identifier).toBe(skillDir);

    const reset = await resetCommand([identifier, '--job', runId]);

    expect(reset).toContain('archived_and_replaced');
    expect(new JobManager(tmpDir).getJob('test-fsm', runId)?.status).toBe('archived');
  });

  it('fails for an unknown --job and names the store it searched', async () => {
    await invokeCommand([skillDir, '--job', 'demo']);
    const store = path.join(tmpDir, '.reactive', 'skills', 'test-fsm');

    await expect(resetCommand([skillDir, '--job', 'no-such-run'])).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: expect.stringContaining(store),
    });
    expect(new JobManager(tmpDir).listJobs('test-fsm').map((job) => job.name)).not.toContain('no-such-run');
  });

  it('fails for an explicit --job when the skill has no run store yet', async () => {
    await expect(resetCommand([skillDir, '--job', 'no-such-run'])).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fs.existsSync(path.join(tmpDir, '.reactive'))).toBe(false);
  });

  it('still reports nothing to clear for a bare reset without a store', async () => {
    const output = await resetCommand([skillDir]);
    expect(output).toContain('no_state_to_clear');
    expect(plain(output)).toContain(path.join(tmpDir, '.reactive', 'skills', 'test-fsm'));
  });
});
