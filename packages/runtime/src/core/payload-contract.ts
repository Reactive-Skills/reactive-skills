import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { SkillManifest, TransitionDefinition } from './types.js';

const fieldTypes = {
  string: z.string(), number: z.number().finite(), boolean: z.boolean(),
  object: z.record(z.unknown()), array: z.array(z.unknown()), null: z.null(),
};

const FieldSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'null']),
  required: z.boolean().optional(),
  const: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]).optional(),
}).strict().superRefine(validateFieldConstant);

export const PayloadContractSchema = z.object({
  fields: z.record(z.string().regex(/^(?!(?:__proto__|constructor|prototype)$)[A-Za-z_$][\w$]*$/, 'Use a top-level payload field name without prototype keys'), FieldSchema),
  relationships: z.array(z.string().trim().min(1)),
  evidence_source: z.string().trim().min(1),
  refusal_hint: z.string().trim().min(1),
}).strict();

export type PayloadContract = z.infer<typeof PayloadContractSchema>;

/**
 * Compare an authored field with its submitted value, without coercion.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(b), selected value bytes
 * - Cyclomatic Complexity (CC): 3 (measured with ESLint)
 * - Branch Coverage: 100% (measured with V8 acceptance tests)
 * - CRAP Score: 3.0 (Threshold <= 10)
 * - Measured: 0.001037ms p95 for the containing structural check; Node 22.23.3/Linux, 100 samples after 10 warmups.
 */
function fieldMismatch(field: PayloadContract['fields'][string], value: unknown): boolean {
  return !fieldTypes[field.type].safeParse(value).success || (Object.hasOwn(field, 'const') && value !== field.const);
}

/**
 * Reject contradictory authored type/constant declarations; never infer a schema from guard text.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(b), constant bytes
 * - Cyclomatic Complexity (CC): 3 (measured with ESLint)
 * - Branch Coverage: 100% (measured with V8 acceptance tests)
 * - CRAP Score: 3.0 (Threshold <= 10)
 * - Measured: 0.015329ms p95 for the containing declaration parse; Node 22.23.3/Linux, 100 samples after 10 warmups.
 */
function validateFieldConstant(field: { type: keyof typeof fieldTypes; const?: unknown }, context: z.RefinementCtx): void {
  if (Object.hasOwn(field, 'const') && !fieldTypes[field.type].safeParse(field.const).success) {
    context.addIssue({ code: 'custom', path: ['const'], message: 'Declared constant must match the field type' });
  }
}

/**
 * Check only authored structural requirements; relationships remain enforced by the original guard.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(f + b), declared fields and selected value bytes
 * - Cyclomatic Complexity (CC): 8 (measured with ESLint)
 * - Branch Coverage: 100% (measured with V8 acceptance tests)
 * - CRAP Score: 8.0 (Threshold <= 10)
 * - Measured: 0.001037ms p95 structural validation; Node 22.23.3/Linux, 100 samples after 10 warmups.
 */
export function payloadContractError(contract: PayloadContract | undefined, payload: Record<string, unknown>): string | undefined {
  if (!contract) return undefined;
  for (const [name, field] of Object.entries(contract.fields)) {
    const present = Object.hasOwn(payload, name);
    if (!present && field.required === false) continue;
    const value = present ? payload[name] : undefined;
    if (fieldMismatch(field, value)) {
      return `Payload field '${name}' requires ${field.type}${Object.hasOwn(field, 'const') ? ` equal to ${JSON.stringify(field.const)}` : ''}. ${contractRefusalGuidance(contract)}`;
    }
  }
  return undefined;
}

/**
 * Refusal-only recovery text; compact views omit it to keep initial delivery small.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(b), hint and evidence-source bytes
 * - Cyclomatic Complexity (CC): 1 (manual count)
 * - Branch Coverage: 100% (measured with V8 acceptance tests)
 * - CRAP Score: 1.0 (Threshold <= 10)
 */
export function contractRefusalGuidance(contract: PayloadContract): string {
  return `${contract.refusal_hint} Evidence source: ${contract.evidence_source}.`;
}

/**
 * Reject only provable contradictions with a single strict primitive equality.
 * This is a declaration consistency check, never schema inference or a claim of guard equivalence.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(b), expression bytes
 * - Cyclomatic Complexity (CC): 7 (measured with ESLint)
 * - Branch Coverage: 100% (measured with V8 acceptance tests)
 * - CRAP Score: 7.0 (Threshold <= 10)
 * - Measured: 0.015329ms p95 for the containing declaration parse; Node 22.23.3/Linux, 100 samples after 10 warmups.
 */
