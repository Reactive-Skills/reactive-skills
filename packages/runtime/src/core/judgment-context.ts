/** Runtime capability advertised by runtimes that enforce `context_paths` and `include_payload`. */
export const JUDGMENT_CONTEXT_PATHS_CAPABILITY = 'judgment.context_paths';

/** Path segments that would reach an object's prototype instead of data the run recorded. */
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

export interface ScopedJudgmentContext {
  /** One entry per path found in the run context, keyed by the path as written. */
  context: Record<string, unknown>;
  /** Paths that were found and sent, in declared order, without duplicates. */
  sent: string[];
  /** Paths with no value in the run context; nothing is sent for them. */
  missing: string[];
}

/**
 * Describes why a `context_paths` entry is not a valid path, or returns undefined when it is.
 *
 * A path is dot-separated segments read from the run context, such as `write_side.deciders`.
 * A numeric segment indexes an array. Segments cannot be empty, contain whitespace or brackets,
 * or name a prototype property.
 */
export function validateContextPath(path: string): string | undefined {
  if (path.length === 0) return 'a context path cannot be empty';
  for (const segment of path.split('.')) {
    if (segment.length === 0) return `context path '${path}' has an empty segment; use dot-separated names such as write_side.deciders`;
    if (/[\s[\]]/.test(segment)) return `context path '${path}' has whitespace or brackets in '${segment}'; use dot-separated names, with a number for an array index`;
    if (FORBIDDEN_SEGMENTS.has(segment)) return `context path '${path}' cannot use '${segment}' as a segment`;
  }
  return undefined;
}

function readPath(context: unknown, path: string): unknown {
  let current = context;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Selects the declared paths from a run context. Each found path becomes one key of the returned
 * context, named by the path as written, so `write_side.deciders` arrives as that key rather than
 * as nested objects. A path with no value is reported in `missing` and left out; it never fails
 * the judgment. An explicit `null` counts as a value.
 */
export function scopeJudgmentContext(context: Record<string, unknown>, paths: readonly string[]): ScopedJudgmentContext {
  const scoped: Record<string, unknown> = {};
  const sent: string[] = [];
  const missing: string[] = [];
  for (const path of new Set(paths)) {
    const value = validateContextPath(path) ? undefined : readPath(context, path);
    if (value === undefined) {
      missing.push(path);
    } else {
      scoped[path] = value;
      sent.push(path);
    }
  }
  return { context: scoped, sent, missing };
}
