import path from 'node:path';
import type { FSMEngine } from '../core/fsm-engine.js';
import type { SignalEvent } from '../core/types.js';
import { createDeltaView, createStateView } from '../core/state-view.js';
import { serializeStateResponse } from './state-response.js';

const operations = new Map<string, Promise<unknown>>();
export const CONTINUATION_EVENT = 'MCP_CONTINUATION_RECORDED';
export type Receipt = Record<string, unknown>;
export type SignalHandlingResult = Awaited<ReturnType<FSMEngine['handleSignal']>>;
export type ReceiptPaths = 'relative' | 'absolute';
export type ReceiptFormatter = (receipt: Receipt) => Receipt;
const unformatted: ReceiptFormatter = receipt => receipt;

/**
 * Report receipt projection paths relative to the workspace, or absolute when requested.
 * Only the response changes: saved receipts keep absolute paths, so a retry or an old run formats the same way.
 * A path outside the workspace stays absolute.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(p), returned projection paths
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function formatReceiptPaths(receipt: Receipt, workspaceDir: string, mode: ReceiptPaths = 'relative'): Receipt {
  const written = receipt.projectionsWritten;
  if (mode === 'absolute' || !Array.isArray(written)) return receipt;
  const root = path.resolve(workspaceDir);
  return { ...receipt, projectionsWritten: written.map(file => workspacePath(root, String(file))) };
}

/**
 * One workspace-relative POSIX path, or the original path when it is not inside the workspace.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(l), path length
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function workspacePath(root: string, file: string): string {
  const relative = path.relative(root, path.resolve(root, file));
  const outside = !relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
  return outside ? file : relative.split(path.sep).join('/');
}

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
export function retrySignalResponse(engine: FSMEngine, key: string | undefined, returnView: boolean, formatReceipt = unformatted): string | undefined {
  // Retries answer a lost response, so they always carry the complete view.
  const existing = submissionEvent(engine, key, 'SIGNAL_EMITTED');
  if (!returnView || !existing) return undefined;
  const saved = continuationRecord(engine, existing);
  return continuationResponse(engine, saved?.payload.receipt ?? unavailableReceipt(existing), existing, undefined, formatReceipt);
}

/**
 * Mark an original outcome that was committed without a saved receipt instead of inventing it.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(1), fixed metadata
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function unavailableReceipt(event: SignalEvent): Receipt {
  return { event_id: event.id, result_unavailable: true,
    reason: 'The original request did not record a continuation receipt. The view is current; do not resubmit under a new key.' };
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
 * Keep a prior anchor on replay; missing or unavailable original metadata remains explicit.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function resultAnchor(saved: SignalEvent | undefined, recovered: boolean, current: ViewAnchor): ViewAnchor | null {
  if (saved) return saved.payload.result_view ?? null;
  return recovered ? null : current;
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
function saveReceipt(engine: FSMEngine, event: SignalEvent, saved: SignalEvent | undefined, recovered: boolean, receipt: Receipt, anchor: ViewAnchor | null): void {
  if (saved || recovered || !event.idempotency_key) return;
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
 * Deliver the current view after settled signal work: complete, or ledger-anchored after `sinceSeq`. Durable receipt metadata
 * distinguishes an original result from a later view without storing prompts or context.
 * Replays and recovered submissions without a saved receipt serialize the current view but
 * record recovery delivery metadata outside the execution stream, so a duplicate cannot invalidate a still-pending original.
 * `formatReceipt` shapes only the returned receipt; the saved receipt is unchanged.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms bounded view; existing persistence/approval queries additional)
 * - Complexity: O(b + h² + a + w + e), view bytes, ancestry, approvals, bounded delivery window and events after the anchor; P1 indexed recovery accounting additional
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function continuationResponse(engine: FSMEngine, receipt: Receipt, event: SignalEvent, sinceSeq?: number, formatReceipt = unformatted): string {
  if (engine.hasExternalChanges()) throw new Error('RUN_VERSION_CONFLICT: Reload the same run before requesting its current view.');
  const saved = continuationRecord(engine, event);
  const recovered = !saved && receipt.result_unavailable === true;
  // Keyed per submission so competing processes delivering the same result count it once.
  const deliveryKey = event.idempotency_key ? `${event.id}:DELIVERY` : undefined;
  if (recovered) engine.recordRecoveredStateDelivery(`${event.id}:DELIVERY`);
  else if (!saved) engine.recordStateDelivery(deliveryKey);
  const slice = engine.generatePromptSlice({ recordTelemetry: !saved && !recovered });
  const currentSeq = engine.getStateViewSeq();
  const resultView = resultAnchor(saved, recovered, { run_id: engine.getJobId(), seq: currentSeq });
  const enriched = refusalReceipt(receipt);
  saveReceipt(engine, event, saved, recovered, enriched, resultView);
  const original = saved?.payload.receipt ?? enriched;
  const outcome = matchingOutcome(original, resultView, currentSeq);
  return serializeStateResponse({
    receipt: formatReceipt(original),
    replayed: recovered || !!saved,
    result_view: resultView,
    // A replayed or recovered submission is a resume: deliver the complete view.
    view: sinceSeq === undefined || recovered || saved ? createStateView(engine, slice, outcome) : createDeltaView(engine, sinceSeq, slice, outcome, suppliedContext(engine, event)),
  }, slice.metrics!);
}

/**
 * Context the submitting agent supplied with a signal; decisions supply none.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(k + u), declared keys and explicit updates
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function suppliedContext(engine: FSMEngine, event: SignalEvent): Record<string, unknown> {
  return event.type === 'SIGNAL_EMITTED' ? engine.suppliedContextUpdates(event.payload) : {};
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
