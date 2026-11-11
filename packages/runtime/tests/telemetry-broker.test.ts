import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
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

async function appendEventFromChildProcess(dbPath: string, runId: string): Promise<void> {
  const script = `
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(process.argv[1]);
    const runId = process.argv[2];
    const row = db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM events WHERE run_id = ?').get(runId);
    const seq = Number(row.seq) + 1;
    const ledger = db.prepare('SELECT COALESCE(MAX(ledger_seq), 0) AS seq FROM events').get();
    const ledgerSeq = Number(ledger.seq) + 1;
    const timestamp = new Date().toISOString();
    db.prepare('INSERT INTO events (id, event_id, ledger_seq, seq, timestamp, occurred_at, type, event_type, state, source, run_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('child-process-event', 'child-process-event', ledgerSeq, seq, timestamp, timestamp, 'CHILD_PROCESS_EVENT', 'CHILD_PROCESS_EVENT', null, 'worker-process', runId, JSON.stringify({ writer: 'separate-process' }));
    db.close();
  `;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, dbPath, runId], { stdio: ['ignore', 'ignore', 'pipe'] });
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

function rawRequest(url: string, method: string, headers: http.OutgoingHttpHeaders = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

function rawSocket(port: number, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let response = '';
    const socket = net.connect(port, '127.0.0.1', () => socket.write(payload));
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => { response += chunk; });
    socket.on('end', () => resolve(response));
    socket.on('error', reject);
  });
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
  it('falls back from an occupied preferred port and reports the selected port', async () => {
    const workspace = createWorkspace();
    const blocker = http.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(0, '127.0.0.1', () => {
        blocker.removeListener('error', reject);
        resolve();
      });
    });

    try {
      const blockedPort = (blocker.address() as any).port as number;
      const broker = new TelemetryBroker({
        workspaceDir: workspace,
        preferredPort: blockedPort,
        tailIntervalMs: 10,
        catalogRefreshIntervalMs: 10,
        heartbeatIntervalMs: 100,
      });
      brokers.push(broker);

      const result = await broker.start();

      expect(result.port).toBeGreaterThan(blockedPort);
      expect(result.url).toBe(`http://127.0.0.1:${result.port}`);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

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

  it('lists jobs and streams events from every workspace root it is given', async () => {
    const callerWorkspace = createWorkspace();
    const projectWorkspace = createWorkspace();
    createSkill(callerWorkspace, 'skill-alpha', 'Alpha Skill');
    createJob(callerWorkspace, 'skill-alpha', 'caller-job');
    createJob(projectWorkspace, 'skill-alpha', 'project-job');
    createJob(projectWorkspace, 'skill-beta', 'beta-job');
    const projectStore = openStore(projectWorkspace, 'skill-alpha', 'project-job');
    projectStore.append('PROJECT_BASE', {}, { source: 'project' });
    projectStore.close();

    const broker = new TelemetryBroker({
      workspaceDir: callerWorkspace,
      workspaceDirs: [projectWorkspace],
      port: 0,
      tailIntervalMs: 10,
      catalogRefreshIntervalMs: 10,
    });
    brokers.push(broker);
    const { url } = await broker.start();

    const catalog = await (await fetch(`${url}/catalog`)).json();
    const alpha = catalog.skills.find((skill: any) => skill.skillId === 'skill-alpha');
    expect(alpha.jobs.map((job: any) => job.jobId)).toEqual(expect.arrayContaining(['caller-job', 'project-job']));
    expect(alpha.jobs.find((job: any) => job.jobId === 'caller-job').workspaceRoot).toBe(path.resolve(callerWorkspace));
    expect(alpha.jobs.find((job: any) => job.jobId === 'project-job').workspaceRoot).toBe(path.resolve(projectWorkspace));
    expect(catalog.skills.find((skill: any) => skill.skillId === 'skill-beta').jobs).toHaveLength(1);

    const stream = await openSse(`${url}/events?target=skill-alpha%2Fproject-job&sinceSeq=0`);
    await stream.waitFor((value) => value.includes('PROJECT_BASE'));
    const liveStore = openStore(projectWorkspace, 'skill-alpha', 'project-job');
    liveStore.append('PROJECT_LIVE', {}, { source: 'project' });
    await stream.waitFor((value) => value.includes('PROJECT_LIVE'));
    liveStore.close();
    stream.close();

    const state = await (await fetch(`${url}/state?skillId=skill-alpha&jobId=project-job`)).json();
    expect(state.eventCount).toBeGreaterThanOrEqual(2);
  });

  it('picks up a workspace root that appears after the broker started', async () => {
    const callerWorkspace = createWorkspace();
    const lateWorkspace = createWorkspace();
    createJob(callerWorkspace, 'skill-alpha', 'caller-job');
    const roots: string[] = [];
    const broker = new TelemetryBroker({
      workspaceDir: callerWorkspace,
      workspaceDirs: () => roots,
      port: 0,
      tailIntervalMs: 10,
      catalogRefreshIntervalMs: 10,
    });
    brokers.push(broker);
    const { url } = await broker.start();
    const jobIds = async () => (await (await fetch(`${url}/catalog`)).json()).skills.flatMap((skill: any) => skill.jobs.map((job: any) => job.jobId));
    expect(await jobIds()).not.toContain('late-job');

    createJob(lateWorkspace, 'skill-alpha', 'late-job');
    roots.push(lateWorkspace);
    const deadline = Date.now() + 5_000;
    let ids = await jobIds();
    while (!ids.includes('late-job') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      ids = await jobIds();
    }
    expect(ids).toContain('late-job');
  });

  it('finds a job created just before a request even inside the refresh back-off window', async () => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'first-job');
    const broker = new TelemetryBroker({ workspaceDir: workspace, port: 0, tailIntervalMs: 10, catalogRefreshIntervalMs: 60_000 });
    brokers.push(broker);
    const { url } = await broker.start();

    createJob(workspace, 'skill-alpha', 'second-job');
    const state = await fetch(`${url}/state?skillId=skill-alpha&jobId=second-job`);
    expect(state.status).toBe(200);
    expect(await state.json()).toMatchObject({ skillId: 'skill-alpha', jobId: 'second-job' });

    const catalog = await (await fetch(`${url}/catalog`)).json();
    expect(catalog.skills[0].jobs.map((job: any) => job.jobId)).toContain('second-job');
  });

  it('finds a just-created job through the events target filter', async () => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'first-job');
    const broker = new TelemetryBroker({ workspaceDir: workspace, port: 0, tailIntervalMs: 10, catalogRefreshIntervalMs: 60_000 });
    brokers.push(broker);
    const { url } = await broker.start();

    createJob(workspace, 'skill-alpha', 'second-job');
    const stream = await openSse(`${url}/events?target=skill-alpha%2Fsecond-job`);
    await stream.waitFor((value) => value.includes('event: connected'));
    expect(stream.text()).toContain('"jobId":"second-job"');
    stream.close();
  });

  it('refreshes at most once per back-off window for a burst of unknown targets', async () => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'first-job');
    const broker = new TelemetryBroker({ workspaceDir: workspace, port: 0, tailIntervalMs: 10, catalogRefreshIntervalMs: 60_000 });
    brokers.push(broker);
    const { url } = await broker.start();

    expect((await fetch(`${url}/state?skillId=skill-alpha&jobId=missing`)).status).toBe(404);
    createJob(workspace, 'skill-alpha', 'late-job');
    expect((await fetch(`${url}/state?skillId=skill-alpha&jobId=late-job`)).status).toBe(404);
  });

  it('keeps refreshing the other roots and jobs when one store is corrupt', async () => {
    const badWorkspace = createWorkspace();
    const goodWorkspace = createWorkspace();
    createJob(badWorkspace, 'skill-alpha', 'bad-job');
    createJob(badWorkspace, 'skill-beta', 'sibling-job');
    createJob(goodWorkspace, 'skill-alpha', 'good-job');
    createJob(goodWorkspace, 'skill-alpha', 'stale-job');
    openStore(badWorkspace, 'skill-alpha', 'bad-job').close();
    fs.writeFileSync(path.join(badWorkspace, '.reactive', 'skills', 'skill-alpha', 'events.db'), 'not a sqlite database', 'utf8');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const broker = new TelemetryBroker({
        workspaceDir: badWorkspace,
        workspaceDirs: [goodWorkspace],
        port: 0,
        tailIntervalMs: 10,
        catalogRefreshIntervalMs: 10,
      });
      brokers.push(broker);
      const { url } = await broker.start();
      const jobIds = async () => (await (await fetch(`${url}/catalog`)).json()).skills.flatMap((skill: any) => skill.jobs.map((job: any) => job.jobId));
      expect(await jobIds()).toEqual(expect.arrayContaining(['sibling-job', 'good-job', 'stale-job']));
      expect(await jobIds()).not.toContain('bad-job');

      fs.rmSync(new JobManager(goodWorkspace).getJobDir('skill-alpha', 'stale-job'), { recursive: true, force: true });
      createJob(goodWorkspace, 'skill-alpha', 'new-job');
      await new Promise((resolve) => setTimeout(resolve, 200));

      const ids = await jobIds();
      expect(ids).toEqual(expect.arrayContaining(['sibling-job', 'good-job', 'new-job']));
      expect(ids).not.toContain('stale-job');
      expect(warn.mock.calls.filter((call) => String(call[0]).includes('bad-job'))).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps the other skills and the failing skill\'s previous jobs when one skill cannot be listed', async () => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'kept-job');
    createJob(workspace, 'skill-beta', 'sibling-job');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const { url } = await startBroker(workspace);
      const jobIds = async () => (await (await fetch(`${url}/catalog`)).json()).skills.flatMap((skill: any) => skill.jobs.map((job: any) => job.jobId));
      expect(await jobIds()).toEqual(expect.arrayContaining(['kept-job', 'sibling-job']));

      const runsDir = new JobManager(workspace).getJobsDir('skill-alpha');
      fs.rmSync(runsDir, { recursive: true, force: true });
      fs.writeFileSync(runsDir, 'not a directory', 'utf8');
      createJob(workspace, 'skill-beta', 'new-job');
      const deadline = Date.now() + 5_000;
      let ids = await jobIds();
      while (!ids.includes('new-job') && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        ids = await jobIds();
      }

      expect(ids).toEqual(expect.arrayContaining(['kept-job', 'sibling-job', 'new-job']));
      expect(warn.mock.calls.filter((call) => String(call[0]).includes('skill-alpha'))).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('starts and lists the caller root when the workspace root provider throws', async () => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'caller-job');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const broker = new TelemetryBroker({
        workspaceDir: workspace,
        workspaceDirs: () => { throw new Error('damaged workspace catalog'); },
        port: 0,
        tailIntervalMs: 10,
        catalogRefreshIntervalMs: 10,
      });
      brokers.push(broker);
      const { url } = await broker.start();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const catalog = await (await fetch(`${url}/catalog`)).json();
      expect(catalog.skills[0].jobs.map((job: any) => job.jobId)).toEqual(['caller-job']);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  // Replaces the first-root-wins duplicate assertion: a skill and job held by several roots is listed once per root.
  it('lists, reads and streams a skill and job that several roots share', async () => {
    const callerWorkspace = createWorkspace();
    const projectWorkspace = createWorkspace();
    createJob(callerWorkspace, 'skill-alpha', 'shared-job');
    createJob(projectWorkspace, 'skill-alpha', 'shared-job');
    const callerStore = openStore(callerWorkspace, 'skill-alpha', 'shared-job');
    callerStore.append('CALLER_EVENT', {}, { source: 'caller' });
    callerStore.saveSnapshot(1, 'ACTIVE.CALLER', { owner: 'caller' });
    callerStore.close();
    const projectStore = openStore(projectWorkspace, 'skill-alpha', 'shared-job');
    projectStore.append('PROJECT_EVENT', {}, { source: 'project' });
    projectStore.append('PROJECT_EVENT_TWO', {}, { source: 'project' });
    projectStore.saveSnapshot(2, 'ACTIVE.PROJECT', { owner: 'project' });
    projectStore.close();
    const callerRoot = path.resolve(callerWorkspace);
    const projectRoot = path.resolve(projectWorkspace);

    const broker = new TelemetryBroker({
      workspaceDir: callerWorkspace,
      workspaceDirs: [projectWorkspace],
      port: 0,
      tailIntervalMs: 10,
      catalogRefreshIntervalMs: 10,
    });
    brokers.push(broker);
    const { url } = await broker.start();

    const catalog = await (await fetch(`${url}/catalog`)).json();
    expect(catalog.skills).toHaveLength(1);
    const shared = catalog.skills[0].jobs.filter((job: any) => job.jobId === 'shared-job');
    expect(shared.map((job: any) => [job.jobId, job.workspaceRoot])).toEqual([
      ['shared-job', callerRoot],
      ['shared-job', projectRoot],
    ]);

    const defaultState = await (await fetch(`${url}/state?skillId=skill-alpha&jobId=shared-job`)).json();
    expect(defaultState).toMatchObject({ workspaceRoot: callerRoot, context: { owner: 'caller' }, eventCount: 1 });
    const projectState = await (await fetch(`${url}/state?skillId=skill-alpha&jobId=shared-job&workspaceRoot=${encodeURIComponent(projectRoot)}`)).json();
    expect(projectState).toMatchObject({ workspaceRoot: projectRoot, context: { owner: 'project' }, eventCount: 2 });
    const unknownRoot = await fetch(`${url}/state?skillId=skill-alpha&jobId=shared-job&workspaceRoot=${encodeURIComponent(path.join(projectRoot, 'nested'))}`);
    expect(unknownRoot.status).toBe(404);

    const unqualified = await openSse(`${url}/events?target=skill-alpha%2Fshared-job&sinceSeq=0`);
    await unqualified.waitFor((value) => value.includes('CALLER_EVENT'));
    expect(unqualified.text()).not.toContain('PROJECT_EVENT');
    unqualified.close();

    const qualified = await openSse(`${url}/events?target=${encodeURIComponent(`${projectRoot}/skill-alpha/shared-job`)}&sinceSeq=0`);
    await qualified.waitFor((value) => value.includes('PROJECT_EVENT_TWO'));
    expect(qualified.text()).not.toContain('CALLER_EVENT');
    expect(qualified.text()).toContain(`"workspaceRoot":${JSON.stringify(projectRoot)}`);
    qualified.close();

    const all = await openSse(`${url}/events?sinceSeq=0`);
    await all.waitFor((value) => value.includes('CALLER_EVENT') && value.includes('PROJECT_EVENT_TWO'));
    all.close();
  });

  it('reads a legacy JSONL-only store without creating run directories in its workspace', async () => {
    const workspace = createWorkspace();
    const skillDir = path.join(workspace, '.reactive', 'skills', 'legacy-skill');
    const legacyStore = new EventStore({ workspaceDir: workspace, skillId: 'legacy-skill', jobId: 'default' });
    legacyStore.append('LEGACY_EVENT', {}, { source: 'legacy' });
    legacyStore.close();
    fs.rmSync(path.join(skillDir, 'runs'), { recursive: true, force: true });
    expect(fs.existsSync(path.join(skillDir, 'events.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'events.db'))).toBe(false);

    const { url } = await startBroker(workspace);
    const state = await (await fetch(`${url}/state?skillId=legacy-skill&jobId=default`)).json();

    expect(state).toMatchObject({ skillId: 'legacy-skill', jobId: 'default', eventCount: 1, latestSignal: 'LEGACY_EVENT' });
    expect(fs.existsSync(path.join(skillDir, 'runs'))).toBe(false);
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
    const dbPath = path.join(workspace, '.reactive', 'skills', 'skill-alpha', 'events.db');
    const { url } = await startBroker(workspace);
    const firstClient = await openSse(`${url}/events?target=skill-alpha%2Fjob-one&sinceSeq=0`);
    const secondClient = await openSse(`${url}/events?target=skill-alpha%2Fjob-one&sinceSeq=0`);

    await appendEventFromChildProcess(dbPath, 'job-one');
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

  it('rejects invalid targets', async () => {
    const workspace = createWorkspace();
    createSkill(workspace, 'skill-alpha');
    createJob(workspace, 'skill-alpha', 'job-one');
    const { url } = await startBroker(workspace);

    const invalidState = await fetch(`${url}/state?skillId=skill-alpha&jobId=missing-job`);
    expect(invalidState.status).toBe(404);
    expect(await invalidState.json()).toMatchObject({ error: 'Invalid telemetry target' });

    const invalidStream = await fetch(`${url}/events?target=skill-alpha%2Fmissing-job`);
    expect(invalidStream.status).toBe(404);

    const malformed = await fetch(`${url}/events?target=skill-alpha`);
    expect(malformed.status).toBe(400);
  });

  // Replaces the wildcard assertion: a request without an Origin now receives no CORS headers.
  it.each([
    'https://reactive-skills.com',
    'http://localhost',
    'http://localhost:3000',
    'http://127.0.0.1:4242',
  ])('grants Local Network Access and CORS headers to the allowed origin %s', async (origin) => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'job-one');
    const { url } = await startBroker(workspace);

    const preflight = await rawRequest(url, 'OPTIONS', {
      Origin: origin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Private-Network': 'true',
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(origin);
    expect(preflight.headers['access-control-allow-private-network']).toBe('true');
    expect(preflight.headers['access-control-allow-methods']).toContain('GET');
    expect(preflight.headers.vary).toContain('Origin');

    const catalog = await rawRequest(`${url}/catalog`, 'GET', { Origin: origin });
    expect(catalog.status).toBe(200);
    expect(catalog.headers['access-control-allow-origin']).toBe(origin);
    expect(JSON.parse(catalog.body).skills).toHaveLength(1);
  });

  it.each([
    'https://evil.example',
    'https://reactive-skills.com.evil.example',
    'http://reactive-skills.com',
    'https://www.reactive-skills.com',
    'http://localhost.evil.example',
    'https://localhost:3000',
    'null',
  ])('sends no CORS headers to the disallowed origin %s', async (origin) => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'job-one');
    const { url } = await startBroker(workspace);

    for (const [target, method] of [[url, 'OPTIONS'], [`${url}/catalog`, 'GET'], [`${url}/state?skillId=skill-alpha&jobId=missing`, 'GET']]) {
      const response = await rawRequest(target, method, {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Private-Network': 'true',
      });
      const corsHeaders = Object.keys(response.headers).filter((name) => name.startsWith('access-control-'));
      expect(corsHeaders).toEqual([]);
      expect(response.headers.vary).toContain('Origin');
    }
  });

  it.each([
    '127.0.0.1',
    '127.0.0.1:4242',
    'localhost',
    'localhost:3000',
    'LOCALHOST:8080',
    '[::1]',
    '[::1]:4242',
  ])('serves requests addressed to the loopback host %s', async (host) => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'job-one');
    const { url } = await startBroker(workspace);

    expect((await rawRequest(url, 'OPTIONS', { Host: host })).status).toBe(204);
    for (const route of ['/', '/health', '/catalog', '/state?skillId=skill-alpha&jobId=job-one']) {
      const response = await rawRequest(`${url}${route}`, 'GET', { Host: host });
      expect(response.status).toBe(200);
    }
  });

  it.each([
    'attacker.example',
    'attacker.example:4242',
    '127.0.0.1.attacker.example:4242',
    'localhost.attacker.example',
    '127.0.0.1:4242@attacker.example',
    'localhost:abc',
    '0.0.0.0:4242',
    '192.168.1.5:4242',
    '[::2]:4242',
  ])('refuses every route for the non-loopback host %j before any handler runs', async (host) => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'job-one');
    const { url } = await startBroker(workspace);
    const routes: Array<[string, string]> = [
      ['OPTIONS', '/'],
      ['GET', '/'],
      ['GET', '/health'],
      ['GET', '/catalog'],
      ['HEAD', '/catalog'],
      ['GET', '/state?skillId=skill-alpha&jobId=job-one'],
      ['GET', '/events?sinceSeq=0'],
      ['GET', '/events?target=skill-alpha%2Fjob-one'],
      ['GET', '/missing'],
    ];

    for (const [method, route] of routes) {
      const response = await rawRequest(`${url}${route}`, method, { Host: host, Origin: 'https://reactive-skills.com' });
      expect(response.status, `${method} ${route}`).toBe(403);
      expect(response.headers['content-type']).toContain('application/json');
      expect(Object.keys(response.headers).filter((name) => name.startsWith('access-control-'))).toEqual([]);
      if (method !== 'HEAD') expect(JSON.parse(response.body).error).toContain('Host not allowed');
      else expect(response.body).toBe('');
    }
  });

  it('leaves a request without a Host header to the HTTP platform', async () => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'job-one');
    const { broker } = await startBroker(workspace);

    const http10 = await rawSocket(broker.getPort(), 'GET /catalog HTTP/1.0\r\n\r\n');
    expect(http10).toMatch(/^HTTP\/1\.1 200 /);
    expect(http10).toContain('"jobId":"job-one"');

    const http11 = await rawSocket(broker.getPort(), 'GET /catalog HTTP/1.1\r\nConnection: close\r\n\r\n');
    expect(http11).toMatch(/^HTTP\/1\.1 400 /);
  });

  it('serves requests that carry no Origin header without CORS headers', async () => {
    const workspace = createWorkspace();
    createJob(workspace, 'skill-alpha', 'job-one');
    const { url } = await startBroker(workspace);

    const response = await rawRequest(`${url}/catalog`, 'GET');
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).skills[0].jobs[0].jobId).toBe('job-one');
    expect(Object.keys(response.headers).filter((name) => name.startsWith('access-control-'))).toEqual([]);
    expect(response.headers.vary).toContain('Origin');
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
