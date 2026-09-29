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
}

export interface SyncResult {
  skill: string;
  target: string;
  action: 'mirrored' | 'linked' | 'unchanged' | 'skipped_invalid' | 'backed_up' | 'skipped_overlap' | 'removed_link';
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
}

export interface SyncCommandResult {
  output: string;
  exitCode: number;
}

export interface DistributionOptions {
  sources: string[];
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
}

export interface DistributionReport extends SyncReport {
  central: string;
  satellites: string[];
  physicalSatellites: string[];
  collisions: { skill: string; winner: string; shadowed: string }[];
  removedLinks: string[];
}
