import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { JobManager } from '@reactive-skills/runtime';
import { extractJobFlag, resolveSkillId, resolveSkillPath, resolveWorkspaceDir } from './args.js';
import { AxiError } from './errors.js';
import { workspaceContext, WORKSPACE_COMMANDS } from './workspace-context.js';

/**
 * Extract the workspace choice before positional and payload parsers run.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(a), argument count
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
export function extractWorkspace(args: string[]): { args: string[]; explicit?: string; source: string } {
  const filtered: string[] = [];
  let explicit: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg !== '--workspace' && !arg.startsWith('--workspace=')) {
      filtered.push(arg);
      continue;
    }
    const value = arg === '--workspace' ? args[++index] : arg.slice('--workspace='.length);
    if (!value || value.startsWith('--') || explicit !== undefined) {
      throw new AxiError('Pass one nonempty --workspace <directory>', 'VALIDATION_ERROR');
    }
    explicit = value;
  }
  return { args: filtered, explicit: explicit ?? (process.env.WORKSPACE_DIR || undefined), source: explicit !== undefined ? '--workspace' : 'WORKSPACE_DIR' };
}

/**
 * Canonicalize an existing directory before any runtime can create a store.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target on local filesystem)
 * - Complexity: O(d), path depth
 * - Cyclomatic Complexity (CC): target <=5
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function canonicalRoot(value: string): string {
  const root = fs.realpathSync(path.resolve(value));
  if (!fs.statSync(root).isDirectory()) throw new AxiError(`Workspace is not a directory: ${root}`, 'VALIDATION_ERROR');
  return root;
}

/**
 * Locate the user-level discovery catalog. Entries contain roots, never execution state.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(p), path bytes
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function catalogDirectory(): string {
  return path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'reactive-skills', 'workspaces');
}

/**
 * Discover known roots and ancestor stores without scanning descendant directories or events.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms target on local filesystem)
 * - Complexity: O(w + d), catalog entries and caller path depth
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=70%
 * - CRAP Score: target <=25
 */
