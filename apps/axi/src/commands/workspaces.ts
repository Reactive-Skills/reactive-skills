import fs from 'node:fs';
import path from 'node:path';
import { AxiError } from '../errors.js';
import { isRecordedRoot, recordedRoots, rememberRoot } from '../workspace-binding.js';
import { renderDetail, renderHelp, renderList, renderOutput } from '../toon.js';

/** Dependency, build and system folders that never hold a workspace worth registering. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', 'target', 'bin', 'obj', 'vendor',
  '.next', '.nuxt', '.turbo', '.cache', '.pnpm-store', '.yarn', '.gradle', '.venv', 'venv', '__pycache__',
  '.nx', '.vscode', '.idea', '.github', '.angular', '.svelte-kit', '.parcel-cache', '.terraform', '.mypy_cache', '.pytest_cache', '.tox', '.nuget',
  'coverage', '$RECYCLE.BIN', 'System Volume Information',
]);
const DEFAULT_MAX_DEPTH = 3;

interface Options {
  action: 'register' | 'list';
  paths: string[];
  scans: string[];
  maxDepth: number;
  dryRun: boolean;
  json: boolean;
}

interface Skip { path: string; reason: string }

/**
 * Parse `workspaces` arguments; unknown flags fail instead of being silently ignored.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(a), argument count
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=15
 */
function parseOptions(args: string[]): Options {
  const [action, ...rest] = args;
  if (action !== 'register' && action !== 'list') {
    throw new AxiError(`Unknown workspaces action: ${action ?? '(none)'}`, 'VALIDATION_ERROR', ['Usage: reactive-skills-axi workspaces register <paths...> [--scan <parent>] [--max-depth <n>] [--dry-run]', '       reactive-skills-axi workspaces list']);
  }
  const options: Options = { action, paths: [], scans: [], maxDepth: DEFAULT_MAX_DEPTH, dryRun: false, json: false };
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--scan' || arg === '--max-depth') {
      const value = rest[++index];
      if (!value || value.startsWith('--')) throw new AxiError(`Pass a value after ${arg}`, 'VALIDATION_ERROR');
      if (arg === '--scan') options.scans.push(value);
      else if (/^\d+$/.test(value)) options.maxDepth = Number(value);
      else throw new AxiError('--max-depth must be a whole number of directory levels', 'VALIDATION_ERROR');
    } else if (arg.startsWith('--')) throw new AxiError(`Unknown flag: ${arg}`, 'VALIDATION_ERROR');
    else options.paths.push(arg);
  }
  if (action === 'register' && !options.paths.length && !options.scans.length) {
    throw new AxiError('Pass at least one workspace path or --scan <parent>', 'VALIDATION_ERROR', ['Example: reactive-skills-axi workspaces register --scan ~/projects --dry-run']);
  }
  return options;
}

/**
 * True when the directory holds an event-store folder; the store itself is never opened.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target on local filesystem)
 * - Complexity: O(1), one stat
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function hasStore(root: string): boolean {
  try {
    return fs.statSync(path.join(root, '.reactive', 'skills')).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Breadth-first search for workspace roots below a parent, to a depth limit (the parent is depth 0).
 * Symlinks are not followed, dependency and build folders are not entered, and nothing is written.
 * # Performance & Risk Budget
 * - Tier: P3 (about 4ms per scanned folder on a WSL-mounted drive; bound the scan with --max-depth)
 * - Complexity: O(n), directories within the depth limit that are not skipped
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=20
 */
export function scanForWorkspaces(parent: string, maxDepth: number): { roots: string[]; scanned: number; skipped: number } {
  const roots: string[] = [];
  let scanned = 0;
  let skipped = 0;
  const queue: Array<[string, number]> = [[parent, 0]];
  for (let head = 0; head < queue.length; head++) {
    const [directory, depth] = queue[head];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue; // unreadable folders are not workspaces we can use
    }
    scanned++;
    // The listing already says whether `.reactive` exists, so most folders cost no extra stat.
    if (entries.some(entry => entry.name === '.reactive' && entry.isDirectory()) && hasStore(directory)) roots.push(directory);
    if (depth >= maxDepth) continue;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue; // Dirent reports symlinks as links, so they are not followed
      if (SKIPPED_DIRECTORIES.has(entry.name) || entry.name === '.reactive') skipped++;
      else queue.push([path.join(directory, entry.name), depth + 1]);
    }
  }
  return { roots, scanned, skipped };
}

