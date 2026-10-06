import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** Parses a SemVer 2.0.0 string; returns undefined for anything else. Build metadata is ignored. */
export function parseSemVer(value: unknown): SemVer | undefined {
  if (typeof value !== 'string') return undefined;
  const match = SEMVER.exec(value.trim());
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function comparePrerelease(a: string[], b: string[]): number {
  // A version without a prerelease outranks any prerelease of the same core version.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const aNumeric = /^\d+$/.test(a[i]);
    const bNumeric = /^\d+$/.test(b[i]);
    if (aNumeric && bNumeric) {
      const diff = Number(a[i]) - Number(b[i]);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (aNumeric !== bNumeric) {
      return aNumeric ? -1 : 1;
    } else if (a[i] !== b[i]) {
      return a[i] < b[i] ? -1 : 1;
    }
  }
  return 0;
}

/** Negative when a < b, zero when equal in precedence, positive when a > b. */
export function compareSemVer(a: SemVer, b: SemVer): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

/**
 * Reads the `version` field of a skill's skill.yaml. Returns undefined when the file is missing,
 * is not valid YAML, or has no string version. A bare number such as `1.10` is not a SemVer string
 * and YAML would have already rounded it, so it counts as unknown.
 */
export function readSkillVersion(skillPath: string): string | undefined {
  try {
    const parsed = yaml.load(fs.readFileSync(path.join(skillPath, 'skill.yaml'), 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const version = (parsed as Record<string, unknown>).version;
      if (typeof version === 'string' && version.trim()) return version.trim();
    }
  } catch {
    // Unreadable or malformed manifests have an unknown version.
  }
  return undefined;
}

export type VersionVerdict =
  | { kind: 'upgrade' | 'same' }
  | { kind: 'downgrade'; installed: string; incoming: string }
  | { kind: 'unknown'; installed?: string; incoming?: string };

export function compareSkillVersions(installed: string | undefined, incoming: string | undefined): VersionVerdict {
  const installedVersion = parseSemVer(installed);
  const incomingVersion = parseSemVer(incoming);
  if (!installedVersion || !incomingVersion) return { kind: 'unknown', installed, incoming };
  const order = compareSemVer(incomingVersion, installedVersion);
  if (order < 0) return { kind: 'downgrade', installed: installed!, incoming: incoming! };
  return { kind: order === 0 ? 'same' : 'upgrade' };
}
