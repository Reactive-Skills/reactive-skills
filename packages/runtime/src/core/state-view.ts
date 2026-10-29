import { payloadRequirements } from './payload-contract.js';
import type { FSMEngine } from './fsm-engine.js';
import type { HumanGateDefinition, StateModelDefinition, TransitionDefinition } from './types.js';

export type StateViewOutput = 'compact-v1' | 'xml-v1';
export interface StateViewOutcome {
  refusalReason?: string;
  judgmentBasis?: 'self_reported' | 'human';
  warning?: string;
}

/** Complete recovery-safe instructions; telemetry and revisit deltas remain in legacy inspection. */
export interface StateView {
  format: 'compact-v1';
  skill: string;
  run_id: string;
  seq: number;
  state: string;
  prompt: string;
  context: Record<string, unknown>;
  tools: string[];
  contracts: string[];
  policy: string;
  strict?: { mode: 'enforced'; idle_limit: number; turns_since_signal: number; refetch_allowance: number };
  approval_gate?: { requests: Array<{ id: string; state: string; signal: string; criterion: string; reason?: string }>; instruction: string };
  human_gate?: HumanGateDefinition & { instruction: string };
  model?: StateModelDefinition;
  refusal?: string;
  judgment_basis?: 'self_reported' | 'human';
  warning?: string;
}

export const STATE_VIEW_POLICY = 'Emit after work. Stop at human gates. Re-fetch the same run (MCP job_id or AXI --job set to run_id) after resume or compaction, without emitting a signal or recreating approvals; in strict mode up to refetch_allowance repeat fetches of the same view are not counted, later repeats count toward idle_limit. Use the listed tools; tool-call enforcement requires a host adapter.';

/**
 * Retain exact conditions and module references without repeating transition prose.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms)
 * - Complexity: O(b), contract bytes
 * - Cyclomatic Complexity (CC): 5 (measured with ESLint)
 * - Branch Coverage: 100% (measured with V8 acceptance tests)
 * - CRAP Score: 5.0 (Threshold <= 10)
 * - Measured: 0.270909ms p95 for the containing complete view assembly; Node 22.23.3/Linux, 100 samples after 10 warmups.
 */
function compactContract(state: string, signal: string, transition: TransitionDefinition | string): string {
  const definition = typeof transition === 'string' ? { target: transition } : transition;
  const fields = [`${state}: ${signal} -> ${definition.target}`, ...payloadRequirements(definition)];
  if (definition.judgment) fields.push(`judgment: ${JSON.stringify(definition.judgment)}`);
  if (definition.guard_message) fields.push(`on refusal: ${definition.guard_message}`);
  if (definition.invoke) fields.push(`invoke: ${definition.invoke}`);
  return fields.join('; ');
}

/**
 * Build one complete state view using the existing template and context scope rules.
 * Ordered leaf-to-root contracts deliberately retain same-named signals.
 * A supplied outcome carries the refusal/decision warning from that signal receipt.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms for bounded slices; excludes existing slice generation)
 * - Complexity: O(h² + b + a + w), hierarchy, contract bytes, existing approval-request/decision queries and bounded trailing-event window
 * - Cyclomatic Complexity (CC): target <= 8
 * - Branch Coverage: target >= 90%
 * - CRAP Score: target <= 10.0
 */
export function createStateView(engine: FSMEngine, slice = engine.generatePromptSlice(), outcome: StateViewOutcome = {}): StateView {
  const activePath = engine.getActiveStatePath();
  const contracts: string[] = [];
  for (let depth = activePath.length; depth >= 1; depth--) {
    const statePath = activePath.slice(0, depth);
    const definition = engine.getStateDefinition(statePath);
    for (const [signal, transition] of Object.entries(definition?.transitions ?? {})) {
      contracts.push(compactContract(statePath.join('.'), signal, transition));
    }
  }
  return {
    format: 'compact-v1',
    skill: engine.getManifest().name,
    run_id: engine.getJobId() || 'default',
    seq: engine.getStateViewSeq(),
    state: slice.state,
    prompt: slice.rawPrompt,
    context: slice.scopedContext,
    tools: slice.allowedTools,
    contracts,
    policy: STATE_VIEW_POLICY,
    ...stateMetadata(engine, slice.modelContract),
    ...outcomeMetadata({ refusalReason: engine.getLastRefusalReason(), ...outcome }),
  };
}

/**
 * Include only active gate, strict and model metadata.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms for bounded approval history)
 * - Complexity: O(a + h), existing approval queries and leaf lookup
 * - Cyclomatic Complexity (CC): target <= 8
 * - Branch Coverage: target >= 90%
 * - CRAP Score: target <= 10.0
 */
function stateMetadata(engine: FSMEngine, model?: StateModelDefinition | null): Partial<StateView> {
  const leaf = engine.getStateDefinition(engine.getActiveStatePath())!;
  const approvals = engine.getPendingApprovals().map(({ id, state, signal, criterion, reason }) => ({ id, state, signal, criterion, reason }));
  return {
    ...(approvals.length ? { approval_gate: { requests: approvals, instruction: `Stop and ask a person to run reactive-skills-axi approve ${engine.cliSkillReference()} --job ${engine.getJobId() || 'default'} in their own terminal.` } } : {}),
    ...(engine.isStrictExecution() ? { strict: {
      mode: 'enforced' as const,
      idle_limit: leaf.max_idle_turns ?? 2,
      turns_since_signal: engine.getTurnsSinceLastSignal(),
      refetch_allowance: leaf.max_view_refetches ?? 2,
    } } : {}),
    ...(leaf.human_gate ? { human_gate: {
      ...leaf.human_gate,
      tool: leaf.human_gate.tool || 'ask_question',
      instruction: 'Collect the human decision using the specified tool, then STOP calling tools to conclude your turn.',
    } } : {}),
    ...(model ? { model } : {}),
  };
}

/**
 * Preserve receipt meaning without repeating unrelated state data.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms)
 * - Complexity: O(1), fixed metadata fields
 * - Cyclomatic Complexity (CC): target <= 8
 * - Branch Coverage: target >= 90%
 * - CRAP Score: target <= 10.0
 */
function outcomeMetadata(outcome: StateViewOutcome): Partial<StateView> {
  return {
    ...(outcome.refusalReason ? { refusal: outcome.refusalReason } : {}),
    ...(outcome.judgmentBasis ? { judgment_basis: outcome.judgmentBasis } : {}),
    ...(outcome.warning ? { warning: outcome.warning } : {}),
  };
}

/**
 * Serialize the same view as compact JSON or development XML with escaped text.
 * XML object/array fields contain JSON; no fields or required values are truncated.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms for bounded views)
 * - Complexity: O(b), serialized view bytes
 * - Cyclomatic Complexity (CC): target <= 8
 * - Branch Coverage: target >= 90%
 * - CRAP Score: target <= 10.0
 */
export function renderStateView(view: StateView, output: StateViewOutput = 'compact-v1'): string {
  if (output === 'compact-v1') return JSON.stringify(view);
  const fields = Object.entries(view).map(([key, value]) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<${key}>${escaped}</${key}>`;
  });
  return `<reactive_state_view>\n${fields.join('\n')}\n</reactive_state_view>`;
}
