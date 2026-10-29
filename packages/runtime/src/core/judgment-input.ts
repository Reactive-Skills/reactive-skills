import { z } from 'zod';
import { createHash } from 'node:crypto';
import { scopeJudgmentContext, validateContextPath } from './judgment-context.js';
import type { GuardEvaluationContext } from './guard-evaluator.js';
import type { JudgmentDefinition } from './types.js';

export const JUDGMENT_PAYLOAD_SELECTION_CAPABILITY = 'judgment.payload_selection';

const ContextPathSchema = z.string().superRefine((path, ctx) => {
  const problem = validateContextPath(path);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});

/** Tier: P0 (< 5ms); Complexity: O(d) path depth; CRAP target <= 10 (CC <= 8, branch coverage >= 90%). */
export function validatePayloadPath(path: string): string | undefined {
  const problem = validateContextPath(path);
  if (problem) return problem;
  for (const segment of path.split('.')) {
    if (/^\d+$/.test(segment) && (String(Number(segment)) !== segment || Number(segment) > 10_000)) {
      return `payload path '${path}' requires canonical numeric indices from 0 to 10000`;
    }
  }
  return undefined;
}

const PayloadPathSchema = z.string().superRefine((path, ctx) => {
  const problem = validatePayloadPath(path);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});

export const JudgmentInputOptionsSchema = z.object({
  payload_paths: z.array(PayloadPathSchema).optional(),
  required_context_paths: z.array(ContextPathSchema).optional(),
  precondition: z.object({
    payload_schema: z.record(PayloadPathSchema, z.object({
      type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'null']),
      const: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]).optional(),
    }).strict()),
  }).strict().optional(),
});

export type JudgmentInputOptions = z.infer<typeof JudgmentInputOptionsSchema>;
const InputDeclarationSchema = JudgmentInputOptionsSchema.extend({
  context_paths: z.array(ContextPathSchema).optional(), include_payload: z.boolean().optional(),
});

export interface JudgmentInputInspection {
  adapter: string;
  destinationClass: 'local' | 'remote' | 'adapter_defined' | 'runtime_selected';
  fallbackAdapter?: string;
  fallbackDestinationClass?: JudgmentInputInspection['destinationClass'];
  /** Undefined means all context; selected context retains flat dot-path keys. */
  contextPaths?: string[];
  /** Undefined means all payload when included; [] means an empty payload object. */
  payloadPaths?: string[];
  includePayload: boolean;
  fullEvent: boolean;
  missingRequired: string[];
  errors: string[];
  preconditionPassed?: boolean;
  /** UTF-8 JSON bytes of candidate state, excluding adapter questions, SDK framing and credentials. */
  byteCount: number;
}

/** Tier: P0 (< 5ms); Complexity: O(1); CRAP target <= 10 (CC <= 8, branch coverage >= 90%). */
export function usesJudgmentInputOptions(judgment: JudgmentDefinition): boolean {
  return judgment.payload_paths !== undefined || judgment.required_context_paths !== undefined || judgment.precondition !== undefined;
}

/** Tier: P1 (< 25ms); Complexity: O(p² + p*d) paths/depth; CRAP target <= 15 (CC <= 12, branch coverage >= 80%). */
export function judgmentInputDeclarationErrors(judgment: JudgmentDefinition): string[] {
  const parsed = InputDeclarationSchema.safeParse(judgment);
  if (!parsed.success) return parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
  const errors: string[] = [];
  if (judgment.payload_paths !== undefined && judgment.include_payload === false) {
    errors.push('payload_paths requires include_payload to be true or omitted');
  }
  for (const path of judgment.required_context_paths ?? []) {
    if (judgment.context_paths !== undefined && !judgment.context_paths.some(selected => path === selected || path.startsWith(`${selected}.`))) {
      errors.push(`required_context_paths '${path}' is outside context_paths`);
    }
  }
  return errors;
}

/** Tier: P0 (< 5ms); Complexity: O(d); CRAP target <= 10 (CC <= 8, branch coverage >= 90%). */
function readPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Tier: P0 (< 5ms); Complexity: O(d); CRAP target <= 10 (CC <= 8, branch coverage >= 90%). */
function assignPath(target: Record<string, unknown>, source: unknown, path: string, value: unknown): void {
  const segments = path.split('.');
  let output = target;
  let original = source;
  for (const segment of segments.slice(0, -1)) {
    original = (original as Record<string, unknown>)[segment];
    if (!Object.hasOwn(output, segment)) output[segment] = Array.isArray(original) ? [] : {};
    output = output[segment] as Record<string, unknown>;
  }
  output[segments.at(-1)!] = value;
}

/** Tier: P1 (< 25ms); Complexity: O(p² + p*d); CRAP target <= 15 (CC <= 12, branch coverage >= 80%). */
function projectPayload(payload: unknown, paths: string[]): { value: Record<string, unknown>; missing: string[] } {
  const value: Record<string, unknown> = {};
  const missing: string[] = [];
  // Parents subsume children; shortest paths first avoids mutating an aliased source subtree.
  const selected = [...new Set(paths)].sort((a, b) => a.length - b.length);
  const assigned: string[] = [];
  for (const path of selected) {
    const entry = readPath(payload, path);
    if (entry === undefined) { missing.push(`payload.${path}`); continue; }
    if (assigned.some(parent => path.startsWith(`${parent}.`))) continue;
    assignPath(value, payload, path, entry);
    assigned.push(path);
  }
  return { value, missing };
}

