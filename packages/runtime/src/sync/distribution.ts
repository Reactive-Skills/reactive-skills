import fs from 'node:fs';
import path from 'node:path';
import { directoriesEqual, discoverSkills, runSync } from './engine.js';
import {
  detectGitRepo,
  GitRepoInfo,
  GitSourceError,
  inspectWorkingTree,
  materializeRef,
  resolveRef,
} from './git-source.js';
import {
  DistributionOptions,
  DistributionReport,
  SkillEntry,
  SkillProvenance,
  SourceSpec,
  SyncReport,
} from './types.js';
import { readSkillVersion } from './versions.js';

interface ManagedState {
  version: 1;
  central: string;
  links: Record<string, string>;
  /** Where each installed skill was copied from; absent in state written by older releases. */
  skills?: Record<string, SkillProvenance>;
}

interface SourceContext {
  /** Directory discovery reads: the source itself, or a temporary export of its ref. */
  readPath: string;
  ref?: string;
  commit?: string;
  repo?: GitRepoInfo;
}

function lstat(entry: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(entry);
  } catch (err: any) {
    if (err.code === 'ENOENT') return undefined;
    throw err;
  }
}

function canonicalPath(entry: string): string {
  let existing = path.resolve(entry);
  const remainder: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    remainder.unshift(path.basename(existing));
    existing = parent;
  }
  const resolved = path.join(fs.realpathSync.native(existing), ...remainder);
  return process.platform === 'win32' || process.platform === 'darwin'
    ? resolved.toLowerCase()
    : resolved;
}

