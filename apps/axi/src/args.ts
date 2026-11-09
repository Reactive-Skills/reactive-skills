/**
 * Utility to extract --job <id>, -j <id>, --run <id>, or REACTIVE_JOB_ID from CLI arguments
 */
export function extractJobFlag(args: string[]): { jobId?: string; parentJobId?: string; idempotencyKey?: string; filteredArgs: string[] } {
  const filteredArgs: string[] = [];
  let jobId: string | undefined;
  let parentJobId: string | undefined;
  let idempotencyKey: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--job' || arg === '-j' || arg === '--run' || arg === '--run-id') {
      jobId = args[++i];
    } else if (arg === '--parent') {
      parentJobId = args[++i];
    } else if (arg === '--idempotency-key') {
      idempotencyKey = args[++i];
    } else if (arg.startsWith('--job=')) {
      jobId = arg.slice(6);
    } else if (arg.startsWith('--run=')) {
      jobId = arg.slice(6);
    } else if (arg.startsWith('--run-id=')) {
      jobId = arg.slice(9);
    } else if (arg.startsWith('--parent=')) {
      parentJobId = arg.slice('--parent='.length);
    } else if (arg.startsWith('--idempotency-key=')) {
      idempotencyKey = arg.slice('--idempotency-key='.length);
    } else {
      filteredArgs.push(arg);
    }
  }

  if (!jobId && process.env.REACTIVE_JOB_ID && process.env.REACTIVE_JOB_ID.trim()) {
    jobId = process.env.REACTIVE_JOB_ID.trim();
  }

  return { jobId, parentJobId, idempotencyKey, filteredArgs };
}

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { AxiError } from './errors.js';
import { workspaceContext } from './workspace-context.js';

const HOME_DIR = os.homedir();

function readManifestName(skillPath: string): string | undefined {
  try {
    const manifest = yaml.load(fs.readFileSync(path.join(skillPath, 'skill.yaml'), 'utf8')) as { name?: unknown } | undefined;
    return typeof manifest?.name === 'string' && manifest.name ? manifest.name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The id the runtime keys a skill's run store by: the manifest name, as `FSMEngine` uses it,
 * so a skill passed by path or by directory name reaches the same `.reactive/skills/<id>/` store.
 */
export function resolveSkillId(skillPath: string): string {
  return readManifestName(skillPath) || path.basename(skillPath);
}

/**
 * Resolves a skill directory path from workspace or global agent registries.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target on local filesystem)
 * - Complexity: O(d), caller path depth and a fixed registry list
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
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
  const bound = workspaceContext.getStore();
  if (bound) candidates.unshift(path.resolve(bound.root, 'skills', skillName));
  let ancestor = path.dirname(process.cwd());
  while (ancestor !== path.dirname(ancestor)) {
    candidates.push(path.resolve(ancestor, 'skills', skillName));
    ancestor = path.dirname(ancestor);
  }
  for (const candidate of candidates) {
    const yamlPath = path.join(candidate, 'skill.yaml');
    if (fs.existsSync(yamlPath)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Finds the one `./skills/*` directory whose `skill.yaml` declares this manifest name.
 */
export function findSkillByManifestName(skillName: string): string | null {
  const skillsDir = path.resolve(process.cwd(), 'skills');
  let entries: string[];
  try {
    entries = fs.readdirSync(skillsDir);
  } catch {
    return null;
  }
  const matches = entries
    .map((entry) => path.join(skillsDir, entry))
    .filter((candidate) => fs.existsSync(path.join(candidate, 'skill.yaml')) && readManifestName(candidate) === skillName);
  if (matches.length > 1) {
    throw new AxiError(
      `Skill name '${skillName}' matches more than one skill directory`,
      'VALIDATION_ERROR',
      matches.map((match) => `Pass the skill path instead: ${match}`)
    );
  }
  return matches[0] ?? null;
}

/**
 * Resolves the CLI-bound root first, retaining the legacy SDK/helper fallback.
 * 1. If WORKSPACE_DIR environment variable is set, uses that.
 * 2. If skill is inside the current working directory, returns the workspace root containing the skill.
 * 3. If skill is outside cwd (e.g. global registry ~/.agents/skills or ~/.gemini/config/skills),
 *    returns process.cwd() as the execution workspace where deliverables and .reactive state belong.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(p), path bytes
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function resolveWorkspaceDir(skillPath?: string): string {
  const bound = workspaceContext.getStore();
  if (bound) return bound.root;
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
