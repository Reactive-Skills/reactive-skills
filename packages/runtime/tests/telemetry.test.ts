import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
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
    expect(healthJson.latestSeq).toBe(1);

    // State
    const stateRes = await fetch(`${url}/state`);
    expect(stateRes.status).toBe(200);
    const stateJson = await stateRes.json();
    expect(stateJson.skillName).toBe('test-telemetry');
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
    expect(fullStreamText).toContain('PRIOR_EVENT');
    expect(fullStreamText).toContain('LIVE_SIGNAL');
    expect(fullStreamText).toContain('hello sse');
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
});