/** Tier: P0 (< 5ms); Complexity: O(1); CRAP target <= 10 (CC <= 8, branch coverage >= 90%). */
function valueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'nonfinite';
  return typeof value;
}

/** Tier: P0 (< 5ms); Complexity: O(p*d); CRAP target <= 10 (CC <= 8, branch coverage >= 90%). */
function preconditionErrors(judgment: JudgmentDefinition, payload: unknown): string[] {
  const errors: string[] = [];
  for (const [path, rule] of Object.entries(judgment.precondition?.payload_schema ?? {})) {
    const value = readPath(payload, path);
    if (valueType(value) !== rule.type || (Object.hasOwn(rule, 'const') && value !== rule.const)) {
      errors.push(`precondition refused payload.${path}: expected ${rule.type}${Object.hasOwn(rule, 'const') ? ' with the declared constant' : ''}`);
    }
  }
  return errors;
}

/** Tier: P0 (< 5ms); Complexity: O(1); CRAP target <= 10 (CC <= 8, branch coverage >= 90%). */
function destinationClass(adapter?: string): JudgmentInputInspection['destinationClass'] {
  if (!adapter) return 'runtime_selected';
  if (adapter === 'script') return 'local';
  if (adapter === 'jev') return 'remote';
  return 'adapter_defined';
}

/**
 * Prepares candidate state without I/O or adapter invocation. Metadata never contains evidence values.
 * Tier: P1 (< 25ms); Complexity: O(p² + p*d + b), paths p, depth d, selected bytes b.
 * CRAP target <= 15 (CC <= 12 per helper, branch coverage >= 80%); no ledger scans or result cache.
 */
export function prepareJudgmentInput(judgment: JudgmentDefinition, evaluation: GuardEvaluationContext) {
  const inspection: JudgmentInputInspection = {
    adapter: judgment.adapter_hint ?? 'automatic', destinationClass: destinationClass(judgment.adapter_hint),
    ...(judgment.fallback_adapter ? { fallbackAdapter: judgment.fallback_adapter, fallbackDestinationClass: destinationClass(judgment.fallback_adapter) } : {}),
    contextPaths: judgment.context_paths, payloadPaths: judgment.payload_paths,
    includePayload: judgment.include_payload !== false,
    fullEvent: judgment.include_payload !== false && judgment.payload_paths === undefined,
    missingRequired: [], errors: judgmentInputDeclarationErrors(judgment), byteCount: 0,
  };
  if (inspection.errors.length) return { inspection };
  const context = judgment.context_paths === undefined ? evaluation.context
    : scopeJudgmentContext(evaluation.context, judgment.context_paths).context;
  const payload = judgment.payload_paths === undefined ? { value: evaluation.event.payload, missing: [] }
    : projectPayload(evaluation.event.payload, judgment.payload_paths);
  inspection.missingRequired = [...payload.missing, ...(judgment.required_context_paths ?? [])
    .filter(path => readPath(evaluation.context, path) === undefined).map(path => `context.${path}`)];
  inspection.errors.push(...inspection.missingRequired.map(path => `Missing required judgment input: ${path}`));
  const failures = preconditionErrors(judgment, evaluation.event.payload);
  if (judgment.precondition) inspection.preconditionPassed = failures.length === 0;
  inspection.errors.push(...failures);
  const state = {
    ...(inspection.includePayload ? { event: payload.value ?? {} } : {}),
    context: context ?? {}, currentState: evaluation.currentState,
  };
  try {
    const serialized = JSON.stringify(state);
    inspection.byteCount = Buffer.byteLength(serialized, 'utf8');
    // One owned copy keeps adapter mutation from changing recorded context or signal data.
    return { inspection, state: JSON.parse(serialized) as typeof state };
  } catch {
    inspection.errors.push('Judgment input must be JSON-serializable');
    return { inspection };
  }
}

/**
 * Returns a content-free preflight view, without contacting or configuring an adapter.
 * Tier: P1 (< 25ms); Complexity: O(p² + p*d + b); CRAP target <= 15 (CC <= 12, branch coverage >= 80%).
 */
export function inspectJudgmentInput(judgment: JudgmentDefinition, evaluation: GuardEvaluationContext): JudgmentInputInspection {
  return prepareJudgmentInput(judgment, evaluation).inspection;
}

/**
 * Binds opt-in approvals to selected evidence, declaration and built-in adapter base URL and model.
 * Custom adapters supply their configuration revision through recorded selected context.
 * Tier: P1 (< 25ms); Complexity: O(p² + p*d + b); CRAP target <= 15 (CC <= 12, branch coverage >= 80%).
 */
export function judgmentInputIdentity(judgment: JudgmentDefinition, evaluation: GuardEvaluationContext): string | undefined {
  if (!usesJudgmentInputOptions(judgment)) return undefined;
  const prepared = prepareJudgmentInput(judgment, evaluation);
  return createHash('sha256').update(JSON.stringify([
    judgment, prepared.state, prepared.inspection.errors,
    process.env.TYPESAFE_BASE_URL, process.env.TYPESAFE_DEFAULT_MODEL,
  ])).digest('hex');
}