/**
 * Canonicalize a user-given directory, or explain why it cannot be used.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target on local filesystem)
 * - Complexity: O(d), path depth
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function canonicalDirectory(value: string): { root: string } | Skip {
  let root: string;
  try {
    root = fs.realpathSync(path.resolve(value));
  } catch {
    return { path: path.resolve(value), reason: 'not_found' };
  }
  return fs.statSync(root).isDirectory() ? { root } : { path: root, reason: 'not_a_directory' };
}

/**
 * Register (or preview registering) existing workspace roots, or list the registry.
 * Idempotent: roots already recorded are reported, never rewritten, and stores are never touched.
 * # Performance & Risk Budget
 * - Tier: P3 (about 4ms per scanned folder on a WSL-mounted drive; bound the scan with --max-depth)
 * - Complexity: O(a + n + r), arguments, scanned directories and registry entries
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=70%
 * - CRAP Score: target <=25
 */
export async function workspacesCommand(args: string[]): Promise<string> {
  const options = parseOptions(args);
  if (options.action === 'list') {
    const workspaces = recordedRoots().sort().map(root => ({ root, has_store: hasStore(root) }));
    if (options.json) return JSON.stringify({ action: 'list', workspaces });
    return renderOutput([
      renderDetail('workspaces', { action: 'list', registered: workspaces.length }, [{ type: 'field', key: 'action' }, { type: 'field', key: 'registered' }]),
      renderList('workspace', workspaces, [{ type: 'field', key: 'root' }, { type: 'boolYesNo', key: 'has_store' }]),
      renderHelp(['A registered root with has_store: no no longer holds a store and is ignored by the dashboard.']),
    ]);
  }

  const found = new Set<string>();
  const skipped: Skip[] = [];
  let scanned = 0;
  let skippedDirectories = 0;
  for (const value of options.paths) {
    const target = canonicalDirectory(value);
    if ('reason' in target) skipped.push(target);
    else if (hasStore(target.root)) found.add(target.root);
    else skipped.push({ path: target.root, reason: 'no_store' });
  }
  for (const value of options.scans) {
    const target = canonicalDirectory(value);
    if ('reason' in target) {
      skipped.push(target);
      continue;
    }
    const result = scanForWorkspaces(target.root, options.maxDepth);
    result.roots.forEach(root => found.add(root));
    scanned += result.scanned;
    skippedDirectories += result.skipped;
  }

  const added: Array<{ root: string }> = [];
  const alreadyKnown: Array<{ root: string }> = [];
  for (const root of [...found].sort()) {
    if (isRecordedRoot(root)) alreadyKnown.push({ root });
    else {
      if (!options.dryRun) rememberRoot(root);
      added.push({ root });
    }
  }
  const report = { action: 'register', dry_run: options.dryRun, max_depth: options.maxDepth, scanned_directories: scanned, skipped_directories: skippedDirectories, added, already_known: alreadyKnown, skipped };
  if (options.json) return JSON.stringify(report);
  return renderOutput([
    renderDetail('workspaces', { ...report, dry_run: options.dryRun ? 'yes' : 'no', added: added.length, already_known: alreadyKnown.length, skipped: skipped.length }, [
      { type: 'field', key: 'action' }, { type: 'field', key: 'dry_run' }, { type: 'field', key: 'max_depth' },
      { type: 'field', key: 'scanned_directories' }, { type: 'field', key: 'skipped_directories' },
      { type: 'field', key: 'added' }, { type: 'field', key: 'already_known' }, { type: 'field', key: 'skipped' },
    ]),
    renderList('added', added, [{ type: 'field', key: 'root' }]),
    renderList('already_known', alreadyKnown, [{ type: 'field', key: 'root' }]),
    renderList('skipped', skipped, [{ type: 'field', key: 'path' }, { type: 'field', key: 'reason' }]),
    renderHelp([
      options.dryRun ? 'Dry run: nothing was written. Repeat without --dry-run to register the added roots.' : 'Run `reactive-skills-axi dashboard` to see the jobs from every registered workspace.',
      'Stores are only read for their folder name, never opened, changed or moved.',
    ]),
  ]);
}
