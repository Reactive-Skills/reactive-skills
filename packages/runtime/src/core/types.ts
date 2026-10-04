import { z } from 'zod';

/**
 * Signal Event Schema: Immutable envelope for all events in the reactive skill bus
 */
export interface SignalEvent<T = Record<string, any>> {
  id: string;
  event_id?: string;
  /** Sequence within run_id. */
  seq: number;
  /** Database-wide append order used by projections and diagnostics. */
  ledger_seq?: number;
  timestamp: string;
  occurred_at?: string;
  type: string;
  event_type?: string;
  source?: string;
  causationId?: string;
  causation_id?: string;
  correlation_id?: string;
  request_id?: string;
  idempotency_key?: string;
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
 * Core RSA Judgment Types (Decoupled Ports-and-Adapters Domain Ontology)
 */
export type JudgmentType = 'predicate' | 'categorical' | 'evaluation';

/**
 * Grey-zone band below `min_probability` that routes to `target` instead of `fallback_target`.
 */
export interface JudgmentEscalation {
  min_probability: number;
  target: string;
}

export interface JudgmentDefinition {
  type: JudgmentType;
  criterion: string;
  /**
   * Adapter confidence threshold. For predicates, confidence is `|P(yes) - 0.5| * 2`,
   * so `min_confidence: m` requires `P(yes) >= 0.5 + m / 2`.
   */
  min_confidence?: number;
  /**
   * Probability threshold compared directly with P(yes) for predicates and with the
   * picked label's probability for categorical judgments.
   */
  min_probability?: number;
  escalate?: JudgmentEscalation;
  options?: string[];
  rubric?: string | string[];
  adapter_hint?: string;
  fallback_adapter?: string;
  fallback_target?: string;
  timeout_ms?: number;
}

export interface RuntimeRequirements {
  min_runtime_version?: string;
  required_capabilities?: string[];
}

export interface JudgmentRequest {
  type: JudgmentType;
  criterion: string;
  contextSnapshot: Record<string, any>;
  options?: string[];
  rubric?: string | string[];
}

export type JudgmentThresholdField = 'min_probability' | 'min_confidence';

export interface JudgmentThreshold {
  field: JudgmentThresholdField;
  value: number;
}

/**
 * `unevaluable` marks a judgment no adapter could decide: the model adapter failed and the
 * criterion is not an executable expression (ADR 0011). It refuses without fallback routing.
 */
export type JudgmentBand = 'accept' | 'escalate' | 'reject' | 'unevaluable';

export interface JudgmentResult {
  verdict: boolean | string | number;
  confidence: number;
  /**
   * P(yes) for predicates, or the picked label's probability for categorical judgments.
   */
  probability?: number;
  passed: boolean;
  adapterName: string;
  adapterSelectionReason?: string;
  latencyMs: number;
  error?: string;
  raw?: unknown;
  /** Threshold that decided the result, set by the judgment engine. */
  threshold?: JudgmentThreshold;
  /** Decision band, set by the judgment engine. */
  band?: JudgmentBand;
  /**
   * True when the script adapter decided from the agent's payload (`exit_code`, `success`,
   * `choice`, or `score`) because the criterion is not an executable expression.
   */
  selfReported?: boolean;
}

export interface JudgmentAdapter {
  readonly id: string;
  supports(type: JudgmentType): boolean;
  isAvailable(): Promise<boolean>;
  evaluate(req: JudgmentRequest, evalContext: any): Promise<JudgmentResult>;
}

/**
 * Model Capability Tiers & State Model Contract
 */
export type ModelCapabilityTier = 'decision' | 'fast' | 'balanced' | 'reasoning';

export interface StateModelDefinition {
  tier?: ModelCapabilityTier;
  suggested?: string;
  temperature?: number;
  provider_preference?: Record<string, string>;
}

/**
 * Transition Guard definition
 */
export interface TransitionDefinition {
  target: string;
  guard?: string; // JavaScript expression returning boolean, e.g. "event.payload.exit_code != 0"
  guardFunction?: string; // Relative path to JS function file in guards/
  judgment?: JudgmentDefinition; // Decoupled snap-on judgment evaluation
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
  context_scope?: string[]; // Subset of context_keys relevant to this state for lean delivery
  model?: StateModelDefinition | ModelCapabilityTier; // Semantic capability tier or model specification
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
 * Record of a state visit for delta detection on revisits
 */
export interface StateVisitRecord {
  state: string;
  seq: number;
  context_snapshot: Record<string, any>;
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
  runtime_requirements?: RuntimeRequirements;
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
  scopedContext: Record<string, any>;
  contextDelta: ContextDelta | null;
  visitCount: number;
  exitConditions: string[];
  modelContract?: StateModelDefinition | null;
  metrics?: ExecutionMetrics;
}

/**
 * Delta of context keys that changed since the last visit to this state
 */
export interface ContextDelta {
  is_revisit: boolean;
  previous_visit_seq: number;
  changed_keys: Array<{ key: string; previous: any; current: any }>;
  new_since_last_visit: number;
  context_snapshot: Record<string, any>;
}

/**
 * Zod Schema for validation of skill.yaml
 */
export const JudgmentTypeSchema = z.enum(['predicate', 'categorical', 'evaluation']);

const ProbabilitySchema = z.number().min(0).max(1);

export const JudgmentEscalationSchema = z.object({
  min_probability: ProbabilitySchema,
  target: z.string().min(1),
});

export const JudgmentDefinitionSchema = z.object({
  type: JudgmentTypeSchema,
  criterion: z.string(),
  min_confidence: ProbabilitySchema.optional(),
  min_probability: ProbabilitySchema.optional(),
  escalate: JudgmentEscalationSchema.optional(),
  options: z.array(z.string()).optional(),
  rubric: z.union([z.string(), z.array(z.string()).min(2)]).optional(),
  adapter_hint: z.string().optional(),
  fallback_adapter: z.string().optional(),
  fallback_target: z.string().optional(),
  timeout_ms: z.number().positive().optional(),
}).superRefine((judgment, ctx) => {
  if (judgment.min_probability !== undefined && judgment.min_confidence !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['min_probability'],
      message: 'set either min_probability or min_confidence, not both',
    });
  }
  if (judgment.min_probability !== undefined && judgment.type === 'evaluation') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['min_probability'],
      message: 'min_probability is supported for predicate and categorical judgments',
    });
  }
  if (judgment.type === 'predicate' && judgment.min_probability !== undefined && judgment.min_probability < 0.5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['min_probability'],
      message: 'predicate min_probability must be at least 0.5 so a no verdict cannot pass',
    });
  }
  if (judgment.escalate) {
    if (judgment.min_probability === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['escalate'],
        message: 'escalate requires min_probability',
      });
    } else if (judgment.escalate.min_probability >= judgment.min_probability) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['escalate', 'min_probability'],
        message: 'escalate.min_probability must be lower than min_probability',
      });
    }
  }
});

