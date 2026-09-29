import fs from 'node:fs';
import path from 'node:path';
import { directoriesEqual, discoverSkills, runSync } from './engine.js';
import { DistributionOptions, DistributionReport, SkillEntry, SyncReport } from './types.js';

interface ManagedState {
  version: 1;
  central: string;
  links: Record<string, string>;
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

function appendStage(report: DistributionReport, stage: SyncReport): void {
  report.results.push(...stage.results);
  report.orphans.push(...stage.orphans);
  report.errors.push(...stage.errors);
  report.selectionErrors?.push(...(stage.selectionErrors ?? []));
}

export function runDistribution(options: DistributionOptions): DistributionReport {
  const dryRun = options.dryRun ?? false;
  const backup = options.backup ?? true;
  const targetSkills = options.targetSkills?.length
    ? [...new Set(options.targetSkills)]
    : options.targetSkill
      ? [options.targetSkill]
      : undefined;
  const sources = uniquePaths(options.sources);
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

  // An old central directory is a fallback during migration so existing skills survive a move.
  const fallback = previous.central && canonicalPath(previous.central) !== canonicalPath(central) && fs.existsSync(previous.central)
    ? path.resolve(previous.central)
    : undefined;
  const importSources = [...sources, ...(fallback && !sources.some(source => canonicalPath(source) === canonicalPath(fallback)) ? [fallback] : [])];

  if (targetSkills) {
    const known = new Set<string>();
    for (const root of [...sources, central, ...(fallback ? [fallback] : [])]) {
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
  for (const source of sources) {
    for (const skill of discoveredSkills(source).filter(entry => !selectedNames || selectedNames.has(entry.name))) {
      const winner = winners.get(skill.name);
      if (winner) {
        report.collisions.push({ skill: skill.name, winner: winner.path, shadowed: skill.path });
      } else {
        winners.set(skill.name, skill);
      }
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
  } : undefined;

  if (dryRun) {
    if (importOptions) {
      appendStage(report, runSync(importOptions));
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
      appendStage(report, runSync(importOptions));
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
    writeState(options.statePath, { version: 1, central, links: verifiedLinks });
  }
  return report;
}
