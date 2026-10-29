import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { measureExchange, normalizeText } from '../scripts/transport-benchmark/accounting.js';
import { runBenchmark } from '../scripts/transport-benchmark/run.js';

describe('transport benchmark accounting', () => {
  it('counts UTF-8 payload, text, result and framed JSON-RPC separately', () => {
    const request = { jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'example', arguments: { text: 'é' } } };
    const result = { content: [{ type: 'text', text: '世界\n' }] };
    const response = { jsonrpc: '2.0', id: 12, result };
    const row = measureExchange(request, response, []);
    expect(row.raw.input_payload_bytes).toBe(Buffer.byteLength('{"text":"é"}'));
    expect(row.raw.tool_result_text_bytes).toBe(7);
    expect(row.raw.result_bytes).toBe(Buffer.byteLength(JSON.stringify(result)));
    expect(row.raw.request_envelope_bytes).toBe(Buffer.byteLength(JSON.stringify(request) + '\n'));
    expect(row.raw.response_envelope_bytes).toBe(Buffer.byteLength(JSON.stringify(response) + '\n'));
  });

  it('normalizes variable UUIDs, ISO timestamps and scratch roots explicitly', () => {
    const text = '/tmp/a 01234567-89ab-7cde-8fab-0123456789ab 2026-10-29T01:23:45.678Z';
    expect(normalizeText(text, ['/tmp/a'])).toBe('<workspace> 00000000-0000-7000-8000-000000000000 2000-01-01T00:00:00.000Z');
    expect(normalizeText('authored é 世界 and seq 42', [])).toBe('authored é 世界 and seq 42');
    expect(normalizeText('{"slice_duration_ms":12.345,"slice_tokens_est":573}', [])).toBe('{"slice_duration_ms":0,"slice_tokens_est":0}');
  });

  it('runs offline real MCP and SDK views with refusals, recovery, concurrency and legacy delivery', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Unexpected benchmark network call'); });
    const credentials = process.env.TYPESAFE_API_KEY;
    let report;
    const includeAxi = fs.existsSync(new URL('../../../apps/axi/dist/cli/index.js', import.meta.url));
    try {
      report = await runBenchmark({ includeAxi });
      expect(fetch).not.toHaveBeenCalled();
      expect(process.env.TYPESAFE_API_KEY).toBe(credentials);
    } finally { fetch.mockRestore(); }
    const expected = JSON.parse(fs.readFileSync(new URL('../scripts/transport-benchmark/fixtures/expected-bytes.json', import.meta.url), 'utf8'));
    expect(report.counts.model_calls).toBe(0);
    expect(report.counts.model_output_bytes).toBe(0);
    expect(report.counts.local_judgment_attempts).toBe(2);
    expect(report.counts.mcp_tool_calls).toBe(15);
    expect(report.counts.resumed_state_fetches).toBe(includeAxi ? 4 : 3);
    expect(report.counts.artifact_reads).toBeGreaterThan(0);
    expect(report.tdd_baseline.rendered_prompt_bytes).toBe(392);
    expect(report.tdd_baseline.state).toBe('REFACTOR.CLEAN_CODE');
    expect(report.tdd_baseline).toEqual(expected.tdd_baseline);
    expect(Object.fromEntries(report.mcp.rows.map((row) => [row.label, row.normalized]))).toEqual(expected.mcp);
    expect(Object.fromEntries(report.sdk.rows.map((row) => [row.label, row.normalized]))).toEqual(expected.sdk);
    if (includeAxi) {
      expect(Object.fromEntries(report.axi.map((row) => [row.label, row.normalized]))).toEqual(expected.axi);
      expect(report.axi.every((row) => row.timing.mode === 'cold_process')).toBe(true);
    }
    expect(report.sdk.transitions.map((transition) => (transition as { transitioned: boolean }).transitioned)).toEqual([true, false, true, true]);
    expect(report.sdk.rows.filter((row) => row.resumed_state_fetch).map((row) => row.label)).toEqual(['snapshot', 'replay']);
    expect(report.mcp.rows.map((row) => row.label)).toEqual(expect.arrayContaining(['guard_refusal', 'failure', 'human_response', 'legacy_prepare', 'concurrent-a', 'concurrent-b']));
    const responses = Object.fromEntries(report.mcp.rows.map((row) => {
      const frame = row.response as { result: { isError?: boolean; content: Array<{ text: string }> } };
      return [row.label, { ...JSON.parse(frame.result.content[0].text), isError: frame.result.isError }];
    }));
    expect(responses.guard_refusal.transitioned).toBe(false);
    expect(responses.failure.isError).toBe(true);
    expect(responses.gate.isWaitingForHuman).toBe(true);
    expect(responses.human_response.currentState).toBe('WORK');
    expect(responses.legacy_prepare.context.source).toBe('skill_markdown');
    expect(report.sdk.findings).toEqual([expect.objectContaining({
      id: 'tdd-replay-refactor-cycles', status: 'expected_failure', observed: { live: 1, snapshot: 1, replay: 0 },
    })]);
  });

  it('rejects benchmark CLI network access before opening a connection', () => {
    const fence = fileURLToPath(new URL('../scripts/transport-benchmark/network-fence.mjs', import.meta.url));
    const result = spawnSync(process.execPath, ['--import', fence, '--input-type=module', '-e', `
      import net from 'node:net';
      let refused = 0;
      for (const call of [() => fetch('https://example.invalid'), () => net.connect(443, 'example.invalid')]) {
        try { call(); } catch (error) { if (error.message.includes('benchmark is offline')) refused++; }
      }
      process.exit(refused === 2 ? 0 : 1);
    `], { timeout: 5000 });
    expect(result.status).toBe(0);
  });
});
