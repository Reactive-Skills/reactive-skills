import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TELEMETRY_PORT,
  listenWithPortSelection,
} from '../src/telemetry/port-selection.js';

const HOST = '127.0.0.1';
const servers: http.Server[] = [];

function closeServer(server: http.Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

async function occupyPort(port: number): Promise<http.Server> {
  const server = http.createServer();
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => resolve());
  });
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
});

describe('listenWithPortSelection', () => {
  it('binds an explicitly requested port without fallback', async () => {
    const result = await listenWithPortSelection({
      host: HOST,
      requestedPort: 4262,
      createServer: () => http.createServer(),
    });
    servers.push(result.server);

    expect(result.port).toBe(4262);
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
    const result = await listenWithPortSelection({
      host: HOST,
      createServer: () => http.createServer(),
      maxAttempts: 1,
    });
    servers.push(result.server);

    expect(result.port).toBe(DEFAULT_TELEMETRY_PORT);
  });

  it('falls back to the next available port after a busy preferred port', async () => {
    await occupyPort(DEFAULT_TELEMETRY_PORT);
    const created: http.Server[] = [];
    const result = await listenWithPortSelection({
      host: HOST,
      createServer: () => {
        const server = http.createServer();
        created.push(server);
        return server;
      },
      maxAttempts: 2,
    });
    servers.push(result.server);

    expect(result.port).toBe(DEFAULT_TELEMETRY_PORT + 1);
    expect(created[0]?.listening).toBe(false);
    expect(created[0]?.address()).toBeNull();
  });

  it('fails clearly without fallback when an explicit port is occupied', async () => {
    await occupyPort(4263);

    await expect(listenWithPortSelection({
      host: HOST,
      requestedPort: 4263,
      createServer: () => http.createServer(),
    })).rejects.toThrow('Port 4263 on 127.0.0.1 is already in use.');
  });

  it('reports bounded fallback exhaustion', async () => {
    const preferredPort = 45000;
    for (let port = preferredPort; port < preferredPort + 3; port++) {
      await occupyPort(port);
    }

    await expect(listenWithPortSelection({
      host: HOST,
      preferredPort,
      maxAttempts: 3,
      createServer: () => http.createServer(),
    })).rejects.toThrow('No available telemetry viewer ports in range 45000-45002 on 127.0.0.1.');
  });
});
