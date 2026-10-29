import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import { RUNTIME_VERSION } from '../../src/core/runtime-capabilities.js';
import { bytes, NORMALIZATION } from './accounting.js';
import { filesUnder, fixtureDir, repositoryRoot, prepareWorkspace } from './fixtures.js';
import { installOfflineAdapter } from './offline.js';
import { measureMcp } from './mcp.js';
import { measureSdk } from './sdk.js';
import { measureAxi } from './axi.js';

/** Reads canonical rows and every JSONL segment outside timed operations; never appends telemetry.
 * # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(e+b) events and ledger bytes
 * - Cyclomatic Complexity (CC): 3 (measured; threshold <= 20)
 * - Branch Coverage: 82% (9/11 V8 branches measured; target >= 60%)
 * - CRAP Score: 3.1 (measured; threshold <= 30.0)
 */
function inspectLedger(workspace: string) {
  return filesUnder(path.join(workspace, '.reactive', 'skills'))
    .filter((file) => path.basename(file) === 'events.db')
    .map((file) => {
      const db = new DatabaseSync(file, { readOnly: true });
      try {
        const runs = db.prepare(`SELECT r.run_id, r.name, count(e.id) AS events,
          sum(e.type IN ('STATE_VISITED', 'STATE_REVISITED')) AS state_visits,
          sum(e.type = 'STATE_TRANSITION') AS transitions,
          sum(e.type = 'GUARD_EVALUATED' AND json_extract(e.payload, '$.passed') = 0) AS failed_guards
          FROM runs r LEFT JOIN events e ON e.run_id = r.run_id GROUP BY r.run_id ORDER BY min(e.ledger_seq)`).all();
        const metricRows = db.prepare(`SELECT type, payload FROM events
          WHERE type IN ('STATE_TRANSITION', 'TRANSITION_COMPLETED') ORDER BY ledger_seq`).all();
        const metrics = metricRows.filter((row) => row.type === 'STATE_TRANSITION')
          .map((row) => JSON.parse(String(row.payload)).metrics ?? null);
        const completedMetrics = metricRows.filter((row) => row.type === 'TRANSITION_COMPLETED')
          .map((row) => JSON.parse(String(row.payload)).metrics ?? null);
        const files = filesUnder(path.dirname(file)).filter((name) => /events(?:-\d+)?\.jsonl$|events\.db(?:-wal|-shm)?$/.test(path.basename(name)))
          .map((name) => ({ path: path.relative(workspace, name), bytes: fs.statSync(name).size }));
        return { skill: path.basename(path.dirname(file)), runs, files, transition_metrics: metrics, completed_transition_metrics: completedMetrics };
      } finally { db.close(); }
    });
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(b) explicitly consumed projection bytes
 * - Cyclomatic Complexity (CC): 1 (measured; threshold <= 20)
 * - Branch Coverage: 100% (2/2 V8 branches measured; target >= 60%)
 * - CRAP Score: 1.0 (measured; threshold <= 30.0) */
function readArtifacts(workspace: string) {
  return filesUnder(path.join(workspace, '.docs')).map((file) => {
    const content = fs.readFileSync(file);
    return { path: path.relative(workspace, file), bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') };
  });
}

/** Runs an isolated, scripted transport trace. No model generation or host cache behavior is inferred.
 * # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(e+b) bounded fixture events and serialized bytes
 * - Cyclomatic Complexity (CC): 5 (measured; threshold <= 20)
 * - Branch Coverage: 88% (14/16 V8 branches measured; target >= 60%)
 * - CRAP Score: 5.0 (measured; threshold <= 30.0)
 */
export async function runBenchmark(options: { includeAxi?: boolean } = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-transport-'));
  const offline = installOfflineAdapter();
  try {
    const mcpWorkspace = path.join(scratch, 'mcp');
    const sdkWorkspace = path.join(scratch, 'sdk');
    const axiWorkspace = path.join(scratch, 'axi');
    const fixture = prepareWorkspace(mcpWorkspace);
    prepareWorkspace(sdkWorkspace);
    prepareWorkspace(axiWorkspace);
    const mcp = await measureMcp(mcpWorkspace);
    const sdk = await measureSdk(sdkWorkspace);
    const axi = options.includeAxi === false ? [] : measureAxi(axiWorkspace);
    const ledgers = [mcpWorkspace, sdkWorkspace, axiWorkspace].flatMap((workspace) =>
      inspectLedger(workspace).map((ledger) => ({ transport: path.basename(workspace), ...ledger })));
    const artifacts = [mcpWorkspace, sdkWorkspace, axiWorkspace].flatMap((workspace) =>
      readArtifacts(workspace).map((artifact) => ({ transport: path.basename(workspace), ...artifact })));
    const mcpScripted = mcp.rows.filter((row) => row.actor === 'script')
      .reduce((sum, row) => sum + (row.raw as { input_payload_bytes: number }).input_payload_bytes, 0);
    const axiScripted = axi.reduce((sum, row) => sum + row.raw.argv_json_bytes, 0);
    return {
      schema_version: 1,
      environment: {
        node: process.version, platform: process.platform, arch: process.arch, runtime_version: RUNTIME_VERSION,
        runtime_revision: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).stdout?.trim() || 'unavailable',
      },
      methodology: {
        units: 'UTF-8 bytes and milliseconds; byte counts are not token counts',
        normalization: NORMALIZATION,
        timing: 'MCP: in-memory SDK round trip and handler; AXI: fresh Node process, warm filesystem allowed; SDK: in-process. No model or host scheduling.',
        offline_judgments: 'Benchmark-only deterministic adapter registered as jev; not a Jev quality or latency measurement.',
        model_output: 'No model invoked. Scripted model-equivalent arguments are a proxy, not measured generated output.',
        protocol: 'MCP SDK frames serialized by its stdio serializer (includes newline); AXI stdout has no invented JSON-RPC wrapper; SDK has no wire envelope.',
        transition_metrics: 'Uses returned and persisted transition_total_ms from TRANSITION_COMPLETED. Pre-persistence transition_duration_ms remains separate. No benchmark telemetry events are appended.',
        source_selectivity: 'Authored source bytes are inventory, never delivered-context savings. Full normalized frames and SDK views are retained.',
      },
      fixture,
      historical_tdd_baseline: JSON.parse(fs.readFileSync(path.join(fixtureDir, 'tdd-baseline.json'), 'utf8')),
      tdd_baseline: sdk.baseline,
      mcp,
      sdk,
      axi,
      ledgers,
      artifact_reads: artifacts,
      counts: {
        model_calls: 0, model_output_bytes: 0,
        scripted_model_equivalent_input_bytes: mcpScripted + axiScripted,
        mcp_scripted_argument_bytes: mcpScripted,
        axi_scripted_argv_bytes: axiScripted,
        human_fixture_input_bytes: mcp.rows.filter((row) => row.actor === 'human_fixture')
          .reduce((sum, row) => sum + (row.raw as { input_payload_bytes: number }).input_payload_bytes, 0),
        mcp_tool_calls: mcp.rows.length,
        axi_commands: axi.length,
        sdk_view_calls: sdk.rows.length,
        resumed_state_fetches: [...mcp.rows, ...sdk.rows, ...axi].filter((row) => row.resumed_state_fetch).length,
        artifact_reads: artifacts.length,
        artifact_read_bytes: artifacts.reduce((sum, row) => sum + row.bytes, 0),
        local_judgment_attempts: offline.attempts(),
        // Initialization, schema discovery and host tool schemas are not hidden inside tool-result text.
        mcp_handshake_request_bytes: mcp.handshake.sent.reduce((sum, frame) => sum + bytes(serializeMessage(frame)), 0),
        mcp_handshake_response_bytes: mcp.handshake.received.reduce((sum, frame) => sum + bytes(serializeMessage(frame)), 0),
      },
    };
  } finally {
    offline.restore();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
