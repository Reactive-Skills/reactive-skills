import { z } from 'zod';

/**
 * Signal Event Schema: Immutable envelope for all events in the reactive skill bus
 */
export interface SignalEvent<T = Record<string, any>> {
  id: string;
  event_id?: string;
  seq: number;
  timestamp: string;
  occurred_at?: string;
  type: string;
  event_type?: string;
  source?: string;
  causationId?: string;
  causation_id?: string;
  correlation_id?: string;
  request_id?: string;
  trace_parent?: string;
  skill_id?: string;
  run_id?: string;
  parent_run_id?: string;
  schema_version?: string;
  payload: T;
  state?: string;
}

export interface EventContext {
  skill_id?: string;
  run_id?: string;
  runId?: string;
  correlation_id?: string;
  correlationId?: string;
  request_id?: string;
  requestId?: string;
  trace_parent?: string;
  traceParent?: string;
  parent_run_id?: string;
  parentRunId?: string;
  schema_version?: string;
  schemaVersion?: string;
}

export interface ChildRunSummary {
  child_skill_id: string;
  child_run_id: string;
  outcome: 'completed' | 'failed';
  failed_state?: string;
  error_code?: string;
  summary?: string;
  last_command?: string;
  evidence_ref?: string;
  suggested_action?: string;
}

export interface DecisionRecord {
  choice: string;
  approved?: boolean;
  feedback?: string;
  result?: Record<string, any>;
}

/**
 * Transition Guard definition
 */
export interface TransitionDefinition {
  target: string;
  guard?: string; // JavaScript expression returning boolean, e.g. "event.payload.exit_code != 0"
  guardFunction?: string; // Relative path to JS function file in guards/
  description?: string;
  invoke?: string;
}

export interface StateLifecycleAction {
  emit_signal?: string;
  set_context?: Record<string, any>;
  action?: string;
}

export interface HumanGateDefinition {
  type: 'approval' | 'choice' | 'text' | 'visual_review' | 'form';
  tool?: 'ask_question' | 'lavish' | 'chat' | string;
  prompt?: string;
  options?: string[];
  auto_stop?: boolean;
}

/**
 * State Definition in a Reactive Skill
 */
export interface StateDefinition {
  description?: string;
  prompt_template?: string; // Path to markdown file in states/
  tools?: string[]; // Scoped list of allowed tools in this state
  human_gate?: HumanGateDefinition; // HITL gate configuration
  on_enter?: StateLifecycleAction[];
  on_exit?: StateLifecycleAction[];
  transitions?: Record<string, TransitionDefinition | string>; // SignalName -> Transition or TargetStateName
  substates?: Record<string, StateDefinition>; // Nested HSM states
  initial_substate?: string;
  max_idle_turns?: number; // Max turns before bypass detection triggers (default 2)
  bypass_target?: string; // Target state when bypass is detected (default "BYPASS_DETECTED")
}

/**
 * Deliverable Projection definition (Event-Sourced Read Models)
 */
export interface DeliverableProjection {
  template: string; // Path to Handlebars/Liquid template in templates/
  output: string; // Target path to write (e.g. .docs/summary.md)
  trigger_on?: string[]; // Signal/Event types that re-render this projection (default: all state transitions)
}

/**
 * Reactive Skill Manifest (skill.yaml)
 */
export interface SkillManifest {
  schema_version: string;
  name: string;
  version?: string;
  description: string;
  initial_state: string;
  strict_execution?: boolean;
  context_keys?: string[];
  default_context?: Record<string, any>;
  states: Record<string, StateDefinition>;
  deliverable_projections?: DeliverableProjection[];
}

/**
 * Real-time execution performance metrics
 */
export interface ExecutionMetrics {
  slice_duration_ms?: number;
  slice_tokens_est?: number;
  transition_duration_ms?: number;
  allowed_tools_count?: number;
  [key: string]: any;
}

/**
 * Hydrated prompt slice generated for an active LLM turn
 */
export interface PromptSlice {
  state: string;
  rawPrompt: string;
  formattedXml: string;
  allowedTools: string[];
  context: Record<string, any>;
  exitConditions: string[];
  metrics?: ExecutionMetrics;
}

/**
 * Zod Schema for validation of skill.yaml
 */
export const TransitionSchema = z.union([
  z.string(),
  z.object({
    target: z.string(),
    guard: z.string().optional(),
    guardFunction: z.string().optional(),
    description: z.string().optional(),
    invoke: z.string().optional(),
  }),
]);

export const StateLifecycleActionSchema = z.object({
  emit_signal: z.string().optional(),
  set_context: z.record(z.any()).optional(),
  action: z.string().optional(),
});

export const HumanGateSchema = z.object({
  type: z.enum(['approval', 'choice', 'text', 'visual_review', 'form']),
  tool: z.string().optional(),
  prompt: z.string().optional(),
  options: z.array(z.string()).optional(),
  auto_stop: z.boolean().optional(),
});

export const StateSchema: z.ZodType<StateDefinition> = z.lazy(() =>
  z.object({
    description: z.string().optional(),
    prompt_template: z.string().optional(),
    tools: z.array(z.string()).optional(),
    human_gate: HumanGateSchema.optional(),
    on_enter: z.array(StateLifecycleActionSchema).optional(),
    on_exit: z.array(StateLifecycleActionSchema).optional(),
    transitions: z.record(TransitionSchema).optional(),
    substates: z.record(StateSchema).optional(),
    initial_substate: z.string().optional(),
    max_idle_turns: z.number().int().positive().optional(),
    bypass_target: z.string().optional(),
  })
);

export const SkillManifestSchema = z.object({
  schema_version: z.string(),
  name: z.string(),
  version: z.string().optional(),
  description: z.string(),
  initial_state: z.string(),
  strict_execution: z.boolean().optional(),
  context_keys: z.array(z.string()).optional(),
  default_context: z.record(z.any()).optional(),
  states: z.record(StateSchema),
  deliverable_projections: z.array(z.object({
    template: z.string(),
    output: z.string(),
    trigger_on: z.array(z.string()).optional(),
  })).optional(),
});

export const JobStatusSchema = z.enum(['active', 'completed', 'failed', 'archived']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  skillId: z.string(),
  status: JobStatusSchema,
  currentState: z.string(),
  parentRunId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});

export type JobMetadata = z.infer<typeof JobMetadataSchema>;
