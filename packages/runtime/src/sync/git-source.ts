import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NEVER_SKILLS } from './engine.js';

const SKILL_MARKERS = new Set(['SKILL.md', 'skill.md', 'skill.yaml']);
const GIT_MAX_BUFFER = 1024 * 1024 * 1024;
const INHERITED_GIT_VARIABLES = [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_PREFIX', 'GIT_NAMESPACE',
];

export interface GitRepoInfo {
  /** Path of the source folder relative to the repository root, with a trailing slash or empty. */
  prefix: string;
}

export interface GitSourceState {
  /** Current branch, or undefined for a detached or unborn HEAD. */
  branch?: string;
  /** HEAD commit, or undefined for a repository without commits. */
  commit?: string;
  defaultBranch?: string;
  /** Selected skills with uncommitted changes (tracked or untracked). */
  dirtySkills: string[];
  /** Selected skills whose committed content differs from the default branch. */
  skillsDifferingFromDefault: string[];
}

export class GitSourceError extends Error {}

function gitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of INHERITED_GIT_VARIABLES) delete env[name];
  // Inspecting a source must never write to it, including the opportunistic index refresh.
  env.GIT_OPTIONAL_LOCKS = '0';
  env.GIT_TERMINAL_PROMPT = '0';
  return env;
}

