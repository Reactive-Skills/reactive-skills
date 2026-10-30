import path from 'node:path';
import vm from 'node:vm';
import { z } from 'zod';
import { validateContextPath } from './judgment-context.js';
import type { SignalEvent, SkillManifest, StateDefinition, TransitionDefinition } from './types.js';

/** Runtime capability a manifest must require before it may declare `runtime_action` states (experimental). */
export const RUNTIME_ACTIONS_CAPABILITY = 'state.runtime_actions';
export const RUNTIME_ACTION_SOURCE = 'runtime_action';
export const RUNTIME_ACTION_STARTED = 'RUNTIME_ACTION_STARTED';
export const RUNTIME_ACTION_COMPLETED = 'RUNTIME_ACTION_COMPLETED';
/** Bytes of stdout and of stderr kept as ledger evidence; the tail is kept because failures print last. */
export const RUNTIME_OUTPUT_TAIL_BYTES = 2048;
export const MAX_RUNTIME_TIMEOUT_MS = 600_000;
const MAX_SCHEMA_ERRORS = 5;
const EXPRESSION_TIMEOUT_MS = 100;

const literal = z.string().max(4096).refine((value) => !value.includes('{{'), {
  message: 'Runtime action arguments are literal; templates and context values are never interpolated',
});

/** Workspace-relative path: no absolute paths, no `..` segments, no templates. */
const workspacePath = literal.pipe(z.string().min(1)).refine(
  (value) => !path.isAbsolute(value) && !path.win32.isAbsolute(value) && !value.split(/[\\/]/).includes('..'),
  { message: 'Use a workspace-relative path without .. segments' },
);

const outcomes = {
  on_success: z.string().min(1),
  on_failure: z.string().min(1),
  /** Context key that receives the compact result; must be one of the manifest's context_keys. */
  record_as: z.string().min(1).optional(),
};

const CommandActionSchema = z.object({
  kind: z.literal('command'),
  /** Executable name looked up on PATH, or a workspace-relative path; `node` is the runtime's own Node. */
  command: z.string().regex(/^[A-Za-z0-9_.][A-Za-z0-9_.\/-]*$/, 'Use an executable name or relative path without spaces or shell syntax')
    .refine((value) => !value.split('/').includes('..'), { message: 'Use a workspace-relative path without .. segments' }),
  args: z.array(literal).max(64).optional(),
  timeout_ms: z.number().int().min(1).max(MAX_RUNTIME_TIMEOUT_MS),
  cwd: workspacePath.optional(),
  /** Exit status that counts as success. Default `zero`; `nonzero` expects a failing run, such as a red test. */
  expect_exit: z.enum(['zero', 'nonzero']).optional(),
  ...outcomes,
}).strict();

const PathExistsActionSchema = z.object({
  kind: z.literal('path_exists'),
  path: workspacePath,
  type: z.enum(['file', 'directory', 'any']).optional(),
  ...outcomes,
}).strict();

type JsonSchemaNode = {
  type?: JsonType | JsonType[];
  enum?: unknown[];
  const?: unknown;
  required?: string[];
  properties?: Record<string, JsonSchemaNode>;
  additionalProperties?: boolean;
  items?: JsonSchemaNode;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
};
type JsonType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
const JsonTypeSchema = z.enum(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);
const count = z.number().int().nonnegative();

/** The supported JSON Schema subset; unknown keywords are rejected so no declared rule goes unenforced. */
const JsonSchemaNodeSchema: z.ZodType<JsonSchemaNode> = z.lazy(() => z.object({
  type: z.union([JsonTypeSchema, z.array(JsonTypeSchema).min(1)]).optional(),
  enum: z.array(z.unknown()).min(1).optional(),
  const: z.unknown().optional(),
  required: z.array(z.string()).optional(),
  properties: z.record(JsonSchemaNodeSchema).optional(),
  additionalProperties: z.boolean().optional(),
  items: JsonSchemaNodeSchema.optional(),
  minItems: count.optional(),
  maxItems: count.optional(),
  minimum: z.number().finite().optional(),
  maximum: z.number().finite().optional(),
  minLength: count.optional(),
  maxLength: count.optional(),
}).strict());

const JsonSchemaActionSchema = z.object({
  kind: z.literal('json_schema'),
  /** Dot-separated path into recorded context, such as `thresholds` or `report.totals`. */
  value: z.string().superRefine((value, ctx) => {
    const problem = validateContextPath(value);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  }),
  schema: JsonSchemaNodeSchema,
  ...outcomes,
}).strict();

const ExpressionActionSchema = z.object({
  kind: z.literal('expression'),
  /** Pure expression over `context`; success only when it evaluates to `true`. */
  expression: z.string().min(1).max(2000),
  ...outcomes,
}).strict();

