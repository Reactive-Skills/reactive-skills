export interface SkillEntry {
  name: string;
  path: string;
  hasSkillMd: boolean;
  hasSkillYaml: boolean;
  isValid: boolean;
}

export interface SyncOptions {
  sourceDir?: string;
  sourceDirs?: string[];
  targetDirs: string[];
  /** Legacy single-name option retained for existing callers. */
  targetSkill?: string;
  targetSkills?: string[];
  dryRun?: boolean;
  backup?: boolean;
  link?: boolean;
  /** Replace an installed skill even when its skill.yaml version is newer than the source's. */
  allowDowngrade?: boolean;
  /** Compare installed and incoming skill.yaml versions before replacing a skill. */
  versionGuard?: boolean;
}

export interface SyncResult {
  skill: string;
  target: string;
  action: 'mirrored' | 'linked' | 'unchanged' | 'skipped_invalid' | 'backed_up' | 'skipped_overlap' | 'removed_link' | 'refused_downgrade';
  backupPath?: string;
  reason?: string;
}

export interface SyncReport {
  dryRun: boolean;
  sourceDir: string;
  sourceDirs?: string[];
  targetDirs: string[];
  skillsFound: number;
  skillsValid: number;
  skillsInvalid: number;
  results: SyncResult[];
  orphans: { target: string; names: string[] }[];
  errors: string[];
  /** Selection preflight errors that require a nonzero CLI exit status. */
  selectionErrors?: string[];
  /** Advisory findings that do not stop the sync. */
  warnings?: string[];
  /** Skills left untouched because the source version is older than the installed one. */
  refusals?: SyncRefusal[];
}

export interface SyncRefusal {
  skill: string;
  installedVersion: string;
  sourceVersion: string;
  source: string;
}

/** Where an installed skill came from, recorded in sync-state.json. */
export interface SkillProvenance {
  /** Source folder the skill was copied from. */
  source: string;
  /** Ref the committed content was read from, when one was used. */
  ref?: string;
  /** Branch checked out in the source work tree, for working-tree syncs of git sources. */
  branch?: string;
  /** Commit the content was read from, or the source HEAD for working-tree syncs. */
  commit?: string;
  /** True when the working-tree copy had uncommitted changes. */
  dirty?: boolean;
  /** skill.yaml version at sync time, when known. */
  version?: string;
}

export interface SourceSpec {
  path: string;
  ref?: string;
}

export interface SyncCommandResult {
  output: string;
  exitCode: number;
}

export interface DistributionOptions {
  /** Ordered sources; an entry may name a git ref to read committed content from. */
  sources: Array<string | SourceSpec>;
  central: string;
  satellites: string[];
  physicalSatellites: string[];
  statePath: string;
  /** Legacy single-name selector. */
  targetSkill?: string;
  /** Select multiple skills; omitted means all discovered valid skills. */
  targetSkills?: string[];
  dryRun?: boolean;
  backup?: boolean;
  preserveUnselectedLinks?: boolean;
  allowDowngrade?: boolean;
}

export interface DistributionReport extends SyncReport {
  central: string;
  satellites: string[];
  physicalSatellites: string[];
  collisions: { skill: string; winner: string; shadowed: string }[];
  removedLinks: string[];
  /** Provenance of skills copied from a source during this run. */
  provenance: Record<string, SkillProvenance>;
}
