import { describe, it, expect, vi } from 'vitest';
import { executeSyncEngineCommand, syncEngineCommand } from '../../src/sync/cli.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sync-cli-'));
}

function createSkill(dir: string, name: string) {
  const skillDir = path.join(dir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${name}\n`);
  return skillDir;
}

describe('syncEngineCommand CLI contract', () => {
  it('prints help text without --no-mirror and without additive mode', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await syncEngineCommand(['--help']);
    const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
    spy.mockRestore();

    expect(out).toContain('--mirror');
    expect(out).toContain('--force');
    expect(out).not.toContain('--no-mirror');
    expect(out).not.toContain('additive mode');
    expect(out).toContain('--skill <name>');
    expect(out).toContain('repeatable');
  });

  it('syncs multiple selected skills from repeated --skill flags', async () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    try {
      createSkill(src, 'alpha');
      createSkill(src, 'beta');
      createSkill(src, 'gamma');

      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--skill', 'alpha',
        '--skill', 'beta',
      ]);

      expect(out).toContain('2 found, 2 valid, 0 invalid');
      expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'beta', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'gamma'))).toBe(false);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('rejects a missing --skill value instead of syncing all skills', async () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    try {
      createSkill(src, 'alpha');

      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--skill',
      ]);
      const outBeforeFlag = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--skill',
        '--dry-run',
      ]);

      expect(out).toContain('--skill requires a skill name');
      expect(outBeforeFlag).toContain('--skill requires a skill name');
      expect(fs.existsSync(path.join(dest, 'alpha'))).toBe(false);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('reports unknown selected skills before creating target directories', async () => {
    const src = makeTmpDir();
    const targetParent = makeTmpDir();
    const dest = path.join(targetParent, 'new-target');
    try {
      createSkill(src, 'alpha');

      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--skill', 'alpha',
        '--skill', 'misspelled',
      ]);

      expect(out).toContain('misspelled');
      expect(out).toContain('ERRORS');
      expect(fs.existsSync(dest)).toBe(false);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(targetParent, { recursive: true, force: true });
    }
  });

  it('returns nonzero status with the JSON report for unknown selected skills', async () => {
    const src = makeTmpDir();
    const targetParent = makeTmpDir();
    const dest = path.join(targetParent, 'new-target');
    try {
      createSkill(src, 'alpha');

      const result = await executeSyncEngineCommand([
        '--source', src,
        '--target', dest,
        '--skill', 'alpha',
        '--skill', 'misspelled',
        '--json',
      ]);
      const report = JSON.parse(result.output);

      expect(result.exitCode).toBe(1);
      expect(report.errors).toContain('Unknown skill: misspelled');
      expect(report.results).toEqual([]);
      expect(fs.existsSync(dest)).toBe(false);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(targetParent, { recursive: true, force: true });
    }
  });

  it('returns nonzero status for a missing --skill value', async () => {
    const result = await executeSyncEngineCommand(['--skill', '--dry-run']);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('--skill requires a skill name');
  });

  it('returns a JSON report for repeated skill selections', async () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    try {
      createSkill(src, 'alpha');
      createSkill(src, 'beta');
      createSkill(src, 'gamma');

      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--skill', 'alpha',
        '--skill', 'beta',
        '--json',
      ]);
      const report = JSON.parse(out);

      expect(report.skillsFound).toBe(2);
      expect(report.results.map((result: { skill: string }) => result.skill).sort()).toEqual(['alpha', 'beta']);
      expect(fs.existsSync(path.join(dest, 'gamma'))).toBe(false);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('throws/returns error on unknown flags instead of silently ignoring', async () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    try {
      createSkill(src, 'alpha');
      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--bogus-flag',
      ]);
      expect(out).toContain('ERROR');
      expect(out).toContain('Unknown flag');
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('--force and --mirror are accepted legacy aliases and run a normal mirror', async () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    try {
      createSkill(src, 'alpha');
      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--force',
      ]);
      expect(out).toContain('OK');
      expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('does not accept --no-mirror as a disabling flag (mirror is the only mode)', async () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    try {
      createSkill(src, 'alpha');
      // --no-mirror is now an unknown flag and must be rejected
      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--no-mirror',
      ]);
      expect(out).toContain('ERROR');
      expect(out).toContain('Unknown flag');
      // No sync should have happened
      expect(fs.existsSync(path.join(dest, 'alpha'))).toBe(false);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('accepts --link to create symlinks/junctions', async () => {
    const src = makeTmpDir();
    const dest = makeTmpDir();
    try {
      createSkill(src, 'alpha');
      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--link',
      ]);
      expect(out).toContain('OK');
      const destAlpha = path.join(dest, 'alpha');
      expect(fs.lstatSync(destAlpha).isSymbolicLink()).toBe(true);
      expect(fs.readFileSync(path.join(destAlpha, 'SKILL.md'), 'utf8')).toContain('alpha');
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });
});