export const RuntimeActionSchema = z.discriminatedUnion('kind', [
  CommandActionSchema,
  PathExistsActionSchema,
  JsonSchemaActionSchema,
  ExpressionActionSchema,
]);

export type RuntimeAction = z.infer<typeof RuntimeActionSchema>;
export type RuntimeActionKind = RuntimeAction['kind'];
export type RuntimeOutcome = 'success' | 'failure';

/** What one execution observed; kept whole in the ledger's RUNTIME_ACTION_COMPLETED event. */
export interface RuntimeActionObservation {
  duration_ms: number;
  exit_code?: number | null;
  signal?: string | null;
  timed_out?: boolean;
  error?: string;
  stdout_tail?: string;
  stderr_tail?: string;
  exists?: boolean;
  entry_type?: 'file' | 'directory' | 'other' | null;
  valid?: boolean;
  errors?: string[];
  value?: unknown;
}

/** Compact result recorded in context and in the outcome signal; tails stay in the ledger event only. */
export interface RuntimeActionRecord {
  kind: RuntimeActionKind;
  outcome: RuntimeOutcome;
  attempt: number;
  evidence_seq: number;
  exit_code?: number | null;
  timed_out?: boolean;
  error?: string;
  exists?: boolean;
  valid?: boolean;
  errors?: string[];
  value?: unknown;
}

/** One runtime-executed state, reported with the signal result that ran it. */
export interface RuntimeActionSummary {
  state: string;
  kind: RuntimeActionKind;
  outcome: RuntimeOutcome;
  signal: string;
  attempt: number;
  duration_ms: number;
  transitioned: boolean;
  newState: string;
  /** Set when a result recorded before an interruption was reused instead of running the action again. */
  reused_result?: true;
}

/** Ledger facts about the current visit of a runtime state. */
export interface RuntimeActionWindow {
  attempts: number;
  completed?: SignalEvent;
}

/**
 * Decide success or failure from one observation. Pure: no I/O, clock or randomness.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(1)
 * - Cyclomatic Complexity (CC): 8
 * - Branch Coverage: target 100% (runtime-actions decider tests)
 * - CRAP Score: target <= 8.0
 */
export function decideRuntimeOutcome(action: RuntimeAction, observation: RuntimeActionObservation): RuntimeOutcome {
  if (observation.error !== undefined || observation.timed_out) return 'failure';
  switch (action.kind) {
    case 'command': {
      if (typeof observation.exit_code !== 'number') return 'failure';
      const passed = action.expect_exit === 'nonzero' ? observation.exit_code !== 0 : observation.exit_code === 0;
      return passed ? 'success' : 'failure';
    }
    case 'path_exists':
      return observation.exists === true && (!action.type || action.type === 'any' || observation.entry_type === action.type) ? 'success' : 'failure';
    case 'json_schema':
      return observation.valid === true ? 'success' : 'failure';
    case 'expression':
      return observation.value === true ? 'success' : 'failure';
  }
}

/**
 * The compact record a completed event contributes to context and to the outcome signal.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(e), bounded schema error list
 * - Cyclomatic Complexity (CC): 2
 * - Branch Coverage: target 100%
 * - CRAP Score: target <= 2.0
 */
export function runtimeActionRecord(completed: SignalEvent): RuntimeActionRecord {
  const { kind, outcome, attempt, observation } = completed.payload as { kind: RuntimeActionKind; outcome: RuntimeOutcome; attempt: number; observation: RuntimeActionObservation };
  const { duration_ms: _duration, stdout_tail: _stdout, stderr_tail: _stderr, signal: _signal, entry_type: _entry, ...facts } = observation;
  return { kind, outcome, attempt, evidence_seq: completed.seq, ...facts };
}

/**
 * Fold the events of the current state visit: how many attempts started, and a completed result
 * that has not yet been committed by its outcome transition. Pure; the caller supplies the window
 * since the snapshot written when the state was entered.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(w), events since the entering snapshot
 * - Cyclomatic Complexity (CC): 4
 * - Branch Coverage: target 100% (four interruption points in runtime-actions recovery tests)
 * - CRAP Score: target <= 4.0
 */
export function foldRuntimeActionWindow(events: SignalEvent[], state: string): RuntimeActionWindow {
  const window: RuntimeActionWindow = { attempts: 0 };
  for (const event of events) {
    if (event.payload?.state !== state) continue;
    if (event.type === RUNTIME_ACTION_STARTED) window.attempts++;
    else if (event.type === RUNTIME_ACTION_COMPLETED) window.completed = event;
  }
  return window;
}

function readContextPath(context: Record<string, unknown>, dotted: string): unknown {
  let current: unknown = context;
  for (const segment of dotted.split('.')) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function jsonType(value: unknown): JsonType | 'undefined' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value as JsonType | 'undefined';
}

