import fs from 'node:fs';
import yaml from 'js-yaml';
import { z } from 'zod';
import { getVetRule } from './rules.js';
import type { VetAllowlist, VetAllowlistEntry } from './types.js';

const MAX_ALLOWLIST_BYTES = 1024 * 1024;

export class VetAllowlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VetAllowlistError';
  }
}

const EntrySchema = z
  .object({
    skill: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'must be a skill directory name, with no wildcards or separators'),
    rule: z.string().min(1),
    path: z.string().min(1),
    reason: z.string().refine((value) => value.trim().length > 0, 'is required: say why this use is legitimate'),
  })
  .strict();

const FileSchema = z.object({ version: z.literal(1).optional(), allow: z.array(z.unknown()) }).strict();

/** The first problem with a skill-relative path pattern, or undefined when it is acceptable. */
function pathProblem(value: string): string | undefined {
  if (value.includes('\0')) return 'must not contain a NUL character';
  if (value.includes('\\')) return 'must use forward slashes';
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return 'must be relative to the skill directory';
  if (value.split('/').some((segment) => segment === '..' || segment === '')) return 'must not contain ".." or empty segments';
  return undefined;
}

/** Compile a path pattern: `*` stays inside a segment, `**` crosses segments, `?` is one character. */
export function compileGlob(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      if (pattern[i + 2] === '/') {
        out += '(?:.*/)?';
        i += 2;
      } else {
        out += '.*';
        i += 1;
      }
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

export interface CompiledAllowlistEntry extends VetAllowlistEntry {
  matcher: RegExp;
}

export function compileAllowlist(allowlist: VetAllowlist): CompiledAllowlistEntry[] {
  return allowlist.entries.map((entry) => ({ ...entry, matcher: compileGlob(entry.path) }));
}

/**
 * Read an allowlist file. The format is YAML (JSON also works):
 *
 *   allow:
 *     - skill: build-advisor
 *       rule: code/child-process
 *       path: guards/workflow.test.cjs
 *       reason: CI test harness; not referenced by skill.yaml
 *
 * Every field is required. Unknown rule ids, paths that leave the skill, empty reasons and
 * duplicate entries are rejected so a typo cannot silently widen or lose an exception.
 */
export function loadVetAllowlist(file: string): VetAllowlist {
  let text: string;
  try {
    if (fs.statSync(file).size > MAX_ALLOWLIST_BYTES) throw new VetAllowlistError(`Allowlist ${file} is larger than ${MAX_ALLOWLIST_BYTES} bytes`);
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err instanceof VetAllowlistError) throw err;
    throw new VetAllowlistError(`Allowlist ${file} could not be read: ${(err as NodeJS.ErrnoException).code ?? 'error'}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(text);
  } catch {
    throw new VetAllowlistError(`Allowlist ${file} is not valid YAML or JSON`);
  }
  const shape = FileSchema.safeParse(parsed);
  if (!shape.success) {
    throw new VetAllowlistError(`Allowlist ${file} must be a mapping with an "allow" list (and optional "version: 1")`);
  }

  const entries: VetAllowlistEntry[] = [];
  const seen = new Set<string>();
  shape.data.allow.forEach((raw, index) => {
    const where = `Allowlist ${file}, entry ${index + 1}`;
    const entry = EntrySchema.safeParse(raw);
    if (!entry.success) {
      const issue = entry.error.issues[0];
      const field = issue.path.join('.') || 'entry';
      throw new VetAllowlistError(`${where}: ${field} ${issue.message}`);
    }
    const { skill, rule, path: entryPath, reason } = entry.data;
    if (!getVetRule(rule)) throw new VetAllowlistError(`${where}: unknown rule id "${rule}"`);
    const problem = pathProblem(entryPath);
    if (problem) throw new VetAllowlistError(`${where}: path ${problem}`);
    const key = `${skill}\0${rule}\0${entryPath}`;
    if (seen.has(key)) throw new VetAllowlistError(`${where}: duplicate of an earlier entry for ${skill} ${rule} ${entryPath}`);
    seen.add(key);
    entries.push({ skill, rule, path: entryPath, reason: reason.trim() });
  });

  return { source: file, entries };
}
