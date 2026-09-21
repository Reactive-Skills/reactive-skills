import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { EventStore } from '../src/core/event-store.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { TelemetryServer } from '../src/telemetry/server.js';

describe('TelemetryServer (SSE & Private Network Access)', () => {
  const tempSkillDir = path.resolve(process.cwd(), 'skills', '_test_telemetry_skill');
  let eventStore: EventStore;
  let server: TelemetryServer | null = null;

  beforeEach(() => {
    if (!fs.existsSync(tempSkillDir)) {
      fs.mkdirSync(path.join(tempSkillDir, 'states'), { recursive: true });
    }

    const testYaml = `schema_version: "reactive/v1"
name: "test-telemetry"
description: "Test telemetry server and real-time streaming"
initial_state: "IDLE"

states:
  IDLE:
    transitions:
      START:
        target: "RUNNING"
  RUNNING:
    transitions:
      FINISH:
        target: "DONE"
  DONE:
    terminal: true
`;
    fs.writeFileSync(path.join(tempSkillDir, 'skill.yaml'), testYaml, 'utf8');

    eventStore = new EventStore({
      inMemory: true,
      enableSqlite: false,
    });
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    if (fs.existsSync(tempSkillDir)) {
      fs.rmSync(tempSkillDir, { recursive: true, force: true });
    }
  });

  it('should start on ephemeral port and respond to CORS and PNA preflight', async () => {
    server = new TelemetryServer({
      eventStore,
      port: 0,
      skillName: 'test-telemetry',
    });

    const { port, url } = await server.start();
    expect(port).toBeGreaterThan(0);
    expect(url).toContain(`127.0.0.1:${port}`);

    // Test OPTIONS preflight
    const optionsRes = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Private-Network': 'true',
      },
    });

    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get('access-control-allow-origin')).toBe('*');
    expect(optionsRes.headers.get('access-control-allow-private-network')).toBe('true');
  });

  it('should respond to GET /health and GET /state', async () => {
    eventStore.append('INIT_SYSTEM', { mode: 'test' }, { source: 'test' });

    server = new TelemetryServer({
      eventStore,
      port: 0,
      skillName: 'test-telemetry',
    });

    const { url } = await server.start();

    // Health
    const healthRes = await fetch(`${url}/health`);
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.status).toBe('ok');
    expect(healthJson.skillName).toBe('test-telemetry');
    expect(healthJson.port).toBe(portFromUrl(url));
    expect(healthJson.url).toBe(url);
    expect(healthJson.latestSeq).toBe(1);

    // State
    const stateRes = await fetch(`${url}/state`);
    expect(stateRes.status).toBe(200);
    const stateJson = await stateRes.json();
    expect(stateJson.skillName).toBe('test-telemetry');
    expect(stateJson.port).toBe(portFromUrl(url));
    expect(stateJson.url).toBe(url);
    expect(stateJson.latestSeq).toBe(1);
  });

  it('should return event history via GET /events/history with sinceSeq filtering', async () => {
    eventStore.append('EVENT_ONE', {}, { source: 'test' });
    eventStore.append('EVENT_TWO', {}, { source: 'test' });
    eventStore.append('EVENT_THREE', {}, { source: 'test' });

    server = new TelemetryServer({
      eventStore,
      port: 0,
      skillName: 'test-telemetry',
    });

    const { url } = await server.start();

    // All events
    const allRes = await fetch(`${url}/events/history`);
    const allJson = await allRes.json();
    expect(allJson.count).toBe(3);
    expect(allJson.events.map((e: any) => e.type)).toEqual(['EVENT_ONE', 'EVENT_TWO', 'EVENT_THREE']);

    // Since seq 1
    const filteredRes = await fetch(`${url}/events/history?sinceSeq=1`);
    const filteredJson = await filteredRes.json();
    expect(filteredJson.count).toBe(2);
    expect(filteredJson.events.map((e: any) => e.type)).toEqual(['EVENT_TWO', 'EVENT_THREE']);
  });

  it('should stream live events via Server-Sent Events (SSE)', async () => {
    eventStore.append('PRIOR_EVENT', {}, { source: 'test' });

    server = new TelemetryServer({
      eventStore,
      port: 0,
      skillName: 'test-telemetry',
      heartbeatIntervalMs: 500,
    });

    const { url, port } = await server.start();

    const receivedChunks: string[] = [];
    let sseReq: http.ClientRequest;

    await new Promise<void>((resolve, reject) => {
      sseReq = http.get(`${url}/events?sinceSeq=0`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.headers['access-control-allow-private-network']).toBe('true');

        res.on('data', (chunk: Buffer) => {
          receivedChunks.push(chunk.toString('utf8'));
          if (receivedChunks.some((c) => c.includes('LIVE_SIGNAL'))) {
            resolve();
          }
        });

        // Now trigger live event emission after connection established
        setTimeout(() => {
          eventStore.append('LIVE_SIGNAL', { message: 'hello sse' }, { source: 'agent' });
        }, 50);
      });

      sseReq.on('error', reject);
    });

    sseReq!.destroy();

    const fullStreamText = receivedChunks.join('');
    expect(fullStreamText).toContain('event: connected');
    expect(fullStreamText).toContain(`\"port\":${port}`);
    expect(fullStreamText).toContain(`\"url\":\"${url}\"`);
    expect(fullStreamText).toContain('PRIOR_EVENT');
    expect(fullStreamText).toContain('LIVE_SIGNAL');
    expect(fullStreamText).toContain('hello sse');
  });

  it('should stream events appended by a separate store for the selected job', async () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-telemetry-tail-test-'));
    const selectedStore = new EventStore({
      workspaceDir,
      skillId: 'test-telemetry',
      jobId: 'job-alpha',
      enableSqlite: true,
    });
    const writerStore = new EventStore({
      workspaceDir,
      skillId: 'test-telemetry',
      jobId: 'job-alpha',
      enableSqlite: true,
    });

    try {
      server = new TelemetryServer({
        eventStore: selectedStore,
        jobId: 'job-alpha',
        port: 0,
        tailIntervalMs: 10,
      });

      const { url } = await server.start();
      const receivedChunks: string[] = [];
      let sseReq: http.ClientRequest;

      await new Promise<void>((resolve, reject) => {
        sseReq = http.get(`${url}/events?sinceSeq=0`, (res) => {
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            receivedChunks.push(chunk.toString());
            if (receivedChunks.some((value) => value.includes('EXTERNAL_JOB_EVENT'))) {
              resolve();
            }
          });
        });
        sseReq.on('error', reject);
        setTimeout(() => {
          writerStore.append('EXTERNAL_JOB_EVENT', { job: 'job-alpha' }, { source: 'separate-writer' });
        }, 25);
      });

      const health = await (await fetch(`${url}/health`)).json();
      expect(health.jobId).toBe('job-alpha');
      expect(receivedChunks.join('')).toContain('job-alpha');
      sseReq!.destroy();
    } finally {
      await server?.stop();
      server = null;
      writerStore.close();
      selectedStore.close();
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should not stream events from a different job', async () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-telemetry-isolation-test-'));
    const selectedStore = new EventStore({
      workspaceDir,
      skillId: 'test-telemetry',
      jobId: 'job-alpha',
      enableSqlite: true,
    });
    const otherJobStore = new EventStore({
      workspaceDir,
      skillId: 'test-telemetry',
      jobId: 'job-beta',
      enableSqlite: true,
    });

    try {
      server = new TelemetryServer({
        eventStore: selectedStore,
        jobId: 'job-alpha',
        port: 0,
        tailIntervalMs: 10,
      });

      const { url } = await server.start();
      const receivedChunks: string[] = [];
      let sseReq: http.ClientRequest;

      await new Promise<void>((resolve, reject) => {
        sseReq = http.get(`${url}/events?sinceSeq=0`, (res) => {
          res.setEncoding('utf8');
          res.on('data', (chunk) => receivedChunks.push(chunk.toString()));
          resolve();
        });
        sseReq.on('error', reject);
      });

      otherJobStore.append('OTHER_JOB_EVENT', { job: 'job-beta' }, { source: 'separate-writer' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedChunks.join('')).not.toContain('OTHER_JOB_EVENT');
      sseReq!.destroy();
    } finally {
      await server?.stop();
      server = null;
      otherJobStore.close();
      selectedStore.close();
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should catch up from Last-Event-ID without duplicate delivery', async () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-telemetry-reconnect-test-'));
    const selectedStore = new EventStore({
      workspaceDir,
      skillId: 'test-telemetry',
      jobId: 'job-alpha',
      enableSqlite: true,
    });
    const writerStore = new EventStore({
      workspaceDir,
      skillId: 'test-telemetry',
      jobId: 'job-alpha',
      enableSqlite: true,
    });

    try {
      selectedStore.append('RECONNECT_BASE', {}, { source: 'test' });
      writerStore.append('RECONNECT_EVENT', {}, { source: 'separate-writer' });
      server = new TelemetryServer({
        eventStore: selectedStore,
        jobId: 'job-alpha',
        port: 0,
        tailIntervalMs: 10,
      });

      const { url } = await server.start();
      const receivedChunks: string[] = [];
      let sseReq: http.ClientRequest;
      let catchUpTimeout: ReturnType<typeof setTimeout>;

      await new Promise<void>((resolve, reject) => {
        sseReq = http.get(`${url}/events`, { headers: { 'Last-Event-ID': '1' } }, (res) => {
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            receivedChunks.push(chunk.toString());
            if (receivedChunks.join('').includes('RECONNECT_EVENT')) {
              clearTimeout(catchUpTimeout);
              resolve();
            }
          });
        });
        sseReq.on('error', reject);
        catchUpTimeout = setTimeout(() => reject(new Error('Timed out waiting for reconnect catch-up')), 1000);
      });

      await new Promise((resolve) => setTimeout(resolve, 30));
      const streamText = receivedChunks.join('');
      expect(streamText.match(/id: 2\r?\n/g)).toHaveLength(1);
      expect(streamText).toContain('id: 2');
      sseReq!.destroy();
    } finally {
      await server?.stop();
      server = null;
      writerStore.close();
      selectedStore.close();
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should handle POST /signal and trigger FSM transitions', async () => {
    const engine = new FSMEngine({
      skillDir: tempSkillDir,
      eventStore,
    });

    server = new TelemetryServer({
      eventStore,
      fsmEngine: engine,
      port: 0,
    });

    const { url } = await server.start();

    expect(engine.getCurrentState()).toBe('IDLE');

    const signalRes = await fetch(`${url}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signal: 'START',
        payload: { user: 'brandon' },
      }),
    });

    expect(signalRes.status).toBe(200);
    const signalJson = await signalRes.json();
    expect(signalJson.success).toBe(true);
    expect(engine.getCurrentState()).toBe('RUNNING');
  });

  it('should serve standalone live web dashboard at GET / and GET /index.html', async () => {
    server = new TelemetryServer({
      eventStore,
      port: 0,
      skillName: 'test-telemetry',
    });

    const { url } = await server.start();

    // GET /
    const rootRes = await fetch(url);
    expect(rootRes.status).toBe(200);
    expect(rootRes.headers.get('content-type')).toContain('text/html');
    const rootHtml = await rootRes.text();
    expect(rootHtml).toContain('<!DOCTYPE html>');
    expect(rootHtml).toContain('test-telemetry');
    expect(rootHtml).toContain('Reactive Skills Telemetry');
    expect(rootHtml).toContain('EventSource');

    // GET /index.html
    const indexRes = await fetch(`${url}/index.html`);
    expect(indexRes.status).toBe(200);
    expect(indexRes.headers.get('content-type')).toContain('text/html');
    const indexHtml = await indexRes.text();
    expect(indexHtml).toContain('<!DOCTYPE html>');
    expect(indexHtml).toContain('test-telemetry');
  });

  it('should fall back from a busy preferred port and report the selected endpoint', async () => {
    const blocker = http.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const preferredPort = (blocker.address() as any).port as number;
      server = new TelemetryServer({
        eventStore,
        preferredPort,
        skillName: 'test-telemetry',
      });

      const { port, url } = await server.start();
      expect(port).toBe(preferredPort + 1);

      const health = await (await fetch(`${url}/health`)).json();
      expect(health.port).toBe(port);
      expect(health.url).toBe(url);
    } finally {
      await server?.stop();
      server = null;
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });
});

function portFromUrl(url: string): number {
  return Number(new URL(url).port);
}