/**
 * Validate a value against the supported JSON Schema subset, collecting at most five errors.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms for values under 64 KiB); Complexity: O(v + s), value nodes and schema nodes
 * - Cyclomatic Complexity (CC): 14
 * - Branch Coverage: target >= 90% (runtime-actions schema tests)
 * - CRAP Score: target <= 15.0
 */
export function validateJsonSchemaSubset(schema: JsonSchemaNode, value: unknown, at = '$', errors: string[] = []): string[] {
  if (errors.length >= MAX_SCHEMA_ERRORS) return errors;
  const actual = jsonType(value);
  const types = schema.type === undefined ? undefined : ([] as JsonType[]).concat(schema.type);
  if (types && !types.some((type) => type === actual || (type === 'number' && actual === 'integer'))) {
    errors.push(`${at}: expected ${types.join(' or ')}, got ${actual}`);
    return errors;
  }
  if (schema.enum && !schema.enum.some((option) => JSON.stringify(option) === JSON.stringify(value))) errors.push(`${at}: not one of the allowed values`);
  if (Object.hasOwn(schema, 'const') && JSON.stringify(schema.const) !== JSON.stringify(value)) errors.push(`${at}: does not equal the constant`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: above maximum ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${at}: longer than ${schema.maxLength}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, index) => validateJsonSchemaSubset(schema.items!, item, `${at}[${index}]`, errors));
  }
  if (actual === 'object') validateObject(schema, value as Record<string, unknown>, at, errors);
  return errors.slice(0, MAX_SCHEMA_ERRORS);
}

