import { z } from 'zod';
import { EvidenceMediaTypeSchema, EvidenceReceiptSchema, type EvidenceReceipt, type EvidenceMediaType } from './evidence-store.js';
import { EvidencePointerSchema, type EvidenceFields } from './evidence-resolver.js';
import type { FSMEngine } from './fsm-engine.js';

export const EvidenceBindingSchema = z.union([
  z.object({ reference: EvidenceReceiptSchema }).strict(),
  z.object({ path: z.string().min(1).max(4096), media_type: EvidenceMediaTypeSchema }).strict(),
]);
export const EvidenceBindingsSchema = z.record(EvidencePointerSchema, EvidenceBindingSchema)
  .refine(bindings => Object.keys(bindings).length <= 32, 'At most 32 evidence bindings are allowed.');
export type EvidenceBindings = z.infer<typeof EvidenceBindingsSchema>;

/**
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(pointer depth)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function segments(pointer: string): string[] {
  return pointer.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/**
 * Copy only the bound field's ancestors; never overwrite an inline payload value.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(pointer depth + copied ancestor fields)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function bind(value: Record<string, unknown>, pointer: string[], replacement: unknown): Record<string, unknown> {
  const [head, ...tail] = pointer;
  if (tail.length === 0) {
    if (Object.hasOwn(value, head)) throw new Error('Evidence binding conflicts with an existing payload field.');
    return { ...value, [head]: replacement };
  }
  const child = Object.hasOwn(value, head) ? value[head] : {};
  if (child === null || typeof child !== 'object' || Array.isArray(child)) {
    throw new Error('Evidence binding parent must be an object.');
  }
  return { ...value, [head]: bind(child as Record<string, unknown>, tail, replacement) };
}

/**
 * Read compact receipt metadata from the canonical event, including on keyed retry.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(declared fields * pointer depth)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function receipts(payload: Record<string, unknown>, fields: EvidenceFields): Record<string, EvidenceReceipt> {
  const result: Record<string, EvidenceReceipt> = {};
  for (const pointer of Object.keys(fields)) {
    let value: unknown = payload;
    for (const part of segments(pointer)) {
      value = value !== null && typeof value === 'object' && Object.hasOwn(value, part)
        ? (value as Record<string, unknown>)[part] : undefined;
    }
    const parsed = z.object({ $evidence: EvidenceReceiptSchema }).strict().safeParse(value);
    if (parsed.success) result[pointer] = parsed.data.$evidence;
  }
  return result;
}

/**
 * Preserve port validation while keeping parser snippets of imported content out of receipts.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target for <=1MiB)
 * - Complexity: O(imported bytes + source path depth)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function importEvidence(engine: FSMEngine, source: string, mediaType: EvidenceMediaType): EvidenceReceipt {
  try {
    return engine.getEventStore().getEvidenceStore().importFile(source, mediaType);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Evidence import requires valid canonical JSON.');
    throw error;
  }
}

/**
 * Bind explicit transport metadata, then use the SDK signal path unchanged.
 * Registration precedes signal commit; refused submissions may retain unused registrations.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms local evidence target per <=1MiB blob; guards/judgments additional)
 * - Complexity: O(bound bytes + pointer depth + copied payload fields), independent of ledger length
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
export async function submitEvidenceSignal(
  engine: FSMEngine,
  signal: string,
  payload: Record<string, unknown>,
  input: unknown,
  metadata: { source?: string; causationId?: string; idempotencyKey?: string } = {},
) {
  const fields = engine.getManifest().evidence?.signals?.[signal] ?? {};
  const existing = metadata.idempotencyKey
    ? engine.getEventStore().getEventByIdempotencyKey(metadata.idempotencyKey) : undefined;
  if (existing) {
    const result = await engine.handleSignal(signal, payload, metadata);
    return { result, evidence: receipts(result.event.payload, fields) };
  }
  const bindings = EvidenceBindingsSchema.parse(input);
  // Validate all declarations, media types, overlaps and collisions before reading any local source.
  let bound = z.record(z.unknown()).parse(payload);
  for (const [pointer, binding] of Object.entries(bindings)) {
    const type = 'reference' in binding ? binding.reference.media_type : binding.media_type;
    if (!Object.hasOwn(fields, pointer) || fields[pointer].media_type !== type) {
      throw new Error(`Evidence binding requires a matching declared signal field: ${pointer}`);
    }
    bound = bind(bound, segments(pointer), null);
  }
  bound = payload;
  for (const [pointer, binding] of Object.entries(bindings)) {
    const receipt = 'reference' in binding ? binding.reference
      : importEvidence(engine, binding.path, binding.media_type);
    bound = bind(bound, segments(pointer), { $evidence: receipt });
  }
  // Reference validation, guard/judgment materialization and projection belong to the core resolver.
  const result = await engine.handleSignal(signal, bound, metadata);
  return { result, evidence: receipts(result.event.payload, fields) };
}

/**
 * Explicit content read only. The selected-run port verifies the registration and bytes.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target for <=1MiB)
 * - Complexity: O(selected bytes)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function readEvidence(engine: FSMEngine, input: unknown) {
  const reference = EvidenceReceiptSchema.parse(input);
  const bytes = engine.getEventStore().getEvidenceStore().read(reference);
  return { reference, content: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) };
}
