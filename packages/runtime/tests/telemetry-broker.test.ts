import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { EventStore, JobManager, TelemetryBroker } from '../src/index.js';

interface OpenSseConnection {
  request: http.ClientRequest;
  text(): string;
  waitFor(predicate: (value: string) => boolean, timeoutMs?: number): Promise<string>;
  close(): void;
}

const brokers: TelemetryBroker[] = [];
const workspaces: string[] = [];

afterEach(async () => {
  for (const broker of brokers.splice(0)) {
    await broker.stop();
  }
  for (const workspace of workspaces.splice(0)) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

function createWorkspace(): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-telemetry-broker-test-'));
  workspaces.push(workspace);
  return workspace;
}

function createSkill(workspace: string, skillId: string, skillName = skillId): void {
  const skillDir = path.join(workspace, 'skills', skillId);
  fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'skill.yaml'), `name: ${skillName}\ninitial_state: INIT\nstates:\n  INIT:\n    transitions: {}\n`, 'utf8');
}

function createJob(workspace: string, skillId: string, jobId: string, setActive = false): void {
  new JobManager(workspace).createJob(skillId, { id: jobId, initialState: 'ACTIVE.REVIEW', setActive });
}

function openStore(workspace: string, skillId: string, jobId: string): EventStore {
  return new EventStore({ workspaceDir: workspace, skillId, jobId, enableSqlite: true });
}

