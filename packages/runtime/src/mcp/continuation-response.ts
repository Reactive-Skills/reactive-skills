import type { FSMEngine } from '../core/fsm-engine.js';
import type { SignalEvent } from '../core/types.js';
import { createStateView } from '../core/state-view.js';
import { serializeStateResponse } from './state-response.js';

const operations = new Map<string, Promise<unknown>>();
export const CONTINUATION_EVENT = 'MCP_CONTINUATION_RECORDED';
export type Receipt = Record<string, unknown>;
export type SignalHandlingResult = Awaited<ReturnType<FSMEngine['handleSignal']>>;

/**
 * Serialize MCP mutation/delivery work per immutable run, across server instances.
 * Refresh inside the queue so another client's accepted signal cannot leave a stale view.
 * # Performance & Risk Budget
 * - Tier: P2 orchestration (<100ms local work; queued guards/adapters additional)
 * - Complexity: O(1) queue bookkeeping; operation costs additional
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export async function withMcpRun<T>(workspace: string, engine: FSMEngine, refresh: () => FSMEngine, work: (engine: FSMEngine) => Promise<T>): Promise<T> {
  const key = JSON.stringify([workspace, engine.getManifest().name, engine.getJobId()]);
  const previous = operations.get(key) ?? Promise.resolve();
  const operation = previous.then(() => work(refresh()));
  const settled = operation.then(() => undefined, () => undefined);
  operations.set(key, settled);
  try {
    return await operation;
  } finally {
    if (operations.get(key) === settled) operations.delete(key);
  }
}

/**
 * Find only the bounded direct children of this submission, never full run history.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms)
 * - Complexity: O(k), indexed causation query results for one request
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function continuationRecord(engine: FSMEngine, event?: SignalEvent | null): SignalEvent | undefined {
  if (!event || !event.idempotency_key) return undefined;
  return engine.getEventStore().query({ causationId: event.id }).find(row => row.type === CONTINUATION_EVENT);
}

/**
 * Resolve a keyed submission through the existing index and prevent cross-tool reuse.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms)
 * - Complexity: O(1) indexed request lookup
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function submissionEvent(engine: FSMEngine, key: string | undefined, type: 'SIGNAL_EMITTED' | 'DECISION_RECORDED') {
  const existing = key ? engine.getEventStore().getEventByIdempotencyKey(key) : undefined;
  if (existing && existing.type !== type) throw new Error('Idempotency key belongs to another operation.');
  return existing;
}

/**
 * Report the saved original signal receipt separately from the current view.
 * An old key without receipt metadata is explicit rather than inventing its outcome.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms local lookup; view construction additional)
 * - Complexity: O(k + b), indexed request children and current view bytes
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function retrySignalResponse(engine: FSMEngine, key: string | undefined, returnView: boolean): string | undefined {
  const existing = submissionEvent(engine, key, 'SIGNAL_EMITTED');
  if (!returnView || !existing) return undefined;
  const saved = continuationRecord(engine, existing);
  const receipt = saved?.payload.receipt ?? { event_id: existing.id, result_unavailable: true,
    reason: 'The original request did not record a continuation receipt. The view is current; do not resubmit under a new key.' };
  return continuationResponse(engine, receipt, existing, true);
}

type ViewAnchor = { run_id?: string; seq: number };

/**
 * Supply actionable guidance for unhandled input without altering legacy receipts.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(1), metadata only
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function refusalReceipt(receipt: Receipt): Receipt {
  if (receipt.transitioned !== false || receipt.refusalReason) return receipt;
  return { ...receipt, refusalReason: 'No applicable transition accepted this input. Use the current view contracts and supply their required payload; at a human gate wait for the specified response.' };
}

/**
 * Keep a prior anchor on replay; missing historical metadata remains explicit.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function resultAnchor(saved: SignalEvent | undefined, replayed: boolean, current: ViewAnchor): ViewAnchor | null {
  return saved?.payload.result_view ?? (replayed ? null : current);
}

/**
 * Store receipt metadata only for keyed original submissions.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms)
 * - Complexity: O(b), receipt metadata bytes
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function saveReceipt(engine: FSMEngine, event: SignalEvent, saved: SignalEvent | undefined, replayed: boolean, receipt: Receipt, anchor: ViewAnchor | null): void {
  if (saved || replayed || !event.idempotency_key) return;
  engine.getEventStore().append(CONTINUATION_EVENT, { receipt, result_view: anchor }, { state: engine.getCurrentState(), causationId: event.id, source: 'mcp' });
}

/**
 * Attach original warnings only when they describe the current result view.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function matchingOutcome(receipt: Receipt, anchor: ViewAnchor | null, currentSeq: number) {
  if (anchor?.seq !== currentSeq) return {};
  return {
    refusalReason: receipt.refusalReason as string | undefined,
    judgmentBasis: receipt.judgmentBasis as 'human' | 'self_reported' | undefined,
    warning: receipt.warning as string | undefined,
  };
}

/**
 * Deliver one complete current view after settled signal work. Durable receipt metadata
 * distinguishes an original result from a later view without storing prompts or context.
 * Replays serialize the current view but append no delivery or other event.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms bounded view; existing persistence/approval queries additional)
 * - Complexity: O(b + h² + a + w), view bytes, ancestry, approvals, bounded delivery window
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function continuationResponse(engine: FSMEngine, receipt: Receipt, event: SignalEvent, replayed = false): string {
  if (engine.hasExternalChanges()) throw new Error('RUN_VERSION_CONFLICT: Reload the same run before requesting its current view.');
  const saved = continuationRecord(engine, event);
  if (!replayed && !saved) engine.recordStateDelivery();
  const slice = engine.generatePromptSlice();
  const currentSeq = engine.getStateViewSeq();
  const resultView = resultAnchor(saved, replayed, { run_id: engine.getJobId(), seq: currentSeq });
  const enriched = refusalReceipt(receipt);
  saveReceipt(engine, event, saved, replayed, enriched, resultView);
  const original = saved?.payload.receipt ?? enriched;
  const outcome = matchingOutcome(original, resultView, currentSeq);
  return serializeStateResponse({
    receipt: original,
    replayed: replayed || !!saved,
    result_view: resultView,
    view: createStateView(engine, slice, outcome),
  }, slice.metrics!);
}

/**
 * Preserve the existing emit receipt; continuation adds the canonical signal identity.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(1), fixed metadata and projection references
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function signalReceipt(engine: FSMEngine, result: SignalHandlingResult): Receipt {
  return {
    skill: engine.getManifest().name,
    job_id: engine.getJobName() || engine.getJobId(),
    run_id: engine.getJobId(),
    transitioned: result.transitioned,
    previousState: result.previousState,
    newState: result.newState,
    isWaitingForHuman: engine.isWaitingForHuman(),
    projectionsWritten: result.deliverablesWritten,
    refusalReason: result.refusalReason,
    judgmentBasis: result.judgmentBasis,
    warning: result.warning,
  };
}