function candidateRoots(fallback: string, legacyRoot?: string): string[] {
  const roots = new Set([canonicalRoot(fallback)]);
  if (legacyRoot) roots.add(canonicalRoot(legacyRoot));
  let directory = canonicalRoot(process.cwd());
  for (;;) {
    roots.add(directory);
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  const catalog = catalogDirectory();
  if (!fs.existsSync(catalog)) return [...roots];
  for (const entry of fs.readdirSync(catalog)) {
    if (!entry.endsWith('.json')) continue;
    const root: unknown = JSON.parse(fs.readFileSync(path.join(catalog, entry), 'utf8'));
    if (typeof root !== 'string' || !path.isAbsolute(root)) {
      throw new AxiError(`Invalid workspace catalog entry: ${entry}`, 'VALIDATION_ERROR', ['Repair the catalog entry or pass --workspace explicitly.']);
    }
    // Deleted workspaces are stale hints, not permission to recreate their stores.
    if (fs.existsSync(root)) roots.add(canonicalRoot(root));
  }
  return [...roots];
}

/**
 * Publish one idempotent discovery hint atomically; parallel roots never overwrite each other.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target on local filesystem)
 * - Complexity: O(p), canonical path bytes
 * - Cyclomatic Complexity (CC): target <=5
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function rememberRoot(root: string): void {
  const directory = catalogDirectory();
  const name = createHash('sha256').update(root).digest('hex') + '.json';
  const target = path.join(directory, name);
  if (fs.existsSync(target)) return;
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, `${name}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify(root), { mode: 0o600 });
    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

/**
 * Resolve command positionals without interpreting signal or context payloads.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(a), argument count
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function commandTarget(command: string, args: string[]): { skill?: string; job?: string } {
  const { jobId, filteredArgs } = extractJobFlag(args);
  if (command === 'dashboard') return {};
  if (command === 'jobs') {
    const verbs = ['list', 'switch', 'archive'];
    const skill = verbs.includes(filteredArgs[0]) ? filteredArgs[1] : filteredArgs[0];
    const positional = verbs.includes(filteredArgs[0]) || verbs.includes(filteredArgs[1]) ? filteredArgs[2] : undefined;
    return { skill, job: positional || jobId };
  }
  const offset = command === 'events' && /^\d+$/.test(filteredArgs[0]) ? 1 : 0;
  return { skill: filteredArgs[offset], job: jobId };
}

/**
 * Resolve skill metadata under an explicit root before the operation is bound.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target on local filesystem)
 * - Complexity: O(d), existing local and registry discovery
 * - Cyclomatic Complexity (CC): target <=5
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function targetSkillPath(skill: string | undefined, root: string | undefined): string | null {
  if (!skill) return null;
  return root ? workspaceContext.run({ root }, () => resolveSkillPath(skill)) : resolveSkillPath(skill);
}

/**
 * Resolve an omitted skill only when one known workspace can supply the default.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms target on local filesystem)
 * - Complexity: O(w + d), catalog entries and caller path depth
 * - Cyclomatic Complexity (CC): target <=5
 * - Branch Coverage: target >=70%
 * - CRAP Score: target <=25
 */
function defaultBinding(): { root: string; source: string } {
  const fallback = resolveWorkspaceDir();
  const stores = candidateRoots(fallback).filter(root => fs.existsSync(path.join(root, '.reactive', 'skills')));
  if (stores.length > 1) {
    throw new AxiError('Ambiguous workspace for default skill selection', 'VALIDATION_ERROR', stores.map(root => `Pass --workspace ${JSON.stringify(root)}`));
  }
  return { root: stores[0] || canonicalRoot(fallback), source: stores.length ? 'recorded_or_legacy_store' : 'caller_directory' };
}

/**
 * Verify that selected metadata still belongs to its recorded physical workspace.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target excluding existing alias lookup)
 * - Complexity: O(j + d), existing job lookup and path depth
 * - Cyclomatic Complexity (CC): target <=5
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function checkRecordedRoot(root: string, skill: string, reference?: string): boolean {
  const manager = new JobManager(root);
  const job = manager.getJob(skill, reference || manager.getActiveJobId(skill));
  if (job?.workspaceRoot && canonicalRoot(job.workspaceRoot) !== root) {
    throw new AxiError(`Job '${job.id}' records workspace ${job.workspaceRoot}, but was found in ${root}`, 'VALIDATION_ERROR', ['Pass --workspace with the recorded root. Moved stores require an explicit migration.']);
  }
  return Boolean(job);
}

/**
 * Choose one store before booting an engine; competing stores always fail closed.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms target on local filesystem)
 * - Complexity: O(w * j + d), known workspaces, metadata alias lookup and caller depth
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=70%
 * - CRAP Score: target <=25
 */
function selectRoot(skill: string, reference: string | undefined, fallback: string, legacyRoot: string): { root: string; source: string } {
  const stores = candidateRoots(fallback, legacyRoot).filter(root => fs.existsSync(new JobManager(root).getSkillDir(skill)));
  const matches = reference ? stores.filter(root => checkRecordedRoot(root, skill, reference)) : stores;
  const choices = matches.length ? matches : stores;
  if (choices.length > 1) {
    throw new AxiError(`Ambiguous workspace for '${skill}'${reference ? ` job '${reference}'` : ''}`, 'VALIDATION_ERROR', choices.map(root => `Pass --workspace ${JSON.stringify(root)}`));
  }
  const root = choices[0] || canonicalRoot(fallback);
  checkRecordedRoot(root, skill, reference);
  return { root, source: choices.length ? 'recorded_or_legacy_store' : 'caller_directory' };
}

/**
 * Bind every CLI run operation once and attach consistent machine-readable diagnostics.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms target excluding command execution)
 * - Complexity: O(w * j + d + b), discovery plus serialized command output bytes
 * - Cyclomatic Complexity (CC): target <=15
 * - Branch Coverage: target >=70%
 * - CRAP Score: target <=25
 */
export async function withWorkspaceBinding(command: string, args: string[], run: (args: string[]) => Promise<string | void>): Promise<string | void> {
  if (!WORKSPACE_COMMANDS.has(command)) return run(args);
  const selected = extractWorkspace(args);
  const target = commandTarget(command, selected.args);
  const explicitRoot = selected.explicit ? canonicalRoot(selected.explicit) : undefined;
  const skillPath = targetSkillPath(target.skill, explicitRoot);
  if (!skillPath) {
    if (explicitRoot) return executeBound({ root: explicitRoot, source: selected.source }, selected.args, run);
    if (!target.skill && command !== 'dashboard') return executeBound(defaultBinding(), selected.args, run);
    return run(selected.args);
  }
  const skill = resolveSkillId(skillPath);
  const binding = explicitRoot
    ? { root: explicitRoot, source: selected.source }
    : selectRoot(skill, target.job, resolveWorkspaceDir(skillPath), path.dirname(skillPath));
  const found = checkRecordedRoot(binding.root, skill, target.job);
  const explicitEvidenceImport = command === 'emit' && selected.args.some(arg => arg === '--evidence' || arg.startsWith('--evidence='));
  if (target.job && !found && ['state', 'emit'].includes(command) && !explicitEvidenceImport) {
    throw new AxiError(`Job '${target.job}' not found in workspace ${binding.root}; invoke the job explicitly to start it`, 'NOT_FOUND', [`reactive-skills-axi invoke ${target.skill} --job ${target.job} --workspace ${JSON.stringify(binding.root)}`]);
  }
  const output = await executeBound(binding, selected.args, run);
  if (fs.existsSync(new JobManager(binding.root).getSkillDir(skill))) rememberRoot(binding.root);
  return output;
}

/**
 * Run in the selected scope and render additive diagnostics for either output format.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms target excluding command execution)
 * - Complexity: O(b + d), output bytes and caller path depth
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=70%
 * - CRAP Score: target <=25
 */
async function executeBound(binding: { root: string; source: string }, args: string[], run: (args: string[]) => Promise<string | void>): Promise<string | void> {
  const output = await workspaceContext.run({ root: binding.root }, () => run(args));
  if (typeof output !== 'string') return output;
  const diagnostics = {
    workspace_root: binding.root,
    workspace_source: binding.source,
    WORKSPACE_DIR: process.env.WORKSPACE_DIR || 'unset',
    workspace_warning: canonicalRoot(process.cwd()) !== binding.root ? 'caller_directory_differs' : 'none',
  };
  if (output.startsWith('{')) {
    // Folded evidence output is a JSON receipt line followed by the legacy view.
    const boundary = output.indexOf('\n');
    const firstLine = boundary < 0 ? output : output.slice(0, boundary);
    return JSON.stringify({ ...JSON.parse(firstLine), workspace: diagnostics }) + (boundary < 0 ? '' : output.slice(boundary));
  }
  return Object.entries(diagnostics).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n') + '\n' + output;
}
