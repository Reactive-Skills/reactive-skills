/**
 * Utility to extract --job <id> or --job=<id> from CLI arguments
 */
export function extractJobFlag(args: string[]): { jobId?: string; filteredArgs: string[] } {
  const filteredArgs: string[] = [];
  let jobId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--job' || arg === '-j') {
      jobId = args[++i];
    } else if (arg.startsWith('--job=')) {
      jobId = arg.slice(6);
    } else {
      filteredArgs.push(arg);
    }
  }

  return { jobId, filteredArgs };
}

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const HOME_DIR = os.homedir();

/**
 * Resolves a skill directory path from workspace or global agent registries.
 */
export function resolveSkillPath(skillName: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'skills', skillName),
    path.resolve(process.cwd(), 'skills', `_${skillName}_skill`),
    path.resolve(process.cwd(), skillName),
    path.resolve(HOME_DIR, '.agents', 'skills', skillName),
    path.resolve(HOME_DIR, '.gemini', 'config', 'skills', skillName),
    path.resolve(HOME_DIR, '.kilocode', 'skills', skillName),
    path.resolve(HOME_DIR, '.claude', 'skills', skillName),
  ];
  for (const candidate of candidates) {
    const yamlPath = path.join(candidate, 'skill.yaml');
    if (fs.existsSync(yamlPath)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Resolves project workspace root given a skill directory path.
 * 1. If WORKSPACE_DIR environment variable is set, uses that.
 * 2. If skill is inside the current working directory, returns the workspace root containing the skill.
 * 3. If skill is outside cwd (e.g. global registry ~/.agents/skills or ~/.gemini/config/skills),
 *    returns process.cwd() as the execution workspace where deliverables and .reactive state belong.
 */
export function resolveWorkspaceDir(skillPath?: string): string {
  if (process.env.WORKSPACE_DIR) {
    return path.resolve(process.env.WORKSPACE_DIR);
  }

  const cwd = process.cwd();
  if (skillPath) {
    const resolvedSkill = path.resolve(skillPath);
    const rel = path.relative(cwd, resolvedSkill);
    const isInsideCwd = !rel.startsWith('..') && !path.isAbsolute(rel);

    if (isInsideCwd) {
      const parent = path.dirname(resolvedSkill);
      if (path.basename(parent) === 'skills') {
        return path.dirname(parent);
      }
      return cwd;
    }
  }

  return cwd;
}


