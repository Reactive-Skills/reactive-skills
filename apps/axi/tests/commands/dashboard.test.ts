import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dashboardCommand } from '../../src/commands/dashboard.js';
import { EventStore, JobManager } from '@reactive-skills/runtime';

describe('dashboardCommand', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-dashboard-test-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports the actual listener URL and read-only broker endpoints', async () => {
    fs.mkdirSync(path.join(process.cwd(), 'skills', 'dashboard-skill'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'skills', 'dashboard-skill', 'skill.yaml'), 'name: Dashboard Skill\n', 'utf8');
    new JobManager(process.cwd()).createJob('dashboard-skill', { id: 'review-slice', setActive: true });
    const store = new EventStore({
      workspaceDir: process.cwd(),
      skillId: 'dashboard-skill',
      jobId: 'review-slice',
      enableSqlite: true,
    });
    store.append('DASHBOARD_READY', {}, { source: 'test' });
    store.close();

    const result = await dashboardCommand(['--port', '0', '--once']);

    expect(result).toContain('dashboard:');
    expect(result).toContain('mode: read_only_broker');
    expect(result).toContain('status: listening');
    expect(result).toContain('port:');
    expect(result).toContain('url: "http://127.0.0.1:');
    expect(result).toContain('/catalog');
    expect(result).toContain('/events');
    expect(result).toContain('read-only');
  });
});
