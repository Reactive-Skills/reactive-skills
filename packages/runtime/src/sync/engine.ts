import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  SkillEntry,
  SyncOptions,
  SyncResult,
  SyncReport,
} from './types.js';

const NEVER_SKILLS = new Set([
  '.git', '.docs', '.reactive', '.playwright-mcp', '.backup', '.sync-backups',
  'tests', 'scripts', 'node_modules', 'dist', 'axi',
  '.cache', '.tmp', '.idea', '.vscode',
]);

const EXCLUDE_FROM_SKILL = new Set([
  '.git', '.docs', '.reactive', '.playwright-mcp', '.backup', '.sync-backups',
  'tests', 'scripts', 'node_modules', 'dist',
]);

function discoverSkills(sourceDir: string, targetSkill?: string): SkillEntry[] {
  if (!fs.existsSync(sourceDir)) return [];
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const skills: SkillEntry[] = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (NEVER_SKILLS.has(e.name)) continue;
    if (targetSkill && e.name !== targetSkill) continue;

    const dirPath = path.join(sourceDir, e.name);
    const hasSkillMd =
      fs.existsSync(path.join(dirPath, 'SKILL.md')) ||
      fs.existsSync(path.join(dirPath, 'skill.md'));
    const hasSkillYaml = fs.existsSync(path.join(dirPath, 'skill.yaml'));
    const isValid = hasSkillMd || hasSkillYaml;

    skills.push({
      name: e.name,
      path: dirPath,
      hasSkillMd,
      hasSkillYaml,
      isValid,
    });
  }
  return skills;
}

function getDistributableFiles(skillPath: string): string[] {
  const files: string[] = [];
  function walk(dir: string, rel = ''): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (EXCLUDE_FROM_SKILL.has(e.name)) continue;
      const full = path.join(dir, e.name);
      const relPath = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) {
        walk(full, relPath);
      } else if (e.isFile()) {
        files.push(relPath);
      }
    }
  }
  walk(skillPath);
  return files.sort();
}

function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getFileHashes(skillPath: string, files: string[]): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const f of files) {
    hashes.set(f, hashFile(path.join(skillPath, f)));
  }
  return hashes;
}

function hasExcludedEntryAnywhere(dirPath: string): boolean {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const e of entries) {
    if (EXCLUDE_FROM_SKILL.has(e.name)) return true;
    if (e.isDirectory()) {
      const full = path.join(dirPath, e.name);
      if (hasExcludedEntryAnywhere(full)) return true;
    }
  }
  return false;
}

function getDistributableEntries(skillPath: string): string[] {
  const entries: string[] = [];
  function walk(dir: string, rel = ''): void {
    const subdirs: { rel: string; full: string }[] = [];
    const files: string[] = [];
    const all = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of all) {
      if (EXCLUDE_FROM_SKILL.has(e.name)) continue;
      const relPath = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) {
        subdirs.push({ rel: relPath, full: path.join(dir, e.name) });
      } else if (e.isFile()) {
        files.push(relPath);
      }
    }
    for (const d of subdirs.sort((a, b) => a.rel.localeCompare(b.rel))) {
      entries.push(d.rel);
      walk(d.full, d.rel);
    }
    for (const f of files.sort()) {
      entries.push(f);
    }
  }
  walk(skillPath);
  return entries;
}

function directoriesEqual(srcPath: string, destPath: string): boolean {
  const srcEntries = getDistributableEntries(srcPath);
  const destEntries = getDistributableEntries(destPath);

  if (srcEntries.length !== destEntries.length) return false;
  for (let i = 0; i < srcEntries.length; i++) {
    if (srcEntries[i] !== destEntries[i]) return false;
  }

  const srcFiles = getDistributableFiles(srcPath);
  const destFiles = getDistributableFiles(destPath);

  if (srcFiles.length !== destFiles.length) return false;
  for (let i = 0; i < srcFiles.length; i++) {
    if (srcFiles[i] !== destFiles[i]) return false;
  }

  const srcHashes = getFileHashes(srcPath, srcFiles);
  const destHashes = getFileHashes(destPath, destFiles);

  for (const [file, hash] of srcHashes) {
    if (destHashes.get(file) !== hash) return false;
  }

  if (hasExcludedEntryAnywhere(destPath)) return false;
  return true;
}