function runGit(cwd: string, args: string[]): Buffer {
  return execFileSync('git', args, {
    cwd,
    env: gitEnv(),
    maxBuffer: GIT_MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function tryGit(cwd: string, args: string[]): string | undefined {
  try {
    return runGit(cwd, args).toString('utf8').trim();
  } catch {
    return undefined;
  }
}

function gitMessage(err: any): string {
  const stderr = err?.stderr ? err.stderr.toString('utf8').trim() : '';
  return stderr || err?.message || String(err);
}

/**
 * Describes the repository a source folder lives in, or returns undefined when the folder is not
 * inside a git work tree. Throws GitSourceError when git cannot be used for another reason.
 */
export function detectGitRepo(sourceDir: string): GitRepoInfo | undefined {
  let prefix: string;
  try {
    prefix = runGit(sourceDir, ['rev-parse', '--show-prefix']).toString('utf8').trim();
  } catch (err: any) {
    if (err?.code === 'ENOENT' && err?.syscall?.startsWith('spawn')) return undefined;
    const message = gitMessage(err);
    if (/not a git repository/i.test(message)) return undefined;
    throw new GitSourceError(`Cannot inspect git state of ${sourceDir}: ${message}`);
  }
  // A bare repository or the inside of .git has no work tree to treat as a source.
  if (tryGit(sourceDir, ['rev-parse', '--is-inside-work-tree']) !== 'true') return undefined;
  return { prefix };
}

export function validateRefName(ref: string): void {
  if (ref.length === 0 || ref.startsWith('-') || /[\0-\x1f\x7f]/.test(ref)) {
    throw new GitSourceError(`Invalid ref: ${JSON.stringify(ref)}`);
  }
}

/** Resolves a branch, tag or commit to a full commit SHA without reading the work tree. */
export function resolveRef(sourceDir: string, ref: string): string {
  validateRefName(ref);
  try {
    return runGit(sourceDir, ['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`])
      .toString('utf8').trim();
  } catch {
    throw new GitSourceError(`Ref "${ref}" does not resolve to a commit in ${sourceDir}`);
  }
}

interface TreeEntry {
  mode: string;
  type: string;
  oid: string;
  path: string;
}

function parseTree(output: Buffer): TreeEntry[] {
  const entries: TreeEntry[] = [];
  for (const record of output.toString('utf8').split('\0')) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    const [mode, type, oid] = record.slice(0, tab).split(' ');
    entries.push({ mode, type, oid, path: record.slice(tab + 1) });
  }
  return entries;
}

function readBlobs(cwd: string, oids: string[]): Map<string, Buffer> {
  const blobs = new Map<string, Buffer>();
  if (oids.length === 0) return blobs;
  const unique = [...new Set(oids)];
  const output = execFileSync('git', ['cat-file', '--batch'], {
    cwd,
    env: gitEnv(),
    input: `${unique.join('\n')}\n`,
    maxBuffer: GIT_MAX_BUFFER,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let offset = 0;
  for (const oid of unique) {
    const headerEnd = output.indexOf(0x0a, offset);
    const [, type, size] = output.subarray(offset, headerEnd).toString('utf8').split(' ');
    if (type !== 'blob') throw new GitSourceError(`Unexpected git object ${oid}`);
    const start = headerEnd + 1;
    const end = start + Number(size);
    blobs.set(oid, output.subarray(start, end));
    offset = end + 1;
  }
  return blobs;
}

function insideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/**
 * Writes the committed skill folders of a source at a commit into a fresh temporary directory.
 * The repository is only read with git plumbing; nothing is checked out. Folders that discovery
 * would list without a skill marker are created empty so they are still reported as invalid.
 */
export function materializeRef(sourceDir: string, repo: GitRepoInfo, commit: string, ref: string): string {
  const treeish = repo.prefix ? `${commit}:${repo.prefix.replace(/\/$/, '')}` : commit;
  let entries: TreeEntry[];
  try {
    entries = parseTree(runGit(sourceDir, ['ls-tree', '-r', '-z', '--full-tree', treeish]));
  } catch (err: any) {
    throw new GitSourceError(`Source folder ${sourceDir} does not exist at ref "${ref}": ${gitMessage(err)}`);
  }

  const grouped = new Map<string, TreeEntry[]>();
  for (const entry of entries) {
    const top = entry.path.split('/')[0];
    if (NEVER_SKILLS.has(top) || !entry.path.includes('/')) continue;
    const list = grouped.get(top) ?? [];
    list.push(entry);
    grouped.set(top, list);
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-sync-ref-'));
  try {
    for (const [name, group] of grouped) {
      fs.mkdirSync(path.join(root, name), { recursive: true });
      const isSkill = group.some(entry => {
        const parts = entry.path.split('/');
        return parts.length === 2 && SKILL_MARKERS.has(parts[1]);
      });
      if (!isSkill) continue;

      const files = group.filter(entry => entry.type === 'blob');
      const blobs = readBlobs(sourceDir, files.map(entry => entry.oid));
      for (const entry of files) {
        const destination = path.join(root, entry.path);
        if (!insideRoot(root, destination)) throw new GitSourceError(`Refusing path outside the source: ${entry.path}`);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        const content = blobs.get(entry.oid)!;
        if (entry.mode === '120000') {
          fs.symlinkSync(content.toString('utf8'), destination);
        } else {
          fs.writeFileSync(destination, content);
          if (entry.mode === '100755') fs.chmodSync(destination, 0o755);
        }
      }
    }
  } catch (err) {
    fs.rmSync(root, { recursive: true, force: true });
    throw err;
  }
  return root;
}

function resolveDefaultBranch(sourceDir: string): string | undefined {
  const remoteHead = tryGit(sourceDir, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (remoteHead) {
    const name = remoteHead.replace(/^origin\//, '');
    if (tryGit(sourceDir, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`])) return name;
  }
  const configured = tryGit(sourceDir, ['config', '--get', 'init.defaultBranch']);
  const candidates = [...(configured ? [configured] : []), 'main', 'master'];
  return candidates.find(name => tryGit(sourceDir, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]));
}

function skillOf(repoPath: string, prefix: string, selected: Set<string>): string | undefined {
  if (!repoPath.startsWith(prefix)) return undefined;
  const name = repoPath.slice(prefix.length).split('/')[0];
  return selected.has(name) ? name : undefined;
}

/** Reads branch, commit and change state for the selected skills of a working-tree source. */
export function inspectWorkingTree(sourceDir: string, repo: GitRepoInfo, skills: string[]): GitSourceState {
  const selected = new Set(skills);
  const branch = tryGit(sourceDir, ['symbolic-ref', '--quiet', '--short', 'HEAD']) || undefined;
  const commit = tryGit(sourceDir, ['rev-parse', '--verify', '--quiet', 'HEAD']) || undefined;
  const defaultBranch = resolveDefaultBranch(sourceDir);
  const state: GitSourceState = { branch, commit, defaultBranch, dirtySkills: [], skillsDifferingFromDefault: [] };
  if (skills.length === 0) return state;

  const dirty = new Set<string>();
  try {
    const status = runGit(sourceDir, [
      '--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...skills.map(name => `:(literal)${name}`),
    ]).toString('utf8').split('\0');
    for (let i = 0; i < status.length; i++) {
      const record = status[i];
      if (record.length < 4) continue;
      const code = record.slice(0, 2);
      const names = [skillOf(record.slice(3), repo.prefix, selected)];
      if (code.includes('R') || code.includes('C')) names.push(skillOf(status[++i] ?? '', repo.prefix, selected));
      for (const name of names) if (name) dirty.add(name);
    }
  } catch (err: any) {
    throw new GitSourceError(`Cannot read git status of ${sourceDir}: ${gitMessage(err)}`);
  }
  state.dirtySkills = skills.filter(name => dirty.has(name));

  if (defaultBranch && commit && branch !== defaultBranch) {
    const differing = new Set<string>();
    const changed = tryGit(sourceDir, [
      'diff', '--name-only', '-z', '--no-renames', `refs/heads/${defaultBranch}`, 'HEAD', '--',
      ...skills.map(name => `:(literal)${name}`),
    ]);
    for (const repoPath of (changed ?? '').split('\0')) {
      const name = skillOf(repoPath, repo.prefix, selected);
      if (name) differing.add(name);
    }
    state.skillsDifferingFromDefault = skills.filter(name => differing.has(name));
  }
  return state;
}
