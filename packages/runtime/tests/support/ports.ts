import http from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

/**
 * Release a fixture-owned listener, including one whose bind failed.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (< 2000ms), test setup and teardown only.
 * - Complexity: O(1).
 * - Cyclomatic Complexity (CC): 2.
 * - Branch Coverage: target >= 60%.
 * - CRAP Score: budget <= 30.0.
 */
export function closeServer(server: http.Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

/**
 * Reserve adjacent loopback ports starting at an OS-assigned ephemeral port.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (< 2000ms), test setup only.
 * - Complexity: O(a * n), bounded to a <= 50 attempts and n <= 3 fixture ports.
 * - Cyclomatic Complexity (CC): budget <= 20.
 * - Branch Coverage: target >= 60%.
 * - CRAP Score: budget <= 30.0.
 */
export async function reservePorts(count: number): Promise<{ port: number; servers: http.Server[] }> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const servers: http.Server[] = [];
    try {
      const first = http.createServer();
      servers.push(first);
      await once(first.listen(0, '127.0.0.1'), 'listening');
      const port = (first.address() as AddressInfo).port;
      if (port + count > 65536) {
        await Promise.all(servers.map(closeServer));
        continue;
      }
      for (let offset = 1; offset < count; offset++) {
        const next = http.createServer();
        servers.push(next);
        await once(next.listen(port + offset, '127.0.0.1'), 'listening');
      }
      return { port, servers };
    } catch (error) {
      await Promise.all(servers.map(closeServer));
      if (!['EADDRINUSE', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
    }
  }
  throw new Error('Could not reserve adjacent ports for telemetry fixtures');
}
