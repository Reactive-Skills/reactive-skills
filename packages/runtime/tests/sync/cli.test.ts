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

function sandbox() {
  const root = makeTmpDir();
  const src = path.join(root, 'source');
  const dest = path.join(root, 'satellite');
  const central = path.join(root, 'central');
  const config = path.join(root, 'sync.json');
  fs.mkdirSync(src);
  fs.mkdirSync(dest);
  fs.writeFileSync(config, '{}');
  return { root, src, dest, central, config };
}

describe('syncEngineCommand CLI contract', () => {
  it('prints repeatable CSV path options and sync configuration examples in help', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await syncEngineCommand(['--help']);
    const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
    spy.mockRestore();

    expect(out).toContain('--mirror');
    expect(out).toContain('--force');
    expect(out).not.toContain('--no-mirror');
    expect(out).not.toContain('additive mode');
    expect(out).toContain('--skill <name>[,<name>...]');
    expect(out).toContain('repeatable');
    expect(out).toContain('--source, -s <dir>[,<dir>...]');
    expect(out).toContain('--target, -t <dir>[,<dir>...]');
    expect(out).toContain('--physical-target <dir>[,<dir>...]');
    expect(out).toContain('--central <dir>');
    expect(out).toContain('sync --source ~/work/public,~/work/private --target ~/.codex/skills,~/.claude/skills');
  });

  it('syncs multiple selected skills from repeated --skill flags', async () => {
    const { root, src, dest, central, config } = sandbox();
    try {
      createSkill(src, 'alpha');
      createSkill(src, 'beta');
      createSkill(src, 'gamma');

      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--central', central,
        '--config', config,
        '--skill', 'alpha',
        '--skill', 'beta',
      ]);

      expect(out).toContain('2 found, 2 valid, 0 invalid');
      expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'beta', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'gamma'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('syncs comma-separated and repeated selections, trimming surrounding whitespace', async () => {
    const { root, src, dest, central, config } = sandbox();
    try {
      createSkill(src, 'alpha');
      createSkill(src, 'beta');
      createSkill(src, 'gamma');
      createSkill(src, 'delta');

      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--central', central,
        '--config', config,
        '--skill', 'alpha, beta',
        '--skill', ' gamma ',
      ]);

      expect(out).toContain('3 found, 3 valid, 0 invalid');
      expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'beta', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'gamma', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(dest, 'delta'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts comma-separated and repeated source, target, and physical-target paths', async () => {
    const { root, src, dest, central, config } = sandbox();
    const sourceTwo = path.join(root, 'source-two');
    const sourceThree = path.join(root, 'source-three');
    const destTwo = path.join(root, 'satellite-two');
    const destThree = path.join(root, 'satellite-three');
    const physicalOne = path.join(root, 'physical-one');
    const physicalTwo = path.join(root, 'physical-two');
    const physicalThree = path.join(root, 'physical-three');
    fs.mkdirSync(sourceTwo);
    fs.mkdirSync(sourceThree);
    try {
      createSkill(src, 'alpha');
      createSkill(sourceTwo, 'beta');
      createSkill(sourceThree, 'gamma');

      const out = await syncEngineCommand([
        '--source', `${src}, ${sourceTwo}`,
        '--source', sourceThree,
        '--target', `${dest}, ${destTwo}`,
        '--target', destThree,
        '--physical-target', `${physicalOne}, ${physicalTwo}`,
        '--physical-target', physicalThree,
        '--central', central,
        '--config', config,
      ]);

      expect(out).toContain(`Sources: ${src}, ${sourceTwo}, ${sourceThree}`);
      expect(out).toContain('3 found, 3 valid, 0 invalid');
      expect(out).toContain('Satellites: 3 linked, 3 physical');

      for (const target of [dest, destTwo, destThree, physicalOne, physicalTwo, physicalThree]) {
        for (const skill of ['alpha', 'beta', 'gamma']) {
          expect(fs.existsSync(path.join(target, skill, 'SKILL.md'))).toBe(true);
        }
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['--source', 'source-one,,source-two'],
    ['--target', 'target-one,,target-two'],
    ['--physical-target', 'target-one,,target-two'],
  ])('rejects empty comma-separated paths for %s', async (flag, value) => {
    const result = await executeSyncEngineCommand([flag, value]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(`${flag} values must contain non-empty directories`);
  });

  it.each(['alpha,,beta', ',alpha', 'alpha,'])(
    'rejects empty comma-separated names in %s before creating target directories',
    async (selector) => {
      const { root, src, central, config } = sandbox();
      const targetParent = path.join(root, 'targets');
      fs.mkdirSync(targetParent);
      const target = path.join(targetParent, 'new-target');
      try {
        createSkill(src, 'alpha');
        createSkill(src, 'beta');

        const result = await executeSyncEngineCommand([
          '--source', src,
          '--target', target,
          '--central', central,
          '--config', config,
          '--skill', selector,
        ]);

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('non-empty skill names');
        expect(fs.existsSync(target)).toBe(false);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it('rejects a missing --skill value instead of syncing all skills', async () => {
    const { root, src, dest, central, config } = sandbox();
    try {
      createSkill(src, 'alpha');

      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--central', central,
        '--config', config,
        '--skill',
      ]);
      const outBeforeFlag = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--central', central,
        '--config', config,
        '--skill',
        '--dry-run',
      ]);

      expect(out).toContain('--skill requires a skill name');
      expect(outBeforeFlag).toContain('--skill requires a skill name');
      expect(fs.existsSync(path.join(dest, 'alpha'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports unknown selected skills before creating target directories', async () => {
    const { root, src, central, config } = sandbox();
    const targetParent = path.join(root, 'targets');
    fs.mkdirSync(targetParent);
    const dest = path.join(targetParent, 'new-target');
    try {
      createSkill(src, 'alpha');

      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--central', central,
        '--config', config,
        '--skill', 'alpha',
        '--skill', 'misspelled',
      ]);

      expect(out).toContain('misspelled');
      expect(out).toContain('ERRORS');
      expect(fs.existsSync(dest)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns nonzero status with the JSON report for unknown selected skills', async () => {
    const { root, src, central, config } = sandbox();
    const targetParent = path.join(root, 'targets');
    fs.mkdirSync(targetParent);
    const dest = path.join(targetParent, 'new-target');
    try {
      createSkill(src, 'alpha');

      const result = await executeSyncEngineCommand([
        '--source', src,
        '--target', dest,
        '--central', central,
        '--config', config,
        '--skill', 'alpha,misspelled',
        '--json',
      ]);
      const report = JSON.parse(result.output);

      expect(result.exitCode).toBe(1);
      expect(report.errors).toContain('Unknown skill: misspelled');
      expect(report.results).toEqual([]);
      expect(fs.existsSync(dest)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns nonzero status for a missing --skill value', async () => {
    const result = await executeSyncEngineCommand(['--skill', '--dry-run']);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('--skill requires a skill name');
  });

  it('returns a JSON report for repeated skill selections', async () => {
    const { root, src, dest, central, config } = sandbox();
    try {
      createSkill(src, 'alpha');
      createSkill(src, 'beta');
      createSkill(src, 'gamma');

      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--central', central,
        '--config', config,
        '--skill', 'alpha',
        '--skill', 'beta',
        '--json',
      ]);
      const report = JSON.parse(out);

      expect(report.skillsFound).toBe(2);
      expect([...new Set(report.results.map((result: { skill: string }) => result.skill))].sort()).toEqual(['alpha', 'beta']);
      expect(report.results).toHaveLength(4); // central plus the selected target for each skill
      expect(fs.existsSync(path.join(dest, 'gamma'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
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
    const { root, src, dest, central, config } = sandbox();
    try {
      createSkill(src, 'alpha');
      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--central', central,
        '--config', config,
        '--force',
      ]);
      expect(out).toContain('OK');
      expect(fs.existsSync(path.join(dest, 'alpha', 'SKILL.md'))).toBe(true);
      expect(fs.lstatSync(path.join(central, 'alpha')).isDirectory()).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
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
    const { root, src, dest, central, config } = sandbox();
    try {
      createSkill(src, 'alpha');
      const out = await syncEngineCommand([
        '--source', src,
        '--target', dest,
        '--central', central,
        '--config', config,
        '--link',
      ]);
      expect(out).toContain('OK');
      const destAlpha = path.join(dest, 'alpha');
      expect(fs.lstatSync(destAlpha).isSymbolicLink()).toBe(true);
      expect(fs.readlinkSync(destAlpha)).toBe(path.join(central, 'alpha'));
      expect(fs.readFileSync(path.join(destAlpha, 'SKILL.md'), 'utf8')).toContain('alpha');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('shows ordered config and applies physical satellite exceptions', async () => {
    const { root, src, dest, central, config } = sandbox();
    const physical = path.join(root, 'gemini');
    try {
      createSkill(src, 'alpha');
      fs.writeFileSync(config, JSON.stringify({
        sources: [src], central, satellites: [dest, physical], physicalSatellites: [physical],
      }));
      const shown = JSON.parse(await syncEngineCommand(['--config', config, '--show-config']));
      expect(shown.sources).toEqual([src]);
      expect(shown.satellites).toEqual([dest]);
      expect(shown.physicalSatellites).toEqual([physical]);

      const report = JSON.parse(await syncEngineCommand(['--config', config, '--json']));
      expect(report.errors).toEqual([]);
      expect(fs.lstatSync(path.join(central, 'alpha')).isDirectory()).toBe(true);
      expect(fs.lstatSync(path.join(dest, 'alpha')).isSymbolicLink()).toBe(true);
      expect(fs.lstatSync(path.join(physical, 'alpha')).isSymbolicLink()).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
