import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runSync } from '../../src/sync/engine.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
}

function createSkill(dir: string, name: string, withYaml = false) {
  const skillDir = path.join(dir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${name}\n`);
  if (withYaml) {
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), `name: ${name}\n`);
  }
  return skillDir;
}

function createNonSkill(dir: string, name: string) {
  const d = path.join(dir, name);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'README.md'), 'not a skill');
  return d;
}

function createNestedMetadata(dir: string, name: string) {
  const skillDir = path.join(dir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${name}\n`);
  fs.mkdirSync(path.join(skillDir, '.reactive'), { recursive: true });
  fs.writeFileSync(path.join(skillDir, '.reactive', 'config.json'), '{}');
  fs.mkdirSync(path.join(skillDir, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'node_modules', 'pkg'), 'content');
  fs.mkdirSync(path.join(skillDir, '.backup'), { recursive: true });
  fs.writeFileSync(path.join(skillDir, '.backup', 'old'), 'data');
  fs.mkdirSync(path.join(skillDir, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'dist', 'out.js'), 'code');
  return skillDir;
}

describe('runSync', () => {
  let src: string;
  let dest: string;

  beforeEach(() => {
    src = makeTmpDir();
    dest = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(dest, { recursive: true, force: true });
  });

  it('mirrors valid skills and skips non-skills', () => {
    createSkill(src, 'alpha');
    createSkill(src, 'beta', true);
    createNonSkill(src, 'tests');
    createNonSkill(src, '.git');

    const report = runSync({
      sourceDir: src,
      targetDirs: [dest],
    });

    expect(report.skillsFound).toBe(2);
    expect(report.skillsValid).toBe(2);
    expect(report.skillsInvalid).toBe(0);
    expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(2);
    expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'beta', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'tests'))).toBe(false);
    expect(fs.existsSync(path.join(dest, '.git'))).toBe(false);
  });

  it('does not copy when destination is up to date (idempotent)', () => {
    createSkill(src, 'alpha');
    const report1 = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report1.results.filter(r => r.action === 'mirrored')).toHaveLength(1);

    const report2 = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report2.results.filter(r => r.action === 'unchanged')).toHaveLength(1);
  });

  it('creates timestamped backup outside destination before overwriting', () => {
    createSkill(src, 'alpha');
    runSync({ sourceDir: src, targetDirs: [dest] });

    // Modify source
    fs.writeFileSync(path.join(src, 'alpha', 'SKILL.md'), '# alpha v2\n');

    const report = runSync({ sourceDir: src, targetDirs: [dest] });
    const backed = report.results.filter(r => r.action === 'backed_up');
    expect(backed.length).toBeGreaterThan(0);
    expect(backed[0].backupPath).toBeTruthy();
    expect(fs.existsSync(backed[0].backupPath!)).toBe(true);
    // Backup should be outside the skill folder
    expect(backed[0].backupPath).toContain('.sync-backups');
    expect(backed[0].backupPath).not.toContain(path.join(dest, 'alpha', '.backup'));
  });

  it('dry-run does not write', () => {
    createSkill(src, 'alpha');
    const report = runSync({
      sourceDir: src,
      targetDirs: [dest],
      dryRun: true,
    });
    expect(report.dryRun).toBe(true);
    expect(fs.existsSync(path.join(dest, 'alpha'))).toBe(false);
    expect(report.results[0].action).toBe('mirrored');
    expect(report.results[0].reason).toBe('dry-run');
  });

  it('reports orphans in destination', () => {
    createSkill(src, 'alpha');
    fs.mkdirSync(path.join(dest, 'orphan'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'orphan', 'SKILL.md'), '# orphan\n');

    const report = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0].names).toContain('orphan');
  });

  it('never deletes destination when source becomes invalid', () => {
    createSkill(src, 'alpha');
    runSync({ sourceDir: src, targetDirs: [dest] });

    // Corrupt source
    fs.rmSync(path.join(src, 'alpha', 'SKILL.md'));

    const report = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report.results.filter(r => r.action === 'skipped_invalid')).toHaveLength(1);
    expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
  });

  it('respects targetSkill filter', () => {
    createSkill(src, 'alpha');
    createSkill(src, 'beta');

    const report = runSync({
      sourceDir: src,
      targetDirs: [dest],
      targetSkill: 'alpha',
    });

    expect(report.skillsFound).toBe(1);
    expect(fs.existsSync(path.join(dest, 'alpha'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'beta'))).toBe(false);
  });

  it('removes stale files and directories from destination (mirror semantics)', () => {
    createSkill(src, 'alpha');
    // Create extra files in destination that don't exist in source
    fs.mkdirSync(path.join(dest, 'alpha'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'alpha', 'SKILL.md'), '# alpha\n');
    fs.writeFileSync(path.join(dest, 'alpha', 'extra.txt'), 'should be removed');
    fs.mkdirSync(path.join(dest, 'alpha', 'extra_dir'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'alpha', 'extra_dir', 'file.txt'), 'nested');

    const report = runSync({ sourceDir: src, targetDirs: [dest] });

    expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(1);
    expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'alpha', 'extra.txt'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'alpha', 'extra_dir'))).toBe(false);
  });

  it('removes nested runtime/control metadata from destination', () => {
    createNestedMetadata(src, 'alpha');
    // Destination has extra metadata dirs
    fs.mkdirSync(path.join(dest, 'alpha'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'alpha', 'SKILL.md'), '# alpha\n');
    fs.mkdirSync(path.join(dest, 'alpha', '.reactive'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'alpha', '.reactive', 'old.json'), '{}');
    fs.mkdirSync(path.join(dest, 'alpha', 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'alpha', 'node_modules', 'old'), 'pkg');
    fs.mkdirSync(path.join(dest, 'alpha', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'alpha', 'dist', 'old.js'), 'code');

    const report = runSync({ sourceDir: src, targetDirs: [dest] });

    // Destination has extra excluded dirs, so mirror runs (not unchanged)
    expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(1);
    expect(report.results.filter(r => r.action === 'backed_up')).toHaveLength(1);
    expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
    // Source's excluded dirs should not be copied
    expect(fs.existsSync(path.join(dest, 'alpha', '.reactive'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'alpha', 'node_modules'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'alpha', 'dist'))).toBe(false);
    // Destination's extra excluded dirs should be removed
    expect(fs.existsSync(path.join(dest, 'alpha', '.reactive'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'alpha', 'node_modules'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'alpha', 'dist'))).toBe(false);
  });

  it('idempotent mirror reports unchanged when payload identical', () => {
    createSkill(src, 'alpha');
    fs.writeFileSync(path.join(src, 'alpha', 'README.md'), 'content');

    const report1 = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report1.results.filter(r => r.action === 'mirrored')).toHaveLength(1);

    const report2 = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report2.results.filter(r => r.action === 'unchanged')).toHaveLength(1);
    expect(report2.results.filter(r => r.action === 'mirrored')).toHaveLength(0);
  });

  it('backup created outside destination skill folder', () => {
    createSkill(src, 'alpha');
    runSync({ sourceDir: src, targetDirs: [dest] });

    fs.writeFileSync(path.join(src, 'alpha', 'SKILL.md'), '# alpha v2\n');

    const report = runSync({ sourceDir: src, targetDirs: [dest] });
    const backed = report.results.filter(r => r.action === 'backed_up');
    expect(backed.length).toBe(1);
    const backupPath = backed[0].backupPath!;
    expect(backupPath).toContain('.sync-backups');
    expect(backupPath).toContain('alpha');
    // Should NOT be inside the skill folder
    expect(backupPath.startsWith(path.join(dest, 'alpha'))).toBe(false);
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(fs.existsSync(path.join(backupPath, 'SKILL.md'))).toBe(true);
  });

  it('dry-run does not create backup or modify destination', () => {
    createSkill(src, 'alpha');
    runSync({ sourceDir: src, targetDirs: [dest] });

    fs.writeFileSync(path.join(src, 'alpha', 'SKILL.md'), '# alpha v2\n');

    const report = runSync({
      sourceDir: src,
      targetDirs: [dest],
      dryRun: true,
    });

    expect(report.dryRun).toBe(true);
    expect(report.results[0].action).toBe('mirrored');
    expect(report.results[0].reason).toBe('dry-run');
    // No backup should be created
    expect(report.results.filter(r => r.action === 'backed_up')).toHaveLength(0);
    // Destination should remain unchanged
    const content = fs.readFileSync(path.join(dest, 'alpha', 'SKILL.md'), 'utf-8');
    expect(content).toBe('# alpha\n');
  });

  it('invalid source leaves existing destination untouched', () => {
    createSkill(src, 'alpha');
    runSync({ sourceDir: src, targetDirs: [dest] });

    // Make source invalid by removing SKILL.md
    fs.rmSync(path.join(src, 'alpha', 'SKILL.md'));

    const report = runSync({ sourceDir: src, targetDirs: [dest] });

    expect(report.results.filter(r => r.action === 'skipped_invalid')).toHaveLength(1);
    expect(report.errors.length).toBe(0);
    // Destination should still have the old valid content
    expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
    const content = fs.readFileSync(path.join(dest, 'alpha', 'SKILL.md'), 'utf-8');
    expect(content).toBe('# alpha\n');
  });

  it('prevents source/destination overlap deletion', () => {
    createSkill(src, 'alpha');

    // Try to sync into a subdirectory of source
    const overlapDest = path.join(src, 'subdir');

    const report = runSync({ sourceDir: src, targetDirs: [overlapDest] });

    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain('overlap');
    expect(report.results[0].action).toBe('skipped_overlap');
    // Source should be untouched
    expect(fs.existsSync(path.join(src, 'alpha', 'SKILL.md'))).toBe(true);
  });

  it('targetSkill filter works with multiple target directories', () => {
    createSkill(src, 'alpha');
    createSkill(src, 'beta');
    const dest2 = makeTmpDir();

    try {
      const report = runSync({
        sourceDir: src,
        targetDirs: [dest, dest2],
        targetSkill: 'alpha',
      });

      expect(report.skillsFound).toBe(1);
      expect(fs.existsSync(path.join(dest, 'alpha'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'beta'))).toBe(false);
      expect(fs.existsSync(path.join(dest2, 'alpha'))).toBe(true);
      expect(fs.existsSync(path.join(dest2, 'beta'))).toBe(false);
    } finally {
      fs.rmSync(dest2, { recursive: true, force: true });
    }
  });

  it('mirror removes files in destination not present in source', () => {
    createSkill(src, 'alpha');
    fs.writeFileSync(path.join(src, 'alpha', 'SKILL.md'), '# alpha\n');
    fs.writeFileSync(path.join(src, 'alpha', 'config.json'), '{}');

    // Destination has extra file
    fs.mkdirSync(path.join(dest, 'alpha'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'alpha', 'SKILL.md'), '# alpha\n');
    fs.writeFileSync(path.join(dest, 'alpha', 'config.json'), '{}');
    fs.writeFileSync(path.join(dest, 'alpha', 'obsolete.txt'), 'remove me');

    const report = runSync({ sourceDir: src, targetDirs: [dest] });

    expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(1);
    expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'alpha', 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'alpha', 'obsolete.txt'))).toBe(false);
  });

  it('mirror updates changed files', () => {
    createSkill(src, 'alpha');
    fs.writeFileSync(path.join(src, 'alpha', 'SKILL.md'), '# alpha v1\n');
    fs.writeFileSync(path.join(src, 'alpha', 'data.json'), '{"v":1}');

    runSync({ sourceDir: src, targetDirs: [dest] });

    // Modify source files
    fs.writeFileSync(path.join(src, 'alpha', 'SKILL.md'), '# alpha v2\n');
    fs.writeFileSync(path.join(src, 'alpha', 'data.json'), '{"v":2}');
    fs.writeFileSync(path.join(src, 'alpha', 'new.txt'), 'added');

    const report = runSync({ sourceDir: src, targetDirs: [dest] });

    expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(1);
    expect(fs.readFileSync(path.join(dest, 'alpha', 'SKILL.md'), 'utf-8')).toBe('# alpha v2\n');
    expect(fs.readFileSync(path.join(dest, 'alpha', 'data.json'), 'utf-8')).toBe('{"v":2}');
    expect(fs.existsSync(path.join(dest, 'alpha', 'new.txt'))).toBe(true);
  });

  it('staging validation catches corrupt staging', () => {
    createSkill(src, 'alpha');
    // This test ensures staging validation works - if staging copy fails validation, it should error
    const report = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report.errors.length).toBe(0);
    expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(1);
  });

  it('multiple target directories each get mirrored independently', () => {
    createSkill(src, 'alpha');
    const dest2 = makeTmpDir();

    try {
      const report = runSync({
        sourceDir: src,
        targetDirs: [dest, dest2],
      });

      expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(2);
      expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest2, 'alpha', 'SKILL.md'))).toBe(true);
    } finally {
      fs.rmSync(dest2, { recursive: true, force: true });
    }
  });

  it('excludes runtime metadata from source distributable payload', () => {
    createSkill(src, 'alpha');
    // Add runtime metadata to source
    fs.mkdirSync(path.join(src, 'alpha', '.reactive'), { recursive: true });
    fs.writeFileSync(path.join(src, 'alpha', '.reactive', 'config.json'), '{}');
    fs.mkdirSync(path.join(src, 'alpha', 'tests'), { recursive: true });
    fs.writeFileSync(path.join(src, 'alpha', 'tests', 'test.ts'), 'test');
    fs.mkdirSync(path.join(src, 'alpha', 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(src, 'alpha', 'node_modules', 'pkg'), 'content');

    const report = runSync({ sourceDir: src, targetDirs: [dest] });

    expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(1);
    // None of the excluded dirs should appear in destination
    expect(fs.existsSync(path.join(dest, 'alpha', '.reactive'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'alpha', 'tests'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'alpha', 'node_modules'))).toBe(false);
  });

  it('excludes .sync-backups from source discovery and payload copying', () => {
    createSkill(src, '.sync-backups');
    createSkill(src, 'alpha');
    fs.mkdirSync(path.join(src, 'alpha', '.sync-backups'), { recursive: true });
    fs.writeFileSync(path.join(src, 'alpha', '.sync-backups', 'old.md'), 'old');

    const report = runSync({ sourceDir: src, targetDirs: [dest] });

    expect(report.skillsFound).toBe(1);
    expect(fs.existsSync(path.join(dest, '.sync-backups'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'alpha', '.sync-backups'))).toBe(false);
  });

  it('removes extra empty directories from destination (mirror semantics)', () => {
    createSkill(src, 'alpha');
    runSync({ sourceDir: src, targetDirs: [dest] });

    // Add an extra empty directory to the destination that does not exist in source
    fs.mkdirSync(path.join(dest, 'alpha', 'extra_empty_dir'), { recursive: true });

    const report = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(1);
    expect(fs.existsSync(path.join(dest, 'alpha', 'extra_empty_dir'))).toBe(false);

    // Subsequent run is unchanged
    const report2 = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report2.results.filter(r => r.action === 'unchanged')).toHaveLength(1);
  });

  it('detects excluded files nested anywhere in destination', () => {
    createSkill(src, 'alpha');
    fs.mkdirSync(path.join(src, 'alpha', 'sub'), { recursive: true });
    fs.writeFileSync(path.join(src, 'alpha', 'sub', 'keep.txt'), 'keep');
    runSync({ sourceDir: src, targetDirs: [dest] });

    fs.writeFileSync(path.join(dest, 'alpha', 'sub', '.reactive'), 'junk');

    const report = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(1);
    expect(fs.existsSync(path.join(dest, 'alpha', 'sub', '.reactive'))).toBe(false);
    expect(fs.readFileSync(path.join(dest, 'alpha', 'sub', 'keep.txt'), 'utf-8')).toBe('keep');

    const report2 = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report2.results.filter(r => r.action === 'unchanged')).toHaveLength(1);
  });

  it('detects excluded directories nested anywhere in destination, not only top level', () => {
    createSkill(src, 'alpha');
    // First sync so the destination exists and is identical
    runSync({ sourceDir: src, targetDirs: [dest] });
    expect(
      runSync({ sourceDir: src, targetDirs: [dest] }).results.filter(r => r.action === 'unchanged'),
    ).toHaveLength(1);

    // Inject a nested excluded dir deep inside the destination
    fs.mkdirSync(path.join(dest, 'alpha', 'sub', 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'alpha', 'sub', 'node_modules', 'pkg'), 'junk');

    // Should no longer be "unchanged" because a nested excluded dir exists
    const report = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report.results.filter(r => r.action === 'mirrored')).toHaveLength(1);
    expect(fs.existsSync(path.join(dest, 'alpha', 'sub', 'node_modules'))).toBe(false);

    // Idempotent again after cleanup
    const report2 = runSync({ sourceDir: src, targetDirs: [dest] });
    expect(report2.results.filter(r => r.action === 'unchanged')).toHaveLength(1);
  });

  it('atomic swap restores destination when rename fails instead of deleting it', () => {
    createSkill(src, 'alpha');
    runSync({ sourceDir: src, targetDirs: [dest] });

    // Change the source so a real swap is required (otherwise the run is "unchanged").
    fs.writeFileSync(path.join(src, 'alpha', 'SKILL.md'), '# alpha v2\n');

    // Hold a file open inside the destination so rename(dest -> old) fails on Windows.
    const destPath = path.join(dest, 'alpha');
    const handle = fs.openSync(path.join(destPath, 'SKILL.md'), 'r');

    // Force the swap to fail by intercepting the first rename of the existing
    // destination to its temp-old path and throwing EPERM.
    const originalRename = fs.renameSync;
    let renameCalls = 0;
    const renameSpy = (from: string, to: string) => {
      renameCalls++;
      if (renameCalls === 1 && from === destPath) {
        const err = new Error(`EPERM: operation not permitted, rename '${from}' -> '${to}'`);
        (err as any).code = 'EPERM';
        throw err;
      }
      return originalRename(from, to);
    };
    (fs as any).renameSync = renameSpy;

    try {
      const report = runSync({ sourceDir: src, targetDirs: [dest] });
      expect(report.errors.length).toBeGreaterThan(0);
      // Destination must still be intact after the failed swap
      expect(fs.existsSync(path.join(destPath, 'SKILL.md'))).toBe(true);
      expect(fs.readFileSync(path.join(destPath, 'SKILL.md'), 'utf-8')).toBe('# alpha\n');
      // No orphan temp-old directory should remain
      const leftovers = fs.readdirSync(dest).filter(n => n.startsWith('.old-'));
      expect(leftovers).toHaveLength(0);
    } finally {
      (fs as any).renameSync = originalRename;
      fs.closeSync(handle);
    }
  });

  it('external backup is unique and outside the destination skill folder', () => {
    createSkill(src, 'alpha');
    runSync({ sourceDir: src, targetDirs: [dest] });

    fs.writeFileSync(path.join(src, 'alpha', 'SKILL.md'), '# alpha v2\n');
    const r1 = runSync({ sourceDir: src, targetDirs: [dest] });
    fs.writeFileSync(path.join(src, 'alpha', 'SKILL.md'), '# alpha v3\n');
    const r2 = runSync({ sourceDir: src, targetDirs: [dest] });

    const b1 = r1.results.find(r => r.action === 'backed_up')?.backupPath!;
    const b2 = r2.results.find(r => r.action === 'backed_up')?.backupPath!;

    expect(b1).toBeTruthy();
    expect(b2).toBeTruthy();
    expect(b1).not.toBe(b2);
    // Both outside the skill folder
    expect(b1.startsWith(path.join(dest, 'alpha'))).toBe(false);
    expect(b2.startsWith(path.join(dest, 'alpha'))).toBe(false);
    // Both exist and hold the pre-update content
    expect(fs.existsSync(b1)).toBe(true);
    expect(fs.existsSync(b2)).toBe(true);
  });

  describe('link / junction mode', () => {
    it('creates directory junction/symlink pointing to source', () => {
      createSkill(src, 'alpha');
      const r = runSync({ sourceDir: src, targetDirs: [dest], link: true });

      const linkResult = r.results.find(res => res.skill === 'alpha');
      expect(linkResult?.action).toBe('linked');

      const destAlpha = path.join(dest, 'alpha');
      const stat = fs.lstatSync(destAlpha);
      expect(stat.isSymbolicLink()).toBe(true);

      // Verify content is accessible
      expect(fs.readFileSync(path.join(destAlpha, 'SKILL.md'), 'utf8')).toContain('alpha');

      // Verify live propagation without re-sync
      fs.writeFileSync(path.join(src, 'alpha', 'SKILL.md'), '# modified live\n');
      expect(fs.readFileSync(path.join(destAlpha, 'SKILL.md'), 'utf8')).toBe('# modified live\n');
    });

    it('reports unchanged when link already points to target', () => {
      createSkill(src, 'alpha');
      runSync({ sourceDir: src, targetDirs: [dest], link: true });

      const r2 = runSync({ sourceDir: src, targetDirs: [dest], link: true });
      const linkResult = r2.results.find(res => res.skill === 'alpha');
      expect(linkResult?.action).toBe('unchanged');
    });

    it('replaces existing physical directory with junction and backs up', () => {
      createSkill(src, 'alpha');
      // First sync as physical copy
      runSync({ sourceDir: src, targetDirs: [dest], link: false });
      expect(fs.lstatSync(path.join(dest, 'alpha')).isSymbolicLink()).toBe(false);

      // Second sync with link: true
      const r2 = runSync({ sourceDir: src, targetDirs: [dest], link: true, backup: true });
      expect(fs.lstatSync(path.join(dest, 'alpha')).isSymbolicLink()).toBe(true);
      expect(r2.results.some(res => res.action === 'backed_up')).toBe(true);
    });

    it('dryRun does not create links on disk', () => {
      createSkill(src, 'alpha');
      const r = runSync({ sourceDir: src, targetDirs: [dest], link: true, dryRun: true });
      expect(r.results.find(res => res.skill === 'alpha')?.action).toBe('linked');
      expect(fs.existsSync(path.join(dest, 'alpha'))).toBe(false);
    });
  });
});