function validateObject(schema: JsonSchemaNode, value: Record<string, unknown>, at: string, errors: string[]): void {
  for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${at}.${key}: required`);
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    if (Object.hasOwn(value, key)) validateJsonSchemaSubset(child, value[key], `${at}.${key}`, errors);
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties ?? {}, key)) errors.push(`${at}.${key}: not allowed`);
  }
}

/**
 * Evaluate the pure action kinds over a copy of recorded context. No filesystem, process or network access.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms; expressions are cut off at 100ms); Complexity: O(c + v), context copy and validated value
 * - Cyclomatic Complexity (CC): 4
 * - Branch Coverage: target 100%
 * - CRAP Score: target <= 4.0
 */
export function evaluatePureRuntimeAction(
  action: Extract<RuntimeAction, { kind: 'json_schema' | 'expression' }>,
  context: Record<string, unknown>,
): Omit<RuntimeActionObservation, 'duration_ms'> {
  const copy = JSON.parse(JSON.stringify(context ?? {}));
  if (action.kind === 'json_schema') {
    const errors = validateJsonSchemaSubset(action.schema, readContextPath(copy, action.value));
    return { valid: errors.length === 0, ...(errors.length ? { errors } : {}) };
  }
  try {
    const sandbox = vm.createContext({ context: copy, Math, Number, String, Boolean, Array, Object, JSON }, { codeGeneration: { strings: false, wasm: false } });
    const value = new vm.Script(`"use strict"; (${action.expression})`).runInContext(sandbox, { timeout: EXPRESSION_TIMEOUT_MS });
    return { value: typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || value === null ? value : String(value) };
  } catch (error) {
    return { error: `Expression failed: ${(error as Error).message}` };
  }
}

type Issue = { path: (string | number)[]; message: string };

function transitionOf(state: StateDefinition, signal: string): TransitionDefinition | undefined {
  const raw = state.transitions?.[signal];
  return typeof raw === 'string' ? { target: raw } : raw;
}

function resolvesTo(manifest: SkillManifest, target: string): StateDefinition | undefined {
  let node: StateDefinition | undefined = { substates: manifest.states };
  for (const segment of target.split('.')) node = node?.substates?.[segment];
  return node;
}

/** The leaf a transition target enters, following initial substates like the engine does. */
function enteredLeaf(manifest: SkillManifest, target: string): string {
  const segments = target.split('.');
  let node = resolvesTo(manifest, target);
  while (node?.initial_substate && node.substates?.[node.initial_substate]) {
    segments.push(node.initial_substate);
    node = node.substates[node.initial_substate];
  }
  return segments.join('.');
}

/**
 * Check one runtime state: leaf only, no human gate or prompt, outcome transitions declared on the
 * state itself without guards, judgments, contracts or child invocations, and resolvable targets.
 * # Performance & Risk Budget
 * - Tier: P2 manifest validation (< 100ms); Complexity: O(t + d), outcome transitions and target depth
 * - Cyclomatic Complexity (CC): 10
 * - Branch Coverage: target >= 90% (runtime-actions validation tests)
 * - CRAP Score: target <= 12.0
 */
function runtimeStateIssues(manifest: SkillManifest, state: StateDefinition, at: (string | number)[]): Issue[] {
  const action = state.runtime_action!;
  const issues: Issue[] = [];
  const here = [...at, 'runtime_action'];
  if (state.substates) issues.push({ path: here, message: 'A runtime_action state must be a leaf state' });
  if (state.human_gate) issues.push({ path: here, message: 'A runtime_action state cannot declare a human_gate' });
  if (state.prompt_template) issues.push({ path: here, message: 'A runtime_action state is never delivered to the model; remove prompt_template' });
  if (action.record_as && !(manifest.context_keys ?? []).includes(action.record_as)) {
    issues.push({ path: [...here, 'record_as'], message: `record_as '${action.record_as}' must be listed in context_keys` });
  }
  for (const field of ['on_success', 'on_failure'] as const) {
    const transition = transitionOf(state, action[field]);
    if (!transition) {
      issues.push({ path: [...here, field], message: `${field} '${action[field]}' must be a transition declared on this state` });
    } else if (transition.guard || transition.guardFunction || transition.judgment || transition.payload_contract || transition.invoke) {
      issues.push({ path: [...here, field], message: `The ${field} transition is decided by the runtime action; remove its guard, judgment, payload_contract and invoke` });
    } else if (!resolvesTo(manifest, transition.target)) {
      issues.push({ path: [...here, field], message: `${field} target '${transition.target}' is not a declared state` });
    }
  }
  return issues;
}

/**
 * Manifest-level checks: opt-in capability, per-state rules, a non-runtime initial state, and no
 * cycle made only of runtime states (a chain always reaches a model-visible state).
 * # Performance & Risk Budget
 * - Tier: P2 manifest validation (< 100ms); Complexity: O(s + t), states and transitions
 * - Cyclomatic Complexity (CC): 10
 * - Branch Coverage: target >= 90% (runtime-actions validation tests)
 * - CRAP Score: target <= 12.0
 */
export function runtimeActionManifestIssues(manifest: SkillManifest): Issue[] {
  const runtimeStates = new Map<string, StateDefinition>();
  const issues: Issue[] = [];
  const pending: Array<[string, StateDefinition, (string | number)[]]> = Object.entries(manifest.states).map(([name, state]) => [name, state, ['states', name]]);
  while (pending.length) {
    const [name, state, at] = pending.pop()!;
    if (state.runtime_action) {
      runtimeStates.set(name, state);
      issues.push(...runtimeStateIssues(manifest, state, at));
    }
    for (const [child, sub] of Object.entries(state.substates ?? {})) pending.push([`${name}.${child}`, sub, [...at, 'substates', child]]);
  }
  if (runtimeStates.size === 0) return issues;
  if (!manifest.runtime_requirements?.required_capabilities?.includes(RUNTIME_ACTIONS_CAPABILITY)) {
    issues.unshift({ path: ['runtime_requirements', 'required_capabilities'], message: `runtime_action states require ${RUNTIME_ACTIONS_CAPABILITY}` });
  }
  if (runtimeStates.has(enteredLeaf(manifest, manifest.initial_state))) {
    issues.push({ path: ['initial_state'], message: 'The initial state cannot be a runtime_action state' });
  }
  const cycle = runtimeOnlyCycle(manifest, runtimeStates);
  if (cycle) issues.push({ path: ['states'], message: `Runtime states form a cycle with no model-visible state: ${cycle.join(' -> ')}` });
  return issues;
}

/**
 * Depth-first search for a cycle among runtime states through their outcome targets.
 * # Performance & Risk Budget
 * - Tier: P2 manifest validation (< 100ms); Complexity: O(r), runtime states (two edges each)
 * - Cyclomatic Complexity (CC): 6
 * - Branch Coverage: target >= 90%
 * - CRAP Score: target <= 8.0
 */
function runtimeOnlyCycle(manifest: SkillManifest, runtimeStates: Map<string, StateDefinition>): string[] | undefined {
  const done = new Set<string>();
  const visit = (name: string, trail: string[]): string[] | undefined => {
    if (trail.includes(name)) return [...trail.slice(trail.indexOf(name)), name];
    if (done.has(name) || !runtimeStates.has(name)) return undefined;
    const state = runtimeStates.get(name)!;
    for (const field of ['on_success', 'on_failure'] as const) {
      const target = transitionOf(state, state.runtime_action![field])?.target;
      const found = target ? visit(enteredLeaf(manifest, target), [...trail, name]) : undefined;
      if (found) return found;
    }
    done.add(name);
    return undefined;
  };
  for (const name of runtimeStates.keys()) {
    const found = visit(name, []);
    if (found) return found;
  }
  return undefined;
}
