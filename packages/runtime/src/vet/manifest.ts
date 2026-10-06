import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

/** A manifest larger than this is not parsed, because a hostile document can make parsing expensive. */
const MAX_MANIFEST_BYTES = 1024 * 1024;
/** Bounds the walk over a manifest whose aliases share or repeat nodes. */
const MAX_NODES = 20_000;

export interface GuardUse {
  /** Skill-relative guardFunction path as written in the manifest. */
  guardFunction?: string;
  /** Inline guard expression text. */
  expression?: string;
  /** A judgment criterion. The runtime runs it as an expression when it compiles as one. */
  criterion?: string;
  /** 1-based line in the manifest where the value appears, or 1 when it cannot be located. */
  line: number;
}

export interface SkillManifestInfo {
  /** Manifest file name relative to the skill, when one exists. */
  file?: string;
  /** Set when a manifest exists but could not be read or parsed. */
  problem?: string;
  guards: GuardUse[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Find the line of the next `key:` entry at or after `from`, preferring one whose value starts like
 * `value`. YAML quoting changes a value's raw text, so only the quote-free prefix is compared.
 */
function locate(lines: string[], key: string, value: string, from: number): number {
  const first = value
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const prefix = first?.match(/^[^'"\\]+/)?.[0].trim().slice(0, 40) ?? '';
  const keyed = new RegExp(`^\\s*(?:-\\s*)?${key}\\s*:(.*)$`);
  let fallback: number | undefined;
  for (let i = Math.max(0, from - 1); i < lines.length; i++) {
    const match = keyed.exec(lines[i]);
    if (!match) continue;
    fallback ??= i + 1;
    if (prefix.length >= 3 && match[1].includes(prefix)) return i + 1;
  }
  return fallback ?? Math.max(1, from);
}

/**
 * Collect every guard the manifest declares. YAML is parsed as data by js-yaml's default schema,
 * which constructs plain values only, and the guard text is returned as a string.
 */
export function readSkillManifest(skillDir: string): SkillManifestInfo {
  const file = ['skill.yaml', 'skill.yml'].find((name) => fs.existsSync(path.join(skillDir, name)));
  if (!file) return { guards: [] };

  const full = path.join(skillDir, file);
  let text: string;
  try {
    const stat = fs.statSync(full);
    if (stat.size > MAX_MANIFEST_BYTES) {
      return { file, problem: `${file} is larger than ${MAX_MANIFEST_BYTES} bytes and was not parsed`, guards: [] };
    }
    text = fs.readFileSync(full, 'utf8');
  } catch (err) {
    return { file, problem: `${file} could not be read: ${(err as NodeJS.ErrnoException).code ?? 'error'}`, guards: [] };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(text);
  } catch {
    return { file, problem: `${file} is not valid YAML`, guards: [] };
  }
  if (!isRecord(parsed)) return { file, problem: `${file} is not a YAML mapping`, guards: [] };

  const lines = text.split('\n');
  const guards: GuardUse[] = [];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let cursor = 1;

  const walkStates = (states: unknown): void => {
    if (!isRecord(states) || seen.has(states) || nodes >= MAX_NODES) return;
    seen.add(states);
    for (const state of Object.values(states)) {
      if (!isRecord(state) || seen.has(state) || ++nodes >= MAX_NODES) continue;
      seen.add(state);
      const transitions = state.transitions;
      if (isRecord(transitions)) {
        for (const transition of Object.values(transitions)) {
          if (!isRecord(transition) || ++nodes >= MAX_NODES) continue;
          if (typeof transition.guardFunction === 'string') {
            const line = locate(lines, 'guardFunction', transition.guardFunction, cursor);
            cursor = line + 1;
            guards.push({ guardFunction: transition.guardFunction, line });
          }
          if (typeof transition.guard === 'string' && transition.guard.trim() !== '') {
            const line = locate(lines, 'guard', transition.guard, cursor);
            cursor = line + 1;
            guards.push({ expression: transition.guard, line });
          }
          const judgment = transition.judgment;
          if (isRecord(judgment) && typeof judgment.criterion === 'string' && judgment.criterion.trim() !== '') {
            const line = locate(lines, 'criterion', judgment.criterion, cursor);
            cursor = line + 1;
            guards.push({ criterion: judgment.criterion, line });
          }
        }
      }
      walkStates(state.substates);
    }
  };
  walkStates(parsed.states);
  return { file, guards };
}