function pathsOverlap(first: string, second: string): boolean {
  const a = canonicalPath(first);
  const b = canonicalPath(second);
  const child = (base: string, candidate: string) => {
    const relative = path.relative(base, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  };
  return child(a, b) || child(b, a);
}

function uniquePaths(entries: string[]): string[] {
  const seen = new Set<string>();
  return entries.map(entry => path.resolve(entry)).filter(entry => {
    const canonical = canonicalPath(entry);
    if (seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  });
}

function uniqueSources(entries: Array<string | SourceSpec>): SourceSpec[] {
  const seen = new Set<string>();
  const specs: SourceSpec[] = [];
  for (const entry of entries) {
    const spec = typeof entry === 'string' ? { path: entry } : entry;
    const resolved = path.resolve(spec.path);
    const canonical = canonicalPath(resolved);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    specs.push({ path: resolved, ...(spec.ref ? { ref: spec.ref } : {}) });
  }
  return specs;
}

function discoveredSkills(root: string): SkillEntry[] {
  return fs.existsSync(root) ? discoverSkills(root) : [];
}

function validSkills(root: string, targetSkills?: string[]): SkillEntry[] {
  const selected = targetSkills ? new Set(targetSkills) : undefined;
  return discoveredSkills(root).filter(skill => skill.isValid && (!selected || selected.has(skill.name)));
}

function linkedSkillNames(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isSymbolicLink())
    .filter(entry => {
      const skill = path.join(root, entry.name);
      return fs.existsSync(path.join(skill, 'SKILL.md')) ||
        fs.existsSync(path.join(skill, 'skill.md')) ||
        fs.existsSync(path.join(skill, 'skill.yaml'));
    })
    .map(entry => entry.name);
}

function readState(statePath: string): ManagedState {
  if (!fs.existsSync(statePath)) return { version: 1, central: '', links: {} };
  const value = JSON.parse(fs.readFileSync(statePath, 'utf8')) as ManagedState;
  if (value.version !== 1 || typeof value.central !== 'string' || !value.links || typeof value.links !== 'object' || Array.isArray(value.links)) {
    throw new Error(`Invalid sync state: ${statePath}`);
  }
  if (Object.entries(value.links).some(([linkPath, target]) => typeof linkPath !== 'string' || typeof target !== 'string')) {
    throw new Error(`Invalid managed links in sync state: ${statePath}`);
  }
  if (value.skills !== undefined && (!value.skills || typeof value.skills !== 'object' || Array.isArray(value.skills))) {
    throw new Error(`Invalid skill provenance in sync state: ${statePath}`);
  }
  return value;
}

function writeState(statePath: string, state: ManagedState): void {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const staging = `${statePath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(staging, JSON.stringify(state, null, 2) + '\n');
    fs.renameSync(staging, statePath);
  } finally {
    if (fs.existsSync(staging)) fs.unlinkSync(staging);
  }
}

function linkPointsTo(linkPath: string, expected: string): boolean {
  if (!lstat(linkPath)?.isSymbolicLink()) return false;
  let target = fs.readlinkSync(linkPath);
  if (process.platform === 'win32') target = target.replace(/^\\\\\?\\/, '');
  const resolved = path.resolve(path.dirname(linkPath), target);
  const normalize = (value: string) => process.platform === 'win32' || process.platform === 'darwin'
    ? path.resolve(value).toLowerCase()
    : path.resolve(value);
  return normalize(resolved) === normalize(expected);
}

function appendStage(report: DistributionReport, stage: SyncReport, originalSource?: (skill: string) => string | undefined): void {
  report.results.push(...stage.results);
  report.orphans.push(...stage.orphans);
  report.errors.push(...stage.errors);
  report.selectionErrors?.push(...(stage.selectionErrors ?? []));
  report.warnings?.push(...(stage.warnings ?? []));
  for (const refusal of stage.refusals ?? []) {
    report.refusals?.push({ ...refusal, source: originalSource?.(refusal.skill) ?? refusal.source });
  }
}

function shortCommit(commit: string | undefined): string {
  return commit ? commit.slice(0, 7) : 'unknown commit';
}

/** Runs a distribution; temporary exports of git refs are removed whether or not it succeeds. */
export function runDistribution(options: DistributionOptions): DistributionReport {
  const temporaryDirs: string[] = [];
  try {
    return distribute(options, temporaryDirs);
  } finally {
    for (const dir of temporaryDirs) fs.rmSync(dir, { recursive: true, force: true });
  }
}

function distribute(options: DistributionOptions, temporaryDirs: string[]): DistributionReport {
  const dryRun = options.dryRun ?? false;
  const backup = options.backup ?? true;
  const targetSkills = options.targetSkills?.length
    ? [...new Set(options.targetSkills)]
    : options.targetSkill
      ? [options.targetSkill]
      : undefined;
  const sourceSpecs = uniqueSources(options.sources);
  const sources = sourceSpecs.map(spec => spec.path);
  const central = path.resolve(options.central);
  const centralKey = canonicalPath(central);
  const physicalSatellites = uniquePaths(options.physicalSatellites).filter(target => canonicalPath(target) !== centralKey);
  const physicalKeys = new Set(physicalSatellites.map(canonicalPath));
  const satellites = uniquePaths(options.satellites).filter(target => canonicalPath(target) !== centralKey && !physicalKeys.has(canonicalPath(target)));
  const targets = [...satellites, ...physicalSatellites];

  const report: DistributionReport = {
    dryRun,
    sourceDir: sources[0] ?? central,
    sourceDirs: sources,
    targetDirs: targets,
    central,
    satellites,
    physicalSatellites,
    skillsFound: 0,
    skillsValid: 0,
    skillsInvalid: 0,
    results: [],
    orphans: [],
    errors: [],
    selectionErrors: [],
    collisions: [],
    removedLinks: [],
    warnings: [],
    refusals: [],
    provenance: {},
  };

  let previous: ManagedState;
  try {
    previous = readState(options.statePath);
    const centralStat = lstat(central);
    if (centralStat && (!centralStat.isDirectory() || centralStat.isSymbolicLink())) {
      report.errors.push(`Central skill directory must be a physical directory: ${central}`);
    }
    for (const source of sources) {
      if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) report.errors.push(`Source directory not found: ${source}`);
      if (pathsOverlap(source, central)) report.errors.push(`Source and central directory overlap: ${source} -> ${central}`);
    }
    for (const target of targets) {
      if (lstat(target)?.isSymbolicLink() && !fs.existsSync(target)) report.errors.push(`Satellite directory is a broken link: ${target}`);
      if (pathsOverlap(target, central)) report.errors.push(`Satellite and central directory overlap: ${target} -> ${central}`);
      for (const source of sources) {
        if (pathsOverlap(source, target)) report.errors.push(`Source and satellite overlap: ${source} -> ${target}`);
      }
    }
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        if (pathsOverlap(targets[i], targets[j])) report.errors.push(`Satellites overlap: ${targets[i]} -> ${targets[j]}`);
      }
    }
  } catch (err: any) {
    report.errors.push(err.message);
    return report;
  }
  if (report.errors.length > 0) return report;

  const contexts = new Map<string, SourceContext>();
  for (const spec of sourceSpecs) {
    try {
      const repo = detectGitRepo(spec.path);
      if (spec.ref) {
        if (!repo) throw new GitSourceError(`Source ${spec.path} is not a git repository, so ref "${spec.ref}" cannot be read`);
        const commit = resolveRef(spec.path, spec.ref);
        const readPath = materializeRef(spec.path, repo, commit, spec.ref);
        temporaryDirs.push(readPath);
        contexts.set(spec.path, { readPath, ref: spec.ref, commit, repo });
      } else {
        contexts.set(spec.path, { readPath: spec.path, repo });
      }
    } catch (err: any) {
      if (err instanceof GitSourceError && !spec.ref) {
        report.warnings?.push(err.message);
        contexts.set(spec.path, { readPath: spec.path });
      } else {
        report.errors.push(err.message);
        report.selectionErrors?.push(err.message);
      }
    }
  }
  if (report.errors.length > 0) return report;
  const readPathOf = (source: string): string => contexts.get(source)?.readPath ?? source;

  // An old central directory is a fallback during migration so existing skills survive a move.
  const fallback = previous.central && canonicalPath(previous.central) !== canonicalPath(central) && fs.existsSync(previous.central)
    ? path.resolve(previous.central)
    : undefined;
  const importSources = [...sources.map(readPathOf), ...(fallback && !sources.some(source => canonicalPath(source) === canonicalPath(fallback)) ? [fallback] : [])];

  if (targetSkills) {
    const known = new Set<string>();
    for (const root of [...sources.map(readPathOf), central, ...(fallback ? [fallback] : [])]) {
      for (const skill of discoveredSkills(root)) known.add(skill.name);
    }
    const unknown = targetSkills.filter(name => !known.has(name));
    if (unknown.length > 0) {
      const error = `Unknown skill${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`;
      report.errors.push(error);
      report.selectionErrors?.push(error);
      return report;
    }
  }

  const winners = new Map<string, SkillEntry>();
  const selectedNames = targetSkills ? new Set(targetSkills) : undefined;
  const winnerSource = new Map<string, string>();
  for (const source of sources) {
    for (const skill of discoveredSkills(readPathOf(source)).filter(entry => !selectedNames || selectedNames.has(entry.name))) {
      const winner = winners.get(skill.name);
      if (winner) {
        report.collisions.push({
          skill: skill.name,
          winner: path.join(winnerSource.get(skill.name)!, skill.name),
          shadowed: path.join(source, skill.name),
        });
      } else {
        winners.set(skill.name, skill);
        winnerSource.set(skill.name, source);
      }
    }
  }
  const originalSource = (skill: string): string | undefined => winnerSource.get(skill);

  const provenance = new Map<string, SkillProvenance>();
  for (const source of sources) {
    const context = contexts.get(source)!;
    const names = [...winners.values()].filter(skill => skill.isValid && winnerSource.get(skill.name) === source).map(skill => skill.name);
    if (names.length === 0) continue;
    let tree: ReturnType<typeof inspectWorkingTree> | undefined;
    if (context.repo && !context.ref) {
      try {
        tree = inspectWorkingTree(source, context.repo, names);
      } catch (err: any) {
        report.warnings?.push(err.message);
      }
    }
    if (tree) {
      const branchLabel = tree.branch ? `branch "${tree.branch}"` : `detached HEAD at ${shortCommit(tree.commit)}`;
      if (tree.commit && (!tree.branch || (tree.defaultBranch && tree.branch !== tree.defaultBranch))) {
        const differing = tree.skillsDifferingFromDefault.length > 0
          ? `; ${tree.skillsDifferingFromDefault.join(', ')} differ from ${tree.defaultBranch}`
          : '';
        report.warnings?.push(
          `Source ${source} is on ${branchLabel}${tree.defaultBranch ? `, not the default branch "${tree.defaultBranch}"` : ''}${differing}`,
        );
      }
      if (tree.dirtySkills.length > 0) {
        report.warnings?.push(
          `Source ${source} (${tree.branch ? `branch "${tree.branch}"` : branchLabel}) has uncommitted changes in: ${tree.dirtySkills.join(', ')}`,
        );
      }
    }
    for (const name of names) {
      const version = readSkillVersion(winners.get(name)!.path);
      provenance.set(name, {
        source,
        ...(context.ref ? { ref: context.ref } : {}),
        ...(!context.ref && tree?.branch ? { branch: tree.branch } : {}),
        ...((context.commit ?? tree?.commit) ? { commit: context.commit ?? tree?.commit } : {}),
        ...(tree?.dirtySkills.includes(name) ? { dirty: true } : {}),
        ...(version ? { version } : {}),
      });
    }
  }

  const planned = new Map<string, SkillEntry>();
  for (const skill of validSkills(central, targetSkills)) planned.set(skill.name, skill);
  if (fallback) {
    for (const skill of validSkills(fallback, targetSkills)) {
      if (!planned.has(skill.name)) planned.set(skill.name, skill);
    }
  }
  for (const [name, skill] of winners) {
    if (skill.isValid) planned.set(name, skill);
  }
  const availableNames = new Set([
    ...winners.keys(),
    ...discoveredSkills(central).map(skill => skill.name),
    ...(fallback ? discoveredSkills(fallback).map(skill => skill.name) : []),
  ]);
  const skillsFound = targetSkills?.length ?? availableNames.size;

  const fallbackNames = new Set(fallback ? validSkills(fallback, targetSkills).map(skill => skill.name) : []);
  const linkedInCentral = linkedSkillNames(central).filter(name => !winners.has(name) && !fallbackNames.has(name));
  if (linkedInCentral.length > 0) {
    report.errors.push(`Central directory contains linked skills without a source to materialize: ${linkedInCentral.join(', ')}`);
    return report;
  }

  const importNames = new Set(importSources.flatMap(root => discoveredSkills(root).map(skill => skill.name)));
  const importTargetSkills = targetSkills?.filter(name => importNames.has(name));
  const shouldSyncImports = importSources.length > 0 && (!targetSkills || (importTargetSkills?.length ?? 0) > 0);
  const importOptions = shouldSyncImports ? {
    sourceDirs: importSources,
    targetDirs: [central],
    ...(targetSkills ? { targetSkills: importTargetSkills } : {}),
    dryRun,
    backup,
    link: false,
    versionGuard: true,
    allowDowngrade: options.allowDowngrade ?? false,
  } : undefined;
  let importStage: SyncReport | undefined;

  if (dryRun) {
    if (importOptions) {
      importStage = runSync(importOptions);
      appendStage(report, importStage, originalSource);
      // A refused skill keeps its installed copy, so satellites would still mirror that copy.
      for (const refusal of importStage.refusals ?? []) {
        const installed = validSkills(central).find(skill => skill.name === refusal.skill);
        if (installed) planned.set(refusal.skill, installed);
      }
    }
    for (const target of satellites) {
      for (const name of planned.keys()) {
        const linkPath = path.join(target, name);
        const expected = path.join(central, name);
        report.results.push({ skill: name, target, action: linkPointsTo(linkPath, expected) ? 'unchanged' : 'linked', reason: 'dry-run' });
      }
    }
    for (const target of physicalSatellites) {
      for (const name of planned.keys()) {
        const destination = path.join(target, name);
        const stat = lstat(destination);
        const source = planned.get(name)!;
        const unchanged = stat?.isDirectory() && !stat.isSymbolicLink() && directoriesEqual(source.path, destination);
        report.results.push({ skill: name, target, action: unchanged ? 'unchanged' : 'mirrored', reason: 'dry-run' });
      }
    }
  } else {
    if (importOptions) {
      importStage = runSync(importOptions);
      appendStage(report, importStage, originalSource);
      if (report.errors.length > 0) return report;
    } else {
      fs.mkdirSync(central, { recursive: true });
    }
    const remainingLinks = linkedSkillNames(central);
    if (remainingLinks.length > 0) {
      report.errors.push(`Central directory still contains linked skills: ${remainingLinks.join(', ')}`);
      return report;
    }
    const hasSkills = validSkills(central, targetSkills).length > 0;
    if (hasSkills && satellites.length > 0) {
      appendStage(report, runSync({ sourceDir: central, targetDirs: satellites, targetSkills, backup, link: true }));
    }
    if (hasSkills && physicalSatellites.length > 0) {
      appendStage(report, runSync({ sourceDir: central, targetDirs: physicalSatellites, targetSkills, backup, link: false }));
    }
    if (report.errors.length > 0) return report;
  }

  const copied = new Set(
    (importStage?.results ?? [])
      .filter(result => result.action === 'mirrored' || result.action === 'unchanged')
      .map(result => result.skill),
  );
  for (const [name, record] of provenance) {
    if (copied.has(name)) report.provenance[name] = record;
  }

  const names = dryRun ? [...planned.keys()] : validSkills(central, targetSkills).map(skill => skill.name);
  report.skillsFound = skillsFound;
  report.skillsValid = names.length;
  report.skillsInvalid = Math.max(0, report.skillsFound - report.skillsValid);
  const desiredLinks = new Map<string, string>();
  for (const target of satellites) {
    for (const name of names) desiredLinks.set(path.join(target, name), path.join(central, name));
  }
  if (targetSkills) {
    const configuredLinkedTargets = new Set(satellites.map(canonicalPath));
    for (const [linkPath, expected] of Object.entries(previous.links)) {
      if (
        configuredLinkedTargets.has(canonicalPath(path.dirname(linkPath))) &&
        !targetSkills.includes(path.basename(linkPath)) &&
        !desiredLinks.has(linkPath)
      ) {
        desiredLinks.set(linkPath, expected);
      }
    }
  }
  if (options.preserveUnselectedLinks) {
    const selectedTargets = new Set(targets.map(canonicalPath));
    for (const [linkPath, expected] of Object.entries(previous.links)) {
      if (!selectedTargets.has(canonicalPath(path.dirname(linkPath))) && !desiredLinks.has(linkPath)) {
        desiredLinks.set(linkPath, expected);
      }
    }
  }
  for (const [linkPath, expected] of Object.entries(previous.links)) {
    if (desiredLinks.has(linkPath) || !linkPointsTo(linkPath, expected)) continue;
    report.removedLinks.push(linkPath);
    report.results.push({ skill: path.basename(linkPath), target: path.dirname(linkPath), action: 'removed_link', reason: dryRun ? 'dry-run' : 'no longer configured' });
    if (!dryRun) fs.unlinkSync(linkPath);
  }
  if (!dryRun) {
    const verifiedLinks = Object.fromEntries([...desiredLinks].filter(([linkPath, expected]) => linkPointsTo(linkPath, expected)));
    const skills: Record<string, SkillProvenance> = {};
    for (const [name, record] of Object.entries(previous.skills ?? {})) {
      if (fs.existsSync(path.join(central, name))) skills[name] = record;
    }
    Object.assign(skills, report.provenance);
    writeState(options.statePath, {
      version: 1,
      central,
      links: verifiedLinks,
      ...(Object.keys(skills).length > 0 ? { skills } : {}),
    });
  }
  return report;
}
