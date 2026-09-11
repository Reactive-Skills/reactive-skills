export interface SkillEntry {
  name: string;
  path: string;
  hasSkillMd: boolean;
  hasSkillYaml: boolean;
  isValid: boolean;
}

export interface SyncOptions {
  sourceDir: string;
  targetDirs: string[];
  targetSkill?: string;
  dryRun?: boolean;
  backup?: boolean;
}

export interface SyncResult {
  skill: string;
  target: string;
  action: 'mirrored' | 'unchanged' | 'skipped_invalid' | 'backed_up' | 'skipped_overlap';
  backupPath?: string;
  reason?: string;
}

export interface SyncReport {
  dryRun: boolean;
  sourceDir: string;
  targetDirs: string[];
  skillsFound: number;
  skillsValid: number;
  skillsInvalid: number;
  results: SyncResult[];
  orphans: { target: string; names: string[] }[];
  errors: string[];
}