export const RuntimeRequirementsSchema = z.object({
  min_runtime_version: z.string().trim().min(1).optional(),
  required_capabilities: z.array(z.string().trim().min(1)).min(1).refine(
    (capabilities) => new Set(capabilities).size === capabilities.length,
    { message: 'required_capabilities must contain unique values' }
  ).optional(),
});

export const TransitionSchema = z.union([
  z.string(),
  z.object({
    target: z.string(),
    guard: z.string().optional(),
    guardFunction: z.string().optional(),
    judgment: JudgmentDefinitionSchema.optional(),
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

export const ModelCapabilityTierSchema = z.enum(['decision', 'fast', 'balanced', 'reasoning']);

export const StateModelSchema = z.union([
  ModelCapabilityTierSchema,
  z.object({
    tier: ModelCapabilityTierSchema.optional(),
    suggested: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    provider_preference: z.record(z.string()).optional(),
  }),
]);

export const StateSchema: z.ZodType<StateDefinition> = z.lazy(() =>
  z.object({
    description: z.string().optional(),
    prompt_template: z.string().optional(),
    tools: z.array(z.string()).optional(),
    context_scope: z.array(z.string()).optional(),
    model: StateModelSchema.optional(),
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
  runtime_requirements: RuntimeRequirementsSchema.optional(),
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
  runId: z.string().optional(),
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
