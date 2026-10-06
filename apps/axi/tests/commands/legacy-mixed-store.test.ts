import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventStore, JobManager } from '@reactive-skills/runtime';
import { seedMixedLegacyStore } from '../support/legacy-store.js';

const SKILL = 'mixed-store-skill';

describe('workspace mixing the legacy per-job layout with runs/ (#43)', () => {
  let tmpDir: string;
  let originalCwd: string;
  let store: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-mixed-store-'));
    process.chdir(tmpDir);

    const skillDir = path.join(tmpDir, 'skills', SKILL);
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "2.1.0"
name: "${SKILL}"
description: "Mixed legacy store test skill"
initial_state: "INIT"
context_keys:
  - mission
default_context:
  mission: "Default mission"
states:
  INIT:
    prompt_template: "states/init.md"
    transitions:
      READY:
        target: "DONE"
  DONE:
    prompt_template: "states/done.md"
`,
    );
    fs.writeFileSync(path.join(skillDir, 'states', 'init.md'), '# Init');
    fs.writeFileSync(path.join(skillDir, 'states', 'done.md'), '# Done');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const runIds = (output: string) => [...output.matchAll(/^\s+([0-9a-f-]{36}|default),/gm)].map(match => match[1]);

  describe('migratable store', () => {
    beforeEach(() => {
      store = seedMixedLegacyStore(tmpDir, SKILL);
    });

    it('invoke starts a fresh run from the manifest instead of failing on a foreign key', async () => {
      const { invokeCommand } = await import('../../src/commands/invoke.js');
      const output = await invokeCommand([SKILL]);

      expect(output).not.toMatch(/FOREIGN KEY/i);
      expect(output).toContain('invoke:');
      const runId = /run_id: (\S+)/.exec(output)![1];

      const events = new EventStore({ workspaceDir: tmpDir, skillId: SKILL, jobId: runId, enableSqlite: true });
      try {
        const [first] = events.getAll();
        expect(first.type).toBe('SKILL_INITIALIZED');
        expect(first.payload.context.mission).toBe('Default mission');
        expect(events.getLatestSnapshot()?.context.mission).toBe('Default mission');
      } finally {
        events.close();
      }
    });

    it('state reads the legacy default job', async () => {
      const { stateCommand } = await import('../../src/commands/state.js');
      const output = await stateCommand([SKILL, '--job', 'default']);

      expect(output).not.toMatch(/FOREIGN KEY/i);
      expect(output).not.toMatch(/^error:/m);
    });

    it('jobs lists each job once', async () => {
      const { invokeCommand } = await import('../../src/commands/invoke.js');
      const { jobsCommand } = await import('../../src/commands/jobs.js');
      await invokeCommand([SKILL]);
      const ids = runIds(await jobsCommand([SKILL]));

      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('store that cannot be opened', () => {
    let dbPath: string;
    let activeJob: string;

    const snapshot = () => ({
      runs: fs.existsSync(path.join(store, 'runs')) ? fs.readdirSync(path.join(store, 'runs')).sort() : [],
      active: fs.readFileSync(path.join(store, 'active_job'), 'utf8'),
      jobs: new JobManager(tmpDir).listJobs(SKILL).map(job => job.id),
    });

    beforeEach(() => {
      store = path.join(tmpDir, '.reactive', 'skills', SKILL);
      dbPath = path.join(store, 'events.db');
      fs.mkdirSync(store, { recursive: true });
      fs.writeFileSync(dbPath, 'this is not a sqlite database '.repeat(64));
      fs.writeFileSync(
        path.join(store, 'events.jsonl'),
        `${JSON.stringify({ id: 'legacy-1', seq: 1, type: 'SKILL_INITIALIZED', state: 'INIT', timestamp: '2026-01-01T00:00:00.000Z', payload: { skill: SKILL, initial_state: 'INIT', active_path: ['INIT'], context: { mission: 'Legacy mission' } } })}\n`,
      );
      activeJob = 'pinned';
      fs.writeFileSync(path.join(store, 'active_job'), activeJob);
    });

    it('invoke registers no job and names the store path and a recovery command', async () => {
      const before = snapshot();
      const { invokeCommand } = await import('../../src/commands/invoke.js');
      const output = await invokeCommand([SKILL]);

      expect(snapshot()).toEqual(before);
      expect(output).toMatch(/^error:/m);
      expect(output).toContain(dbPath);
      expect(output).toContain(`mv "${dbPath}" "${dbPath}.bak"`);
      expect(output).not.toContain('Check the skill name');
    });

    it('state names the store path and a recovery command', async () => {
      const { stateCommand } = await import('../../src/commands/state.js');
      const output = await stateCommand([SKILL]);

      expect(output).toContain(dbPath);
      expect(output).toContain(`mv "${dbPath}" "${dbPath}.bak"`);
    });

    it('invoke succeeds after the recovery command is applied', async () => {
      const { invokeCommand } = await import('../../src/commands/invoke.js');
      await invokeCommand([SKILL]);
      fs.renameSync(dbPath, `${dbPath}.bak`);

      const output = await invokeCommand([SKILL]);
      expect(output).not.toMatch(/^error:/m);
      expect(output).toContain('invoke:');
    });
  });
});