function copyToStaging(srcPath: string, stagingPath: string): void {
  const entries = fs.readdirSync(srcPath, { withFileTypes: true });
  fs.mkdirSync(stagingPath, { recursive: true });

  for (const e of entries) {
    if (EXCLUDE_FROM_SKILL.has(e.name)) continue;
    const s = path.join(srcPath, e.name);
    const d = path.join(stagingPath, e.name);
    if (e.isDirectory()) {
      copyToStaging(s, d);
    } else if (e.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function createExternalBackup(targetDir: string, skillName: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = crypto.randomBytes(6).toString('hex');
  const backupRoot = path.join(targetDir, '.sync-backups', skillName);
  const backupPath = path.join(backupRoot, `${ts}-${suffix}`);
  fs.mkdirSync(backupPath, { recursive: true });

  const destSkillPath = path.join(targetDir, skillName);
  if (fs.existsSync(destSkillPath)) {
    const entries = fs.readdirSync(destSkillPath, { withFileTypes: true });
    for (const e of entries) {
      const s = path.join(destSkillPath, e.name);
      const d = path.join(backupPath, e.name);
      if (e.isDirectory()) {
        fs.cpSync(s, d, { recursive: true });
      } else if (e.isFile()) {
        fs.copyFileSync(s, d);
      }
    }
  }
  return backupPath;
}

function removeDirectoryRecursive(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dirPath, e.name);
    if (e.isDirectory()) {
      removeDirectoryRecursive(full);
    } else {
      fs.unlinkSync(full);
    }
  }
  fs.rmdirSync(dirPath);
}

function atomicSwap(stagingPath: string, destPath: string): void {
  const destParent = path.dirname(destPath);
  const destName = path.basename(destPath);
  let oldPath: string | undefined;

  try {
    if (fs.existsSync(destPath)) {
      oldPath = path.join(
        destParent,
        `.old-${destName}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      );
      fs.renameSync(destPath, oldPath);
    }
    fs.renameSync(stagingPath, destPath);
    if (oldPath && fs.existsSync(oldPath)) {
      removeDirectoryRecursive(oldPath);
      oldPath = undefined;
    }
  } catch (err) {
    if (oldPath && fs.existsSync(oldPath)) {
      try {
        fs.renameSync(oldPath, destPath);
      } catch {
      }
    }
    throw err;
  }
}

function pathsOverlap(sourceDir: string, targetDir: string): boolean {
  const absSource = path.resolve(sourceDir);
  const absTarget = path.resolve(targetDir);
  const source = process.platform === 'win32' ? absSource.toLowerCase() : absSource;
  const target = process.platform === 'win32' ? absTarget.toLowerCase() : absTarget;

  const sourceToTarget = path.relative(source, target);
  const targetToSource = path.relative(target, source);
  const isSameOrChild = (relative: string) =>
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative));

  return isSameOrChild(sourceToTarget) || isSameOrChild(targetToSource);
}

export function runSync(options: SyncOptions): SyncReport {
  const {
    sourceDir,
    sourceDirs,
    targetDirs,
    targetSkill,
    dryRun = false,
    backup = true,
    link = false,
  } = options;

  const sources = sourceDirs && sourceDirs.length > 0
    ? sourceDirs
    : (sourceDir ? [sourceDir] : []);

  const primarySource = sources[0] || sourceDir || '';

  const report: SyncReport = {
    dryRun,
    sourceDir: primarySource,
    sourceDirs: sources,
    targetDirs,
    skillsFound: 0,
    skillsValid: 0,
    skillsInvalid: 0,
    results: [],
    orphans: [],
    errors: [],
  };

  if (sources.length === 0) {
    report.errors.push(`No source directory provided`);
    return report;
  }

  const skillsMap = new Map<string, SkillEntry>();
  for (const src of sources) {
    if (!fs.existsSync(src)) {
      report.errors.push(`Source directory not found: ${src}`);
      continue;
    }
    const found = discoverSkills(src, targetSkill);
    for (const skill of found) {
      if (!skillsMap.has(skill.name)) {
        skillsMap.set(skill.name, skill);
      }
    }
  }

  const skills = Array.from(skillsMap.values());
  report.skillsFound = skills.length;
  report.skillsValid = skills.filter(s => s.isValid).length;
  report.skillsInvalid = skills.filter(s => !s.isValid).length;

  for (const targetDir of targetDirs) {
    const overlapping = sources.find(src => pathsOverlap(src, targetDir));
    if (overlapping) {
      report.errors.push(`Source and destination overlap: ${overlapping} -> ${targetDir}`);
      for (const skill of skills) {
        report.results.push({
          skill: skill.name,
          target: targetDir,
          action: 'skipped_overlap',
          reason: 'Source and destination overlap; skipping to prevent data loss',
        });
      }
      continue;
    }

    if (!dryRun) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const skill of skills) {
      const destPath = path.join(targetDir, skill.name);

      if (!skill.isValid) {
        report.results.push({
          skill: skill.name,
          target: targetDir,
          action: 'skipped_invalid',
          reason: 'Missing SKILL.md or skill.yaml',
        });
        continue;
      }

      if (link) {
        let lstat: fs.Stats | undefined;
        try {
          lstat = fs.lstatSync(destPath);
        } catch {
          lstat = undefined;
        }

        let backupPath: string | undefined;

        if (lstat) {
          if (lstat.isSymbolicLink()) {
            let currentTarget: string | undefined;
            try {
              currentTarget = fs.readlinkSync(destPath);
              currentTarget = path.resolve(path.dirname(destPath), currentTarget);
            } catch {
              currentTarget = undefined;
            }
            if (currentTarget && path.resolve(currentTarget) === path.resolve(skill.path)) {
              report.results.push({
                skill: skill.name,
                target: targetDir,
                action: 'unchanged',
              });
              continue;
            }
            if (dryRun) {
              report.results.push({
                skill: skill.name,
                target: targetDir,
                action: 'linked',
                reason: 'dry-run',
              });
              continue;
            }
            fs.unlinkSync(destPath);
          } else {
            if (dryRun) {
              report.results.push({
                skill: skill.name,
                target: targetDir,
                action: 'linked',
                reason: 'dry-run',
              });
              continue;
            }
            if (backup) {
              backupPath = createExternalBackup(targetDir, skill.name);
              report.results.push({
                skill: skill.name,
                target: targetDir,
                action: 'backed_up',
                backupPath,
              });
            }
            removeDirectoryRecursive(destPath);
          }
        }

        if (dryRun) {
          report.results.push({
            skill: skill.name,
            target: targetDir,
            action: 'linked',
            reason: 'dry-run',
          });
          continue;
        }

        const linkType = process.platform === 'win32' ? 'junction' : 'dir';
        try {
          fs.symlinkSync(path.resolve(skill.path), destPath, linkType);
          report.results.push({
            skill: skill.name,
            target: targetDir,
            action: 'linked',
            backupPath,
          });
        } catch (linkErr: any) {
          report.errors.push(
            `Link failed for ${skill.name} to ${targetDir}: ${linkErr.message}`,
          );
        }
        continue;
      }

      const alreadyIdentical = fs.existsSync(destPath) && directoriesEqual(skill.path, destPath);

      if (alreadyIdentical) {
        report.results.push({
          skill: skill.name,
          target: targetDir,
          action: 'unchanged',
        });
        continue;
      }

      if (dryRun) {
        report.results.push({
          skill: skill.name,
          target: targetDir,
          action: 'mirrored',
          reason: 'dry-run',
        });
        continue;
      }

      let backupPath: string | undefined;
      let stagingPath: string | undefined;

      try {
        if (backup && fs.existsSync(destPath)) {
          backupPath = createExternalBackup(targetDir, skill.name);
          report.results.push({
            skill: skill.name,
            target: targetDir,
            action: 'backed_up',
            backupPath,
          });
        }

        stagingPath = path.join(targetDir, `.staging-${skill.name}-${Date.now()}`);
        copyToStaging(skill.path, stagingPath);

        if (!directoriesEqual(skill.path, stagingPath)) {
          throw new Error('Staging validation failed: payload does not match source');
        }

        atomicSwap(stagingPath, destPath);
        stagingPath = undefined;

        report.results.push({
          skill: skill.name,
          target: targetDir,
          action: 'mirrored',
          backupPath,
        });
      } catch (err: any) {
        if (stagingPath && fs.existsSync(stagingPath)) {
          removeDirectoryRecursive(stagingPath);
        }
        stagingPath = undefined;

        // atomicSwap restores the previous destination on failure, so the
        // destination should already be intact. If it is missing (e.g. the
        // rename-back also failed), fall back to the external backup so the
        // destination is never lost.
        if (backupPath && !fs.existsSync(destPath)) {
          const destSkillPath = path.join(targetDir, skill.name);
          const entries = fs.readdirSync(backupPath, { withFileTypes: true });
          fs.mkdirSync(destSkillPath, { recursive: true });
          for (const e of entries) {
            const s = path.join(backupPath, e.name);
            const d = path.join(destSkillPath, e.name);
            if (e.isDirectory()) {
              fs.cpSync(s, d, { recursive: true });
            } else if (e.isFile()) {
              fs.copyFileSync(s, d);
            }
          }
        }
        report.errors.push(
          `Mirror failed for ${skill.name} to ${targetDir}: ${err.message}`,
        );
      }
    }

    if (fs.existsSync(targetDir)) {
      const destEntries = fs.readdirSync(targetDir, { withFileTypes: true });
      const destNames = destEntries
        .filter(e =>
          (e.isDirectory() || e.isSymbolicLink()) &&
          !e.name.startsWith('.staging') &&
          !e.name.startsWith('.old-') &&
          e.name !== '.sync-backups',
        )
        .map(e => e.name);
      const sourceNames = new Set(skills.map(s => s.name));
      const orphans = destNames.filter(n => !sourceNames.has(n));
      if (orphans.length > 0) {
        report.orphans.push({ target: targetDir, names: orphans });
      }
    }
  }

  return report;
}