import type { FSMEngine } from '../core/fsm-engine.js';
import type { SignalEvent } from '../core/types.js';
import { CONTINUATION_EVENT, continuationRecord, submissionEvent, unavailableReceipt, type Receipt, type SignalHandlingResult } from './continuation-response.js';

export interface HumanResponse {
  choice: string;
  approved: boolean;
  feedback?: string;
}

/**
 * Keep the existing response-to-signal precedence, including the approval default.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(b), choice bytes
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function responseSignal({ choice, approved }: HumanResponse): string {
  if (approved || /approve|yes|accept|confirm|proceed/i.test(choice)) return 'USER_APPROVED';
  return 'USER_REJECTED';
}

const signalKey = (decision: SignalEvent, signal: string) => `${decision.id}:${signal}`;

/**
 * Dispatch the human signal batch before delivering any state. Derived per-decision
 * keys let a retry resume a partially dispatched keyed response without re-emission.
 * # Performance & Risk Budget
 * - Tier: P2 orchestration (<100ms local work; adapters additional)
 * - Complexity: O(s), at most two signals plus existing transition work
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
async function dispatchResponse(engine: FSMEngine, data: HumanResponse, signals: string[], decision: SignalEvent | undefined, keyed: boolean) {
  const results: SignalHandlingResult[] = [];
  for (const signal of signals) {
    results.push(await engine.handleSignal(signal, data, {
      source: 'human_ingress',
      causationId: keyed ? decision?.id : undefined,
      idempotencyKey: keyed && decision ? signalKey(decision, signal) : undefined,
    }));
  }
  return results;
}

/**
 * Retain aggregate transition/projection results and the last meaningful decision.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(s + p), bounded signals and returned projection paths
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function responseReceipt(engine: FSMEngine, signals: string[], results: SignalHandlingResult[], withOutcome: boolean): Receipt {
  const outcome = [...results].reverse().find(result => result.transitioned || result.refusalReason) ?? results.at(-1)!;
  const decision = results.find(result => result.warning) ?? outcome;
  return {
    unpaused: true,
    transitioned: results.some(result => result.transitioned),
    currentState: engine.getCurrentState(),
    projectionsWritten: results.flatMap(result => result.deliverablesWritten),
    signalsEmitted: signals,
    ...(withOutcome ? {
      refusalReason: outcome.refusalReason,
      judgmentBasis: decision.judgmentBasis,
      warning: decision.warning,
    } : {}),
  };
}

/**
 * Preserve the legacy empty-choice decision behavior, with a durable identity for keyed responses.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms)
 * - Complexity: O(b), response metadata bytes
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function responseDecision(engine: FSMEngine, data: HumanResponse, key?: string, existing?: SignalEvent | null) {
  if (existing) return existing;
  if (!data.choice && !data.feedback && !key) return undefined;
  return engine.getEventStore().append('DECISION_RECORDED', data, { source: 'human_ingress', idempotencyKey: key });
}

/**
 * Record one human ingress decision, preserving stored data on keyed retry.
 * A retry that replays an already dispatched signal reports its original outcome as unavailable.
 * Judgment approvals remain restricted to the existing interactive CLI path.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms local work; existing guards/adapters additional)
 * - Complexity: O(k + b), indexed request children and response bytes, plus existing dispatch work
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
export async function submitHumanResponse(engine: FSMEngine, input: HumanResponse, key?: string, withOutcome = false) {
  const store = engine.getEventStore();
  const existing = submissionEvent(engine, key, 'DECISION_RECORDED');
  const saved = continuationRecord(engine, existing);
  if (saved && existing) return { receipt: saved.payload.receipt as Receipt, event: existing };
  if (engine.hasExternalChanges()) throw new Error('RUN_VERSION_CONFLICT: Reload the run before responding.');
  const data = (existing?.payload ?? input) as HumanResponse;
  // Empty choices historically recorded no decision. The first dispatched signal remains its identity.
  const decision = responseDecision(engine, data, key, existing);
  if (data.feedback) engine.updateContext({ user_feedback: data.feedback });
  if (data.choice) engine.updateContext({ user_choice: data.choice });
  const signals = ['USER_RESPONSE', responseSignal(data)];
  const resumed = !!existing && signals.some(signal => store.getEventByIdempotencyKey(signalKey(existing, signal)));
  const results = await dispatchResponse(engine, data, signals, decision, !!key);
  const event = decision ?? results[0].event;
  const receipt = resumed ? unavailableReceipt(event) : responseReceipt(engine, signals, results, withOutcome);
  if (key && !withOutcome) {
    store.append(CONTINUATION_EVENT, { receipt, result_view: null }, { causationId: event.id, source: 'mcp', state: engine.getCurrentState() });
  }
  return { receipt, event };
}
