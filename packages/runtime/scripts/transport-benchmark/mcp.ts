import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { createReactiveMcpServer } from '../../src/mcp/server.js';
import { measureExchange } from './accounting.js';

/** Measures real MCP handlers and captures SDK request/result frames, without a host or model.
 * # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(b+e) delivered bytes and fixture events
 * - Cyclomatic Complexity (CC): target <= 10
 * - Branch Coverage: target >= 60%
 * - CRAP Score: target <= 30.0
 */
export async function measureMcp(workspace: string) {
  const server = createReactiveMcpServer({ workspaceDir: workspace, defaultSkill: 'tdd-refactor' });
  const handlerTimes = new Map<string, number>();
  // SDK-internal access is confined to timing. All calls and frames use its public Client API.
  const registered = (server as unknown as { _registeredTools: Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> })._registeredTools;
  for (const [name, tool] of Object.entries(registered)) {
    const handler = tool.handler;
    /** # Performance & Risk Budget
     * - Tier: P3 (offline timing wrapper)
     * - Complexity: O(1) in addition to the measured handler
     * - Cyclomatic Complexity (CC): 1
     * - Branch Coverage: target >= 60%
     * - CRAP Score: target <= 30.0
     */
    tool.handler = async (...args) => {
      const start = performance.now();
      try { return await handler(...args); }
      finally { handlerTimes.set(name + JSON.stringify(args[0]), performance.now() - start); }
    };
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const sent: JSONRPCMessage[] = [];
  const received: JSONRPCMessage[] = [];
  const clientSend = clientTransport.send.bind(clientTransport);
  const serverSend = serverTransport.send.bind(serverTransport);
  clientTransport.send = async (message, options) => { sent.push(message); await clientSend(message, options); };
  serverTransport.send = async (message, options) => { received.push(message); await serverSend(message, options); };
  const client = new Client({ name: 'transport-benchmark', version: '1.0.0' });
  const rows: Array<Record<string, unknown>> = [];

  /** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(b) message bytes
 * - Cyclomatic Complexity (CC): target <= 5
 * - Branch Coverage: target >= 60%
 * - CRAP Score: target <= 30.0 */
  async function call(label: string, name: string, args: Record<string, unknown>, resumed = false, actor = 'script') {
    const startIndex = sent.length;
    const start = performance.now();
    const result = await client.callTool({ name, arguments: args });
    const roundTrip = performance.now() - start;
    const request = sent.slice(startIndex).find((frame) => 'method' in frame && frame.method === 'tools/call'
      && JSON.stringify(frame.params) === JSON.stringify({ name, arguments: args }));
    if (!request || !('id' in request)) throw new Error(`Missing MCP request: ${label}`);
    const response = received.find((frame) => 'id' in frame && frame.id === request.id);
    if (!response) throw new Error(`Missing MCP response: ${label}`);
    rows.push({
      label, transport: 'mcp', operation: name, actor, resumed_state_fetch: resumed,
      timing: { mode: 'persistent_handler', handler_ms: handlerTimes.get(name + JSON.stringify(args)), round_trip_ms: roundTrip },
      ...measureExchange(request, response, [workspace]),
    });
    return result;
  }

  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const handshake = { sent: [...sent], received: [...received] };
    const discoveryIndex = sent.length;
    await client.listTools();
    const discoveryRequest = sent[discoveryIndex];
    const discoveryResponse = received.find((frame) => 'id' in frame && 'id' in discoveryRequest && frame.id === discoveryRequest.id);
    if (!discoveryResponse) throw new Error('Missing MCP tools/list response');
    const discovery = measureExchange(discoveryRequest, discoveryResponse, [workspace]);
    await call('initial', 'reactive_state', { skill: 'tdd-refactor' });
    await call('prepare', 'reactive_context_prepare', {
      user_message: 'Run the TDD workflow',
      candidates: [{ id: 'tdd', skill: 'tdd-refactor', summary: 'TDD workflow' }],
    });
    await call('ready', 'reactive_emit_signal', { skill: 'tdd-refactor', signal: 'RUNTIME_READY' });
    await call('guard_refusal', 'reactive_emit_signal', { skill: 'tdd-refactor', signal: 'TEST_RAN', payload: { exit_code: 0 } });
    await call('red', 'reactive_emit_signal', { skill: 'tdd-refactor', signal: 'TEST_RAN', payload: { exit_code: 1 } });
    await call('green', 'reactive_emit_signal', { skill: 'tdd-refactor', signal: 'TEST_RAN', payload: { exit_code: 0 } });
    await call('clean', 'reactive_state', { skill: 'tdd-refactor' });
    await call('resume_empty_transcript', 'reactive_state', { skill: 'tdd-refactor' }, true);
    await call('failure', 'reactive_state', { skill: 'benchmark-missing-fixture' });
    await call('gate_ready', 'reactive_emit_signal', { skill: 'benchmark-human', signal: 'READY' });
    await call('gate', 'reactive_state', { skill: 'benchmark-human' });
    await call('human_response', 'reactive_respond_human', { skill: 'benchmark-human', choice: 'Approve', approved: true }, false, 'human_fixture');
    await call('legacy_prepare', 'reactive_context_prepare', {
      user_message: 'Inspect the target',
      candidates: [{ id: 'legacy', skill: 'benchmark-legacy', summary: 'Inspect the target' }],
    });
    await Promise.all(['concurrent-a', 'concurrent-b'].map((job_id) =>
      call(job_id, 'reactive_state', { skill: 'tdd-refactor', job_id })));
    return { rows, handshake, discovery };
  } finally {
    await client.close();
    await server.close();
  }
}
