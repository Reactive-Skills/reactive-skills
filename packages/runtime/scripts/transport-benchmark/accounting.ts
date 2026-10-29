import { serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export const NORMALIZATION = {
  uuid: '00000000-0000-7000-8000-000000000000',
  iso_timestamp: '2000-01-01T00:00:00.000Z',
  workspace: '<workspace>',
  duration_values_ms: 0,
  native_slice_token_estimate: 0,
  jsonrpc_id: 0,
};

/** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(b) UTF-8 bytes
 * - Cyclomatic Complexity (CC): 1 (measured; threshold <= 20)
 * - Branch Coverage: 100% (1/1 V8 branches measured; target >= 60%)
 * - CRAP Score: 1.0 (measured; threshold <= 30.0) */
export function bytes(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(b*r), r = bounded scratch roots
 * - Cyclomatic Complexity (CC): 2 (measured; threshold <= 20)
 * - Branch Coverage: 100% (3/3 V8 branches measured; target >= 60%)
 * - CRAP Score: 2.0 (measured; threshold <= 30.0) */
export function normalizeText(text: string, roots: string[]): string {
  for (const root of [...roots].sort((a, b) => b.length - a.length)) {
    text = text.replaceAll(root, NORMALIZATION.workspace);
    text = text.replaceAll(JSON.stringify(root).slice(1, -1), NORMALIZATION.workspace);
  }
  return text
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, NORMALIZATION.uuid)
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\b/g, NORMALIZATION.iso_timestamp)
    .replace(/("(?:\w*duration_ms|latencyMs|latency_ms|slice_tokens_est)"\s*:\s*)\d+(?:\.\d+)?/g, (_match, prefix) => prefix + '0');
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(b*r)
 * - Cyclomatic Complexity (CC): 6 (measured; threshold <= 20)
 * - Branch Coverage: 100% (12/12 V8 branches measured; target >= 60%)
 * - CRAP Score: 6.0 (measured; threshold <= 30.0) */
export function normalizeValue(value: unknown, roots: string[]): unknown {
  if (typeof value === 'string') return normalizeText(value, roots);
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item, roots));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /duration_ms$|^latencyMs$|^latency_ms$|^slice_tokens_est$/.test(key) ? 0 : normalizeValue(item, roots),
    ]));
  }
  return value;
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(b)
 * - Cyclomatic Complexity (CC): 10 (measured; threshold <= 20)
 * - Branch Coverage: 50% (5/10 V8 branches measured; target >= 60%)
 * - CRAP Score: 22.5 (measured; threshold <= 30.0) */
function countExchange(request: JSONRPCMessage, response: JSONRPCMessage) {
  const params = 'params' in request ? request.params as { arguments?: unknown } : undefined;
  const result = 'result' in response ? response.result : undefined;
  const content = (result as { content?: Array<{ type: string; text?: string }> })?.content ?? [];
  return {
    input_payload_bytes: bytes(JSON.stringify(params?.arguments ?? {})),
    tool_result_text_bytes: content.reduce((sum, item) => sum + (item.type === 'text' ? bytes(item.text ?? '') : 0), 0),
    result_bytes: bytes(JSON.stringify(result ?? null)),
    request_envelope_bytes: bytes(serializeMessage(request)),
    response_envelope_bytes: bytes(serializeMessage(response)),
  };
}

/** Counts actual SDK messages using the SDK's newline-delimited stdio serializer.
 * # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(b*r)
 * - Cyclomatic Complexity (CC): 1 (measured; threshold <= 20)
 * - Branch Coverage: 100% (1/1 V8 branches measured; target >= 60%)
 * - CRAP Score: 1.0 (measured; threshold <= 30.0)
 */
export function measureExchange(request: JSONRPCMessage, response: JSONRPCMessage, roots: string[]) {
  const normalizedRequest = { ...normalizeValue(request, roots) as object, id: 0 } as JSONRPCMessage;
  const normalizedResponse = { ...normalizeValue(response, roots) as object, id: 0 } as JSONRPCMessage;
  return {
    raw: countExchange(request, response),
    normalized: countExchange(normalizedRequest, normalizedResponse),
    request: normalizedRequest,
    response: normalizedResponse,
  };
}
