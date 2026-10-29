// Loaded by the benchmark CLI and its cold AXI children. No credentials are read or changed.
import { syncBuiltinESMExports } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

/** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): 1 (measured; threshold <= 20)
 * - Branch Coverage: not measured (runs only in CLI and cold AXI child processes, outside the Vitest coverage run; target >= 60%)
 * - CRAP Score: not measured without coverage; bounded at 1.0-2.0 by CC 1 (threshold <= 30.0) */
function refuseNetwork() {
  throw new Error('Transport benchmark is offline; network access refused');
}

globalThis.fetch = refuseNetwork;
http.request = http.get = https.request = https.get = refuseNetwork;
net.connect = net.createConnection = tls.connect = refuseNetwork;
syncBuiltinESMExports();
