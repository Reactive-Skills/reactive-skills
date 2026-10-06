export const VET_SEVERITIES = ['high', 'medium', 'low'] as const;
export type VetSeverity = (typeof VET_SEVERITIES)[number];

export type VetCategory = 'code' | 'guard' | 'prompt' | 'hidden' | 'supply' | 'scan';

/** One entry of the rule catalog. A rule always reports at its own severity. */
export interface VetRule {
  id: string;
  severity: VetSeverity;
  category: VetCategory;
  /** What the rule looks for, in one sentence. Reused as the finding message. */
  summary: string;
}

/**
 * One problem in one file. Repeated hits of the same rule in the same file collapse into a single
 * finding that names the first line and counts the rest.
 */
export interface VetFinding {
  rule: string;
  severity: VetSeverity;
  /** Skill-relative path with forward slashes. */
  file: string;
  /** First line (1-based) where the rule matched. */
  line: number;
  message: string;
  /** How many places in the file matched. */
  count: number;
  /** True when the file is loaded by the runtime as a guardFunction, or required by one. */
  guard?: boolean;
}

export interface VetSuppressedFinding extends VetFinding {
  /** The reason recorded in the allowlist entry that suppressed the finding. */
  reason: string;
}

/** One reviewed exception. `path` is skill-relative and may use `*`, `**` and `?`. */
export interface VetAllowlistEntry {
  skill: string;
  rule: string;
  path: string;
  reason: string;
}

export interface VetAllowlist {
  /** The file the entries were read from. */
  source: string;
  entries: VetAllowlistEntry[];
}

export interface VetOptions {
  allowlist?: VetAllowlist;
  /** Collects a key for each allowlist entry that matched a finding, so stale entries can be reported. */
  usedEntries?: Set<string>;
}

export interface VetSkillReport {
  /** The skill directory name, which allowlist entries match on. */
  skill: string;
  /** Resolved skill directory. */
  path: string;
  filesScanned: number;
  findings: VetFinding[];
  suppressed: VetSuppressedFinding[];
}

export interface VetSummary {
  skills: number;
  filesScanned: number;
  high: number;
  medium: number;
  low: number;
  suppressed: number;
}

export interface VetReport {
  failOn: VetSeverity;
  /** True when any unsuppressed finding is at or above `failOn`. */
  failed: boolean;
  summary: VetSummary;
  skills: VetSkillReport[];
  /** Allowlist entries that matched nothing, so they can be deleted. */
  unusedAllowlist: VetAllowlistEntry[];
}
