import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runDistribution } from '../../src/sync/distribution.js';
import type { DistributionOptions } from '../../src/sync/types.js';

function skill(root: string, name: string, content: string): void {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), content);
}

describe('source → central → satellite distribution', () => {
  let root: string;
  let publicSource: string;
  let privateSource: string;
  let central: string;
  let linked: string;
  let physical: string;
  let statePath: string;
  let options: DistributionOptions;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-distribution-'));
    publicSource = path.join(root, 'public');
    privateSource = path.join(root, 'private');
    central = path.join(root, 'central');
    linked = path.join(root, 'linked');
    physical = path.join(root, 'physical');
    statePath = path.join(root, 'sync-state.json');
    fs.mkdirSync(publicSource);
    fs.mkdirSync(privateSource);
    options = {
      sources: [publicSource, privateSource], central,
      satellites: [linked, physical], physicalSatellites: [physical], statePath,
    };
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('uses source order, copies only skill folders to a physical central, and distributes both satellite modes', () => {
    skill(publicSource, 'shared', '# public\n');
    skill(privateSource, 'shared', '# private\n');
    skill(privateSource, 'private-only', '# private only\n');
    fs.mkdirSync(path.join(publicSource, 'unrelated'));
    fs.writeFileSync(path.join(publicSource, 'unrelated', 'README.md'), 'junk');
    fs.mkdirSync(path.join(publicSource, 'invalid-folder'));
    fs.writeFileSync(path.join(publicSource, 'invalid-folder', 'README.md'), 'not a skill');
    fs.writeFileSync(path.join(publicSource, 'shared', '.DS_Store'), 'junk');
    skill(central, 'existing-only', '# retained\n');

    const report = runDistribution(options);

    expect(report.errors).toEqual([]);
    expect(report.collisions).toEqual([{
      skill: 'shared', winner: path.join(publicSource, 'shared'), shadowed: path.join(privateSource, 'shared'),
    }]);
    expect(fs.readFileSync(path.join(central, 'shared', 'SKILL.md'), 'utf8')).toBe('# public\n');
    expect(fs.lstatSync(path.join(central, 'shared')).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(central, 'unrelated'))).toBe(false);
    expect(fs.existsSync(path.join(linked, 'unrelated'))).toBe(false);
    expect(fs.existsSync(path.join(physical, 'unrelated'))).toBe(false);
    expect(fs.existsSync(path.join(central, 'invalid-folder'))).toBe(false);
    expect(fs.readFileSync(path.join(central, 'private-only', 'SKILL.md'), 'utf8')).toBe('# private only\n');
    expect(fs.existsSync(path.join(central, 'shared', '.DS_Store'))).toBe(false);
    expect(fs.readlinkSync(path.join(linked, 'shared'))).toBe(path.join(central, 'shared'));
    expect(fs.lstatSync(path.join(physical, 'shared')).isDirectory()).toBe(true);
    expect(fs.lstatSync(path.join(physical, 'shared')).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(path.join(physical, 'existing-only', 'SKILL.md'), 'utf8')).toBe('# retained\n');

    fs.writeFileSync(path.join(publicSource, 'shared', 'SKILL.md'), '# updated public\n');
    const second = runDistribution(options);
    expect(second.errors).toEqual([]);
    expect(fs.readFileSync(path.join(linked, 'shared', 'SKILL.md'), 'utf8')).toBe('# updated public\n');
    expect(fs.readFileSync(path.join(physical, 'shared', 'SKILL.md'), 'utf8')).toBe('# updated public\n');
    const preview = runDistribution({ ...options, dryRun: true });
    expect(preview.results.find(result => result.target === physical && result.skill === 'shared')?.action).toBe('unchanged');
  });

  it('allows no sources and distributes existing central skills', () => {
    skill(central, 'manual', '# manual\n');
    const report = runDistribution({
      ...options,
      sources: [],
      satellites: [central, linked, physical],
      physicalSatellites: [central, physical],
    });
    expect(report.errors).toEqual([]);
    expect(report.skillsFound).toBe(1);
    expect(report.satellites).toEqual([linked]);
    expect(report.physicalSatellites).toEqual([physical]);
    expect(fs.readlinkSync(path.join(linked, 'manual'))).toBe(path.join(central, 'manual'));
    expect(fs.lstatSync(path.join(physical, 'manual')).isDirectory()).toBe(true);
  });

  it('creates an empty central directory without creating satellite content when no sources exist', () => {
    const report = runDistribution({ ...options, sources: [] });
    expect(report.errors).toEqual([]);
    expect(report.skillsFound).toBe(0);
    expect(fs.lstatSync(central).isDirectory()).toBe(true);
    expect(fs.existsSync(linked)).toBe(false);
    expect(fs.existsSync(physical)).toBe(false);
  });

  it('removes owned links when their central skill is removed', () => {
    skill(central, 'manual', '# manual\n');
    expect(runDistribution({ ...options, sources: [] }).errors).toEqual([]);
    fs.rmSync(path.join(central, 'manual'), { recursive: true });

    const report = runDistribution({ ...options, sources: [] });
    expect(report.errors).toEqual([]);
    expect(report.removedLinks).toContain(path.join(linked, 'manual'));
    expect(() => fs.lstatSync(path.join(linked, 'manual'))).toThrow();
  });

  it('changes the winning skill when source order changes', () => {
    skill(publicSource, 'shared', '# public\n');
    skill(privateSource, 'shared', '# private\n');
    expect(runDistribution(options).errors).toEqual([]);
    expect(fs.readFileSync(path.join(central, 'shared', 'SKILL.md'), 'utf8')).toBe('# public\n');

    const reordered = runDistribution({ ...options, sources: [privateSource, publicSource] });
    expect(reordered.errors).toEqual([]);
    expect(reordered.collisions[0].winner).toBe(path.join(privateSource, 'shared'));
    expect(fs.readFileSync(path.join(central, 'shared', 'SKILL.md'), 'utf8')).toBe('# private\n');
    expect(fs.readFileSync(path.join(linked, 'shared', 'SKILL.md'), 'utf8')).toBe('# private\n');
    expect(fs.readFileSync(path.join(physical, 'shared', 'SKILL.md'), 'utf8')).toBe('# private\n');
  });

  it('does not write during dry run and rejects circular paths before changing files', () => {
    skill(publicSource, 'alpha', '# alpha\n');
    const preview = runDistribution({ ...options, dryRun: true });
    expect(preview.errors).toEqual([]);
    expect(preview.results.some(result => result.skill === 'alpha' && result.target === linked)).toBe(true);
    expect(fs.existsSync(central)).toBe(false);
    expect(fs.existsSync(linked)).toBe(false);

    const invalid = runDistribution({ ...options, central: path.join(publicSource, 'central') });
    expect(invalid.errors[0]).toContain('overlap');
    expect(fs.existsSync(path.join(publicSource, 'central'))).toBe(false);
  });

  it('retargets owned links after moving the central directory and removes links from removed satellites', () => {
    skill(publicSource, 'alpha', '# alpha\n');
    expect(runDistribution(options).errors).toEqual([]);

    const newCentral = path.join(root, 'new-central');
    const moved = runDistribution({ ...options, central: newCentral, satellites: [physical], physicalSatellites: [physical] });
    expect(moved.errors).toEqual([]);
    expect(fs.lstatSync(path.join(newCentral, 'alpha')).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(linked, 'alpha'))).toBe(false);
    expect(moved.removedLinks).toContain(path.join(linked, 'alpha'));
    expect(fs.lstatSync(path.join(physical, 'alpha')).isDirectory()).toBe(true);
  });

  it('keeps other managed links when syncing only one satellite', () => {
    const other = path.join(root, 'other-linked');
    skill(publicSource, 'alpha', '# alpha\n');
    expect(runDistribution({ ...options, satellites: [linked, other, physical] }).errors).toEqual([]);

    const partial = runDistribution({
      ...options,
      satellites: [linked],
      physicalSatellites: [],
      preserveUnselectedLinks: true,
    });

    expect(partial.errors).toEqual([]);
    expect(partial.removedLinks).toEqual([]);
    expect(fs.readlinkSync(path.join(other, 'alpha'))).toBe(path.join(central, 'alpha'));
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    expect(state.links[path.join(other, 'alpha')]).toBe(path.join(central, 'alpha'));
  });

  it('can promote an old linked satellite to the physical central and link the former central back to it', () => {
    skill(publicSource, 'alpha', '# alpha\n');
    expect(runDistribution(options).errors).toEqual([]);

    const moved = runDistribution({
      ...options,
      central: linked,
      satellites: [central, physical],
      physicalSatellites: [physical],
    });

    expect(moved.errors).toEqual([]);
    expect(fs.lstatSync(path.join(linked, 'alpha')).isDirectory()).toBe(true);
    expect(fs.lstatSync(path.join(linked, 'alpha')).isSymbolicLink()).toBe(false);
    expect(fs.readlinkSync(path.join(central, 'alpha'))).toBe(path.join(linked, 'alpha'));
    expect(fs.readFileSync(path.join(physical, 'alpha', 'SKILL.md'), 'utf8')).toBe('# alpha\n');
  });
});