async function appendEventFromChildProcess(dbPath: string): Promise<void> {
  const script = `
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(process.argv[1]);
    const row = db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM events').get();
    const seq = Number(row.seq) + 1;
    const timestamp = new Date().toISOString();
    db.prepare('INSERT INTO events (id, event_id, seq, timestamp, occurred_at, type, event_type, state, source, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('child-process-event', 'child-process-event', seq, timestamp, timestamp, 'CHILD_PROCESS_EVENT', 'CHILD_PROCESS_EVENT', null, 'worker-process', JSON.stringify({ writer: 'separate-process' }));
    db.close();
  `;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, dbPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Child writer exited with ${code}: ${stderr}`));
    });
  });
}

async function startBroker(workspace: string): Promise<{ broker: TelemetryBroker; url: string }> {
  const broker = new TelemetryBroker({
    workspaceDir: workspace,
    port: 0,
    tailIntervalMs: 10,
    catalogRefreshIntervalMs: 10,
    heartbeatIntervalMs: 100,
  });
  brokers.push(broker);
  const { url } = await broker.start();
  return { broker, url };
}

async function openSse(url: string): Promise<OpenSseConnection> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const waiters: Array<{
      predicate: (value: string) => boolean;
      resolve: (value: string) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }> = [];

    const request = http.get(url, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        buffer += chunk;
        for (const waiter of [...waiters]) {
          if (!waiter.predicate(buffer)) continue;
          clearTimeout(waiter.timer);
          waiters.splice(waiters.indexOf(waiter), 1);
          waiter.resolve(buffer);
        }
      });
      response.on('error', reject);

      const connection: OpenSseConnection = {
        request,
        text: () => buffer,
        waitFor: (predicate, timeoutMs = 1_000) => {
          if (predicate(buffer)) return Promise.resolve(buffer);
          return new Promise((waitResolve, waitReject) => {
            const timer = setTimeout(() => {
              const index = waiters.findIndex((waiter) => waiter.timer === timer);
              if (index >= 0) waiters.splice(index, 1);
              waitReject(new Error(`Timed out waiting for SSE content. Received: ${buffer}`));
            }, timeoutMs);
            waiters.push({ predicate, resolve: waitResolve, reject: waitReject, timer });
          });
        },
        close: () => request.destroy(),
      };
      resolve(connection);
    });
    request.on('error', reject);
  });
}

describe('TelemetryBroker', () => {
  it('discovers multiple skills, multiple jobs, and active-job metadata', async () => {
    const workspace = createWorkspace();
    createSkill(workspace, 'skill-alpha', 'Alpha Skill');
    createSkill(workspace, 'skill-beta', 'Beta Skill');
    createJob(workspace, 'skill-alpha', 'review-slice', true);
    createJob(workspace, 'skill-alpha', 'parallel-slice');
    createJob(workspace, 'skill-beta', 'worker-slice', true);

    const { url } = await startBroker(workspace);
    const response = await fetch(`${url}/catalog`);
    expect(response.status).toBe(200);
    const catalog = await response.json();

    expect(catalog.skills).toHaveLength(2);
    expect(catalog.skills.find((skill: any) => skill.skillId === 'skill-alpha')).toMatchObject({
      skillName: 'Alpha Skill',
      jobs: expect.arrayContaining([
        expect.objectContaining({ jobId: 'review-slice', isActive: true, status: 'active' }),
        expect.objectContaining({ jobId: 'parallel-slice', isActive: false, status: 'active' }),
      ]),
    });
    expect(catalog.skills.find((skill: any) => skill.skillId === 'skill-beta').jobs[0]).toMatchObject({
      jobId: 'worker-slice',
      isActive: true,
    });
  });

  it('isolates job-scoped state and reports event metadata', async () => {
    const workspace = createWorkspace();
    createSkill(workspace, 'skill-alpha');
    createJob(workspace, 'skill-alpha', 'job-one');
    createJob(workspace, 'skill-alpha', 'job-two');
    const firstStore = openStore(workspace, 'skill-alpha', 'job-one');
    const secondStore = openStore(workspace, 'skill-alpha', 'job-two');
    firstStore.append('FIRST_SIGNAL', { owner: 'one' }, { source: 'writer-one', state: 'ACTIVE.ONE' });
    firstStore.saveSnapshot(1, 'ACTIVE.ONE', { owner: 'one' });
    secondStore.append('SECOND_SIGNAL', { owner: 'two' }, { source: 'writer-two', state: 'ACTIVE.TWO' });
    secondStore.saveSnapshot(1, 'ACTIVE.TWO', { owner: 'two' });
    firstStore.close();
    secondStore.close();

    const { url } = await startBroker(workspace);
    const first = await (await fetch(`${url}/state?skillId=skill-alpha&jobId=job-one`)).json();
    const second = await (await fetch(`${url}/state?skillId=skill-alpha&jobId=job-two`)).json();

    expect(first).toMatchObject({
      skillId: 'skill-alpha',
      jobId: 'job-one',
      activeState: 'ACTIVE.ONE',
      latestSeq: 1,
      eventCount: 1,
      latestSignal: 'FIRST_SIGNAL',
    });
    expect(first.context).toEqual({ owner: 'one' });
    expect(second).toMatchObject({
      skillId: 'skill-alpha',
      jobId: 'job-two',
      activeState: 'ACTIVE.TWO',
      latestSeq: 1,
      eventCount: 1,
      latestSignal: 'SECOND_SIGNAL',
    });
    expect(second.context).toEqual({ owner: 'two' });
  });

  it('multiplexes identified events and filters selected targets', async () => {
    const workspace = createWorkspace();
    createSkill(workspace, 'skill-alpha');
    createSkill(workspace, 'skill-beta');
    createJob(workspace, 'skill-alpha', 'job-one');
    createJob(workspace, 'skill-beta', 'job-two');
    const firstStore = openStore(workspace, 'skill-alpha', 'job-one');
    const secondStore = openStore(workspace, 'skill-beta', 'job-two');
    firstStore.append('ALPHA_BASE', {}, { source: 'alpha' });
    secondStore.append('BETA_BASE', {}, { source: 'beta' });
    firstStore.close();
    secondStore.close();

    const { url } = await startBroker(workspace);
    const all = await openSse(`${url}/events?sinceSeq=0`);
    await all.waitFor((value) => value.includes('ALPHA_BASE') && value.includes('BETA_BASE'));
    expect(all.text()).toContain('"skillId":"skill-alpha"');
    expect(all.text()).toContain('"jobId":"job-two"');
    expect(all.text()).toContain('"seq":1');
    all.close();

    const filtered = await openSse(`${url}/events?target=skill-alpha%2Fjob-one&sinceSeq=0`);
    await filtered.waitFor((value) => value.includes('ALPHA_BASE'));
    expect(filtered.text()).toContain('ALPHA_BASE');
    expect(filtered.text()).not.toContain('BETA_BASE');
    filtered.close();
  });

  it('delivers cross-process SQLite events and supports multiple clients', async () => {
    const workspace = createWorkspace();
    createSkill(workspace, 'skill-alpha');
    createJob(workspace, 'skill-alpha', 'job-one');
    const selectedStore = openStore(workspace, 'skill-alpha', 'job-one');
    selectedStore.close();
    const dbPath = path.join(workspace, '.reactive', 'skills', 'skill-alpha', 'jobs', 'job-one', 'events.db');
    const { url } = await startBroker(workspace);
    const firstClient = await openSse(`${url}/events?target=skill-alpha%2Fjob-one&sinceSeq=0`);
    const secondClient = await openSse(`${url}/events?target=skill-alpha%2Fjob-one&sinceSeq=0`);

    await appendEventFromChildProcess(dbPath);
    await Promise.all([
      firstClient.waitFor((value) => value.includes('CHILD_PROCESS_EVENT')),
      secondClient.waitFor((value) => value.includes('CHILD_PROCESS_EVENT')),
    ]);
    expect(firstClient.text()).toContain('"skillId":"skill-alpha"');
    expect(firstClient.text()).toContain('"jobId":"job-one"');
    expect(firstClient.text()).toContain('"seq":1');
    expect(secondClient.text()).toContain('CHILD_PROCESS_EVENT');
    firstClient.close();
    secondClient.close();
  });

  it('delivers the first event when a SQLite store appears after broker startup', async () => {
    const workspace = createWorkspace();
    createSkill(workspace, 'skill-alpha');
    createJob(workspace, 'skill-alpha', 'job-one');
    const { url } = await startBroker(workspace);
    const client = await openSse(`${url}/events?target=skill-alpha%2Fjob-one&sinceSeq=0`);
    const writerStore = openStore(workspace, 'skill-alpha', 'job-one');
    try {
      writerStore.append('FIRST_LATE_EVENT', { writer: 'after-broker-start' }, { source: 'worker' });

      await client.waitFor((value) => value.includes('FIRST_LATE_EVENT'));
      expect(client.text()).toContain('"skillId":"skill-alpha"');
      expect(client.text()).toContain('"jobId":"job-one"');
      expect(client.text()).toContain('"seq":1');
    } finally {
      client.close();
      writerStore.close();
    }
  });

  it('shows new jobs without restarting and preserves the active-job pointer', async () => {
    const workspace = createWorkspace();
    createSkill(workspace, 'skill-alpha');
    createJob(workspace, 'skill-alpha', 'active-job', true);
    const pointerPath = new JobManager(workspace).getActivePointerPath('skill-alpha');
    const pointerBefore = fs.readFileSync(pointerPath, 'utf8');
    const { url } = await startBroker(workspace);

    createJob(workspace, 'skill-alpha', 'new-job');
    const deadline = Date.now() + 1_000;
    let catalog: any;
    do {
      catalog = await (await fetch(`${url}/catalog`)).json();
      if (catalog.skills[0]?.jobs.some((job: any) => job.jobId === 'new-job')) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    } while (Date.now() < deadline);

    expect(catalog.skills[0].jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ jobId: 'active-job', isActive: true }),
      expect.objectContaining({ jobId: 'new-job', isActive: false }),
    ]));
    expect(fs.readFileSync(pointerPath, 'utf8')).toBe(pointerBefore);
  });

  it('rejects invalid targets and retains Local Network Access and CORS headers', async () => {
    const workspace = createWorkspace();
    createSkill(workspace, 'skill-alpha');
    createJob(workspace, 'skill-alpha', 'job-one');
    const { url } = await startBroker(workspace);

    const invalidState = await fetch(`${url}/state?skillId=skill-alpha&jobId=missing-job`);
    expect(invalidState.status).toBe(404);
    expect(await invalidState.json()).toMatchObject({ error: 'Invalid telemetry target' });

    const invalidStream = await fetch(`${url}/events?target=skill-alpha%2Fmissing-job`);
    expect(invalidStream.status).toBe(404);

    const preflight = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Private-Network': 'true',
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    expect(preflight.headers.get('access-control-allow-private-network')).toBe('true');
  });

  it('does not expose signal dispatch or mutate the active job pointer', async () => {
    const workspace = createWorkspace();
    createSkill(workspace, 'skill-alpha');
    createJob(workspace, 'skill-alpha', 'active-job', true);
    const pointerPath = new JobManager(workspace).getActivePointerPath('skill-alpha');
    const pointerBefore = fs.readFileSync(pointerPath, 'utf8');
    const { url } = await startBroker(workspace);

    const signalResponse = await fetch(`${url}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: 'SHOULD_NOT_DISPATCH' }),
    });

    expect(signalResponse.status).toBe(404);
    expect(fs.readFileSync(pointerPath, 'utf8')).toBe(pointerBefore);
  });
});
