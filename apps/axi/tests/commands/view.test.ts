import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { viewCommand } from '../../src/commands/view.js';
import { JobManager } from '@reactive-skills/runtime';

describe('viewCommand', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = path.resolve(process.cwd(), '.tmp-view-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns validation error if no skill specified and no active skill found', async () => {
    const result = await viewCommand([]);
    expect(result).toContain('error:');
    expect(result).toContain('No skill specified and no active skill found in workspace');
  });

  it('starts telemetry server and returns TOON details when skill exists', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'my-viewer-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "reactive/v1"
name: my-viewer-skill
version: "1.0.0"
description: "My viewer skill test"
initial_state: START
states:
  START:
    description: "Starting state"
`,
      'utf8'
    );

    const result = await viewCommand(['my-viewer-skill', '--port', '0', '--once']);

    expect(result).toContain('view:');
    expect(result).toContain('status: listening');
    expect(result).toContain('skill_id: my-viewer-skill');
    expect(result).toContain('url: "http://127.0.0.1:');
    expect(result).toContain('events_sse: "http://127.0.0.1:');
    expect(result).toContain('/events"');
  });

  it('automatically falls back when the preferred port is occupied', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'fallback-viewer-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "reactive/v1"
name: fallback-viewer-skill
version: "1.0.0"
description: "Fallback viewer skill test"
initial_state: START
states:
  START:
    description: "Starting state"
`,
      'utf8'
    );

    const blocker = http.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const blockerAddress = blocker.address();
      if (!blockerAddress || typeof blockerAddress === 'string') {
        throw new Error('Test blocker did not expose a bound port');
      }
      const preferredPort = blockerAddress.port;
      const result = await viewCommand([
        'fallback-viewer-skill',
        '--preferred-port',
        String(preferredPort),
        '--once',
      ]);

      expect(result).toContain(`port: "${preferredPort + 1}"`);
      expect(result).toContain(`url: "http://127.0.0.1:${preferredPort + 1}"`);
      expect(result).toContain(`events_sse: "http://127.0.0.1:${preferredPort + 1}/events"`);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  it('fails clearly when an explicitly requested port is occupied', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'explicit-port-viewer-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "reactive/v1"
name: explicit-port-viewer-skill
version: "1.0.0"
description: "Explicit port viewer skill test"
initial_state: START
states:
  START:
    description: "Starting state"
`,
      'utf8'
    );

    const blocker = http.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(4264, '127.0.0.1', () => resolve());
    });

    try {
      const result = await viewCommand(['explicit-port-viewer-skill', '--port', '4264', '--once']);

      expect(result).toContain('Port 4264 on 127.0.0.1 is already in use.');
      expect(result).toContain('Failed to launch telemetry viewer');
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  it('starts a viewer for an explicit job and reports the job ID', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'job-viewer-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "reactive/v1"
name: job-viewer-skill
version: "1.0.0"
description: "Job viewer test"
initial_state: START
states:
  START:
    description: "Starting state"
`,
      'utf8'
    );

    const jobManager = new JobManager(process.cwd());
    jobManager.createJob('job-viewer-skill', {
      id: 'active-slice',
      initialState: 'START',
      setActive: true,
    });
    jobManager.createJob('job-viewer-skill', {
      id: 'review-slice',
      initialState: 'START',
      setActive: false,
    });
    expect(jobManager.getActiveJobId('job-viewer-skill')).toBe('active-slice');

    const result = await viewCommand(['job-viewer-skill', '--job', 'review-slice', '--port', '0', '--once']);

    expect(result).toContain('job_id: review-slice');
    expect(jobManager.getActiveJobId('job-viewer-skill')).toBe('active-slice');
  });
});
