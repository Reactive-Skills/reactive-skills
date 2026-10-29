// Loaded by the benchmark CLI and its cold AXI children. No credentials are read or changed.
import { syncBuiltinESMExports } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

/** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <= 1
 * - Branch Coverage: target >= 60%
 * - CRAP Score: target <= 30.0 */
function refuseNetwork() {
  throw new Error('Transport benchmark is offline; network access refused');
}

globalThis.fetch = refuseNetwork;
http.request = http.get = https.request = https.get = refuseNetwork;
net.connect = net.createConnection = tls.connect = refuseNetwork;
syncBuiltinESMExports();
