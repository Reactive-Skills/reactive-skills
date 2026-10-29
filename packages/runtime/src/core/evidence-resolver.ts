import { z } from 'zod';
import { EvidenceMediaTypeSchema, type EvidenceReceipt, type EvidenceStore } from './evidence-store.js';
import type { SignalEvent } from './types.js';

/**
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(p)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function pointerSegments(pointer: string): string[] {
  if (!pointer.startsWith('/') || /~(?:[^01]|$)/.test(pointer)) throw new Error('Evidence fields require a non-root JSON pointer.');
  const segments = pointer.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (segments.some(part => ['__proto__', 'constructor', 'prototype'].includes(part))) throw new Error('Unsafe evidence field pointer.');
  return segments;
}

export const EvidencePointerSchema = z.string().superRefine((pointer, context) => {
  try { pointerSegments(pointer); }
  catch (error) { context.addIssue({ code: z.ZodIssueCode.custom, message: (error as Error).message }); }
});

export const EvidenceFieldSchema = z.object({
  media_type: EvidenceMediaTypeSchema,
  projection: z.enum(['utf8', 'json']),
}).strict().refine(field => (field.media_type === 'application/json') === (field.projection === 'json'), {
  message: 'JSON evidence requires json projection; text evidence requires utf8 projection.',
});
export type EvidenceField = z.infer<typeof EvidenceFieldSchema>;
export type EvidenceFields = Record<string, EvidenceField>;

export const EvidenceFieldsSchema = z.record(EvidencePointerSchema, EvidenceFieldSchema).superRefine((fields, context) => {
  for (const pointer of Object.keys(fields)) {
    let parent = pointer.slice(0, pointer.lastIndexOf('/'));
    while (parent) {
      if (Object.hasOwn(fields, parent)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Evidence field pointers must not overlap.' });
      }
      parent = parent.slice(0, parent.lastIndexOf('/'));
    }
  }
});
export const EvidenceDeclarationsSchema = z.object({
  signals: z.record(EvidenceFieldsSchema).optional(),
  context: EvidenceFieldsSchema.optional(),
}).strict();
export type EvidenceDeclarations = z.infer<typeof EvidenceDeclarationsSchema>;

/** Explicit, copy-on-write resolution. Objects outside declared pointers are never traversed.
 * Stores remain lazy so inline history does not depend on a registry, even with declarations.
 */
export class EvidenceResolver {
  constructor(
    private readonly declarations: EvidenceDeclarations | undefined,
    private readonly store: () => EvidenceStore,
    private readonly onVerified?: (receipt: EvidenceReceipt) => void,
  ) {}

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(selected bytes + pointer depth)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  public resolveFields(value: Record<string, any>, fields?: EvidenceFields): Record<string, any> {
    let result = value;
    for (const [pointer, field] of Object.entries(fields ?? {})) {
      const segments = pointerSegments(pointer);
      let selected: unknown = value;
      for (const segment of segments) {
        selected = selected !== null && typeof selected === 'object' && Object.hasOwn(selected, segment)
          ? (selected as Record<string, unknown>)[segment] : undefined;
      }
      if (selected === null || typeof selected !== 'object' || !Object.hasOwn(selected, '$evidence')) continue;
      const reference = z.object({ $evidence: z.unknown() }).strict().parse(selected);
      const receipt = reference.$evidence;
      // The port validates both receipt structure and the committed local registration.
      const bytes = this.store().read(receipt as Parameters<EvidenceStore['read']>[0]);
      if ((receipt as { media_type: string }).media_type !== field.media_type) throw new Error(`Evidence media type mismatch at ${pointer}.`);
      this.onVerified?.(receipt as EvidenceReceipt);
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      result = this.replace(result, segments, field.projection === 'json' ? JSON.parse(text) : text);
    }
    return result;
  }

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(selected bytes + pointer depth)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  public resolveContext(context: Record<string, any>): Record<string, any> {
    return this.resolveFields(context, this.declarations?.context);
  }

  /**
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(selected bytes + pointer depth)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  public resolveEvent(event: SignalEvent): SignalEvent {
    if (!this.declarations) return event;
    const payload = this.resolvePayload(event.payload, event.type === 'SIGNAL_EMITTED' ? event.payload.signal : undefined);
    if (event.type === 'SIGNAL_EMITTED') {
      return { ...event, payload };
    }
    if (event.type === 'STATE_TRANSITION' && payload.payload) {
      return { ...event, payload: { ...payload, payload: this.resolvePayload(payload.payload, payload.signal) } };
    }
    if (event.type === 'SKILL_INITIALIZED' && payload.context) {
      return { ...event, payload: { ...payload, context: this.resolveContext(payload.context) } };
    }
    if (['STATE_VISITED', 'STATE_REVISITED'].includes(event.type) && payload.context_snapshot) {
      return { ...event, payload: { ...payload, context_snapshot: this.resolveContext(payload.context_snapshot) } };
    }
    return payload === event.payload ? event : { ...event, payload };
  }

  /**
   * Resolve a canonical event history. Only signals committed by a STATE_TRANSITION are verified;
   * refused or unhandled signals were never accepted, so their references stay unresolved.
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(events + selected evidence bytes)
   * - Cyclomatic Complexity (CC): target <=8
   * - Branch Coverage: target >=90%
   * - CRAP Score: target <=10
   */
  public resolveEvents(events: SignalEvent[]): SignalEvent[] {
    if (!this.declarations) return events;
    const committed = new Set(events.filter(event => event.type === 'STATE_TRANSITION')
      .map(event => event.causation_id || event.causationId));
    return events.map(event => event.type === 'SIGNAL_EMITTED' && !committed.has(event.id) ? event : this.resolveEvent(event));
  }

  /**
   * Validate explicit signal bindings before projecting accepted context updates.
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target for <=1MiB)
   * - Complexity: O(declared field traversal + selected evidence bytes)
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=15
   */
  private resolvePayload(payload: Record<string, any>, signal?: string): Record<string, any> {
    const resolved = this.resolveFields(payload, signal ? this.declarations?.signals?.[signal] : undefined);
    return resolved.contextUpdates
      ? { ...resolved, contextUpdates: this.resolveContext(resolved.contextUpdates) } : resolved;
  }

  /**
   * # Performance & Risk Budget
   * - Tier: P0 (<5ms target)
   * - Complexity: O(pointer depth + copied ancestor fields)
   * - Cyclomatic Complexity (CC): target <=8
   * - Branch Coverage: target >=90%
   * - CRAP Score: target <=10
   */
  private replace(value: Record<string, any>, segments: string[], replacement: unknown): Record<string, any> {
    const [head, ...tail] = segments;
    const copy = Array.isArray(value) ? [...value] : { ...value };
    Object.defineProperty(copy, head, {
      value: tail.length ? this.replace(value[head], tail, replacement) : replacement,
      enumerable: true, configurable: true, writable: true,
    });
    return copy;
  }
}
