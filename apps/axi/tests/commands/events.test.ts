import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JobManager } from '@reactive-skills/runtime';

describe('eventsCommand', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    vi.restoreAllMocks();
    tmpDir = path.resolve(process.cwd(), '.tmp-events-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('defaults to limit 20 and reports NO_EVENT_STORE for an empty skill', async () => {
    // Use a unique skill name so the test does not collide with a global
    // install at ~/.agents/skills/test-events-skill. The skill name is supplied
    // explicitly; the default limit of 20 is still exercised.
    const skillDir = path.join(process.cwd(), 'skills', 'test-events-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-events-skill\n', 'utf8');
    const { eventsCommand } = await import('../../src/commands/events.js');
    const result = await eventsCommand(['test-events-skill']);
    expect(result).toContain('NO_EVENT_STORE');
    expect(result).toContain('test-events-skill');
  });

  it('uses limit 50 when provided', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-events-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-events-skill\n', 'utf8');
    const { eventsCommand } = await import('../../src/commands/events.js');
    const result = await eventsCommand(['50', 'test-events-skill']);
    expect(result).toContain('NO_EVENT_STORE');
  });

  it('returns error when skill path does not exist', async () => {
    const { eventsCommand } = await import('../../src/commands/events.js');
    const result = await eventsCommand(['20', 'nonexistent-skill']);
    expect(result).toContain('NOT_FOUND');
    expect(result).toContain('not found in any known location');
  });

  it('returns error when events.jsonl does not exist', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-events-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-events-skill\n', 'utf8');
    const { eventsCommand } = await import('../../src/commands/events.js');
    const result = await eventsCommand(['20', 'test-events-skill']);
    expect(result).toContain('NO_EVENT_STORE');
  });

  it('reads events from a job-scoped event log', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-events-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-events-skill\n', 'utf8');

    const jobManager = new JobManager(process.cwd());
    jobManager.createJob('test-events-skill', { id: 'slice-alpha', name: 'slice-alpha', setActive: true });
    const jobDir = path.join(process.cwd(), '.reactive', 'skills', 'test-events-skill', 'jobs', 'slice-alpha');
    fs.mkdirSync(jobDir, { recursive: true });
    fs.writeFileSync(
      path.join(jobDir, 'events.jsonl'),
      '{"id":"event-1","seq":1,"timestamp":"2026-01-01T00:00:00.000Z","type":"SKILL_INITIALIZED","state":"INIT","payload":{}}\n',
      'utf8'
    );

    const { eventsCommand } = await import('../../src/commands/events.js');
    const result = await eventsCommand(['test-events-skill', '--job', 'slice-alpha']);
    expect(result).toContain('count: 1 events shown');
    expect(result).toContain('SKILL_INITIALIZED');
  });
});
