import type { FSMEngine } from '../core/fsm-engine.js';
import type { ExecutionMetrics, PromptSlice } from '../core/types.js';

/**
 * Assemble actionable state data with one prompt representation by default.
 *
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms)
 * - Complexity: O(1) by default, O(c) context keys for legacy compatibility
 * - Cyclomatic Complexity (CC): target <= 8
 * - Branch Coverage: target >= 90%
 * - CRAP Score: target <= 10.0
 */
export function createStateResponse(engine: FSMEngine, slice: PromptSlice, legacyResponse = false) {
  return {
    skill: engine.getManifest().name,
    job_id: engine.getJobName() || engine.getJobId(),
    run_id: engine.getJobId(),
    activeState: engine.getCurrentState(),
    isWaitingForHuman: engine.isWaitingForHuman(),
    allowedTools: slice.allowedTools,
    formattedXml: slice.formattedXml,
    scopedContext: slice.scopedContext,
    contextDelta: slice.contextDelta,
    isRevisit: !!slice.contextDelta?.is_revisit,
    strict_execution: engine.isStrictExecution(),
    turns_since_last_signal: engine.getTurnsSinceLastSignal(),
    // Keep the engine's latest slice metrics in sync with this delivery estimate.
    metrics: slice.metrics ?? { slice_tokens_est: 0 },
    ...(legacyResponse ? { promptSlice: slice.rawPrompt, context: engine.getContext() } : {}),
  };
}

/**
 * Measure the compact JSON text delivered as MCP content, including its estimate.
 * Updates the shared slice metrics used by the live engine's next transition.
 * JSON-RPC framing and tool schemas are outside this estimate.
 *
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms for bounded active-state responses)
 * - Complexity: O(b) response bytes; bounded passes until estimate digits stabilize
 * - Cyclomatic Complexity (CC): 2
 * - Branch Coverage: target >= 90%
 * - CRAP Score: target <= 10.0
 */
export function serializeStateResponse(payload: unknown, metrics: ExecutionMetrics): string {
  let text: string;
  let previousEstimate: number | undefined;
  do {
    text = JSON.stringify(payload);
    previousEstimate = metrics.slice_tokens_est;
    metrics.slice_tokens_est = Math.ceil(Buffer.byteLength(text, 'utf8') / 4);
  } while (metrics.slice_tokens_est !== previousEstimate);
  return text;
}
