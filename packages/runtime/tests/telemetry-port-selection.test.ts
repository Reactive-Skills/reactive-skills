import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listenWithPortSelection,
} from '../src/telemetry/port-selection.js';
import { closeServer, reservePorts } from './support/ports.js';

const HOST = '127.0.0.1';
const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
});

describe('listenWithPortSelection', () => {
  it('binds an explicitly requested port without fallback', async () => {
    const { port: requestedPort, servers: reserved } = await reservePorts(1);
    servers.push(...reserved);
    await closeServer(reserved[0]);
    const result = await listenWithPortSelection({
      host: HOST,
      requestedPort,
      createServer: () => http.createServer(),
    });
    servers.push(result.server);

    expect(result.port).toBe(requestedPort);
  });

  it('preserves explicit port 0 OS-assigned selection', async () => {
    const result = await listenWithPortSelection({
      host: HOST,
      requestedPort: 0,
      createServer: () => http.createServer(),
    });
    servers.push(result.server);

    expect(result.port).toBeGreaterThan(0);
    expect(result.port).not.toBe(0);
  });

  it('uses the preferred port when it is available', async () => {
    const { port: preferredPort, servers: reserved } = await reservePorts(1);
    servers.push(...reserved);
    await closeServer(reserved[0]);
    const result = await listenWithPortSelection({
      host: HOST,
      preferredPort,
      createServer: () => http.createServer(),
      maxAttempts: 1,
    });
    servers.push(result.server);

    expect(result.port).toBe(preferredPort);
  });

  it('falls back to the next available port after a busy preferred port', async () => {
    const { port: preferredPort, servers: reserved } = await reservePorts(2);
    servers.push(...reserved);
    await closeServer(reserved[1]);
    const created: http.Server[] = [];
    const result = await listenWithPortSelection({
      host: HOST,
      preferredPort,
      createServer: () => {
        const server = http.createServer();
        created.push(server);
        return server;
      },
      maxAttempts: 2,
    });
    servers.push(result.server);

    expect(result.port).toBe(preferredPort + 1);
    expect(created[0]?.listening).toBe(false);
    expect(created[0]?.address()).toBeNull();
  });

  it('fails clearly without fallback when an explicit port is occupied', async () => {
    const { port: requestedPort, servers: reserved } = await reservePorts(1);
    servers.push(...reserved);

    await expect(listenWithPortSelection({
      host: HOST,
      requestedPort,
      createServer: () => http.createServer(),
    })).rejects.toThrow(`Port ${requestedPort} on 127.0.0.1 is already in use.`);
  });

  it('reports bounded fallback exhaustion', async () => {
    const { port: preferredPort, servers: reserved } = await reservePorts(3);
    servers.push(...reserved);

    await expect(listenWithPortSelection({
      host: HOST,
      preferredPort,
      maxAttempts: 3,
      createServer: () => http.createServer(),
    })).rejects.toThrow(`No available telemetry viewer ports in range ${preferredPort}-${preferredPort + 2} on 127.0.0.1.`);
  });
});