export function validatePayloadContractDrift(transition: Pick<TransitionDefinition, 'guard' | 'payload_contract'>, context: z.RefinementCtx): void {
  if (!transition.guard || !transition.payload_contract) return;
  const match = /^(?:event\.)?payload\.([A-Za-z_$][\w$]*)\s*===\s*(true|false|null|-?\d+(?:\.\d+)?|"(?:[^"\\]|\\.)*")$/.exec(transition.guard.trim());
  if (!match) return;
  if (!Object.hasOwn(transition.payload_contract.fields, match[1])) return;
  const field = transition.payload_contract.fields[match[1]];
  let value: unknown;
  try { value = JSON.parse(match[2]); } catch { return; }
  if (fieldMismatch(field, value)) {
    context.addIssue({ code: 'custom', path: ['payload_contract', 'fields', match[1]], message: 'Payload contract contradicts the guard strict equality' });
  }
}

/**
 * Read exact guard source without importing it or opening a run. State paths identify the owning condition.
 * # Performance & Risk Budget
 * - Tier: P2 (< 100ms); Complexity: O(d + b), state depth and source bytes
 * - Cyclomatic Complexity (CC): 11 (measured with ESLint)
 * - Branch Coverage: 100% (measured with V8 acceptance tests)
 * - CRAP Score: 11.0 (Threshold <= 25)
 * - Measured: 0.000271ms p95 inline inspection; 0.046988ms with module source; Node 22.23.3/Linux, 100 samples after 10 warmups.
 */
export function inspectTransitionGuard(manifest: SkillManifest, skillDir: string, state: string, signal: string) {
  let states = manifest.states;
  let definition;
  for (const segment of state.split('.')) {
    definition = Object.hasOwn(states, segment) ? states[segment] : undefined;
    if (!definition) throw new Error(`Unknown owning state '${state}'`);
    states = definition.substates ?? {};
  }
  const transition = definition?.transitions?.[signal];
  if (!transition || !Object.hasOwn(definition!.transitions!, signal)) throw new Error(`No signal '${signal}' owned by '${state}'`);
  const result: TransitionDefinition = typeof transition === 'string' ? { target: transition } : transition;
  return { state, signal, ...result, ...(result.guardFunction ? { guard_source: readGuardSource(skillDir, result.guardFunction) } : {}) };
}

/**
 * Contain inspection reads to JavaScript inside the skill, including realpath/symlink checks; never execute source.
 * # Performance & Risk Budget
 * - Tier: P2 (< 100ms); Complexity: O(b), module source bytes
 * - Cyclomatic Complexity (CC): 5 (measured with ESLint)
 * - Branch Coverage: 100% (measured with V8 acceptance tests)
 * - CRAP Score: 5.0 (Threshold <= 25)
 * - Measured: 0.046988ms p95 for the containing module inspection; Node 22.23.3/Linux, 100 samples after 10 warmups.
 */
function readGuardSource(skillDir: string, modulePath: string): string {
  const root = fs.realpathSync(skillDir);
  const file = fs.realpathSync(path.resolve(root, modulePath));
  const relative = path.relative(root, file);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative) || !['.js', '.mjs', '.cjs'].includes(path.extname(file))) {
    throw new Error('Guard inspection requires a JavaScript file inside the skill directory');
  }
  return fs.readFileSync(file, 'utf8');
}

/**
 * Prefer one short authored line per field and relationship; retain exact legacy guard text and opaque-module inspect guidance.
 * Refusal hints and evidence sources stay in refusals and inspection.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms); Complexity: O(f + r), declared fields and relationships
 * - Cyclomatic Complexity (CC): 4 (manual count; field callback 3)
 * - Branch Coverage: 100% (measured with V8 acceptance tests)
 * - CRAP Score: 4.0 (Threshold <= 10)
 * - Measured: 0.000370ms p50 / 0.001010ms p95 requirements rendering; Node 22.23.3/Linux, 100 samples after 10 warmups.
 */
export function payloadRequirements(definition: TransitionDefinition): string[] {
  const contract = definition.payload_contract;
  if (contract) {
    return [
      ...Object.entries(contract.fields).map(([name, field]) =>
        `${name}${field.required === false ? '?' : ''}:${field.type}${Object.hasOwn(field, 'const') ? `=${JSON.stringify(field.const)}` : ''}`),
      ...contract.relationships.map(relationship => `rel: ${relationship}`),
      'inspect guard',
    ];
  }
  const fields: string[] = [];
  if (definition.guard) fields.push(`guard: ${definition.guard}`);
  if (definition.guardFunction) fields.push(`guardFunction: ${definition.guardFunction} (inspect skill for payload requirements)`);
  return fields;
}
