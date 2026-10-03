import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runDistribution } from '../../src/sync/distribution.js';

it('preserves complete skill contents while filtering the parent directory', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-bundled-scripts-'));
  try {
    const source = path.join(workspace, 'source');
    const skill = path.join(source, 'fixture');
    fs.mkdirSync(path.join(skill, 'scripts/nested'), { recursive: true });
    fs.writeFileSync(path.join(skill, 'SKILL.md'), '# Fixture');
    const helper = path.join(skill, 'scripts/nested/helper.cjs');
    fs.writeFileSync(helper, 'module.exports = 42;\n');
    fs.mkdirSync(path.join(skill, 'scripts/node_modules/pkg'), { recursive: true });
    fs.writeFileSync(path.join(skill, 'scripts/node_modules/pkg/index.js'), 'bundled dependency');
    const bundledDirectories = [
      '.git', '.docs', '.reactive', '.playwright-mcp', '.backup', '.sync-backups',
      'tests', 'node_modules', 'dist', '.cache', '.tmp', '.idea', '.vscode',
      '.pytest_cache', '.venv', '__pycache__', 'coverage', '.turbo', 'tmp',
    ];
    for (const name of bundledDirectories) {
      fs.mkdirSync(path.join(skill, name, 'nested'), { recursive: true });
      fs.writeFileSync(path.join(skill, name, 'nested/content.txt'), name);
    }
    fs.mkdirSync(path.join(skill, 'empty-directory'));
    fs.writeFileSync(path.join(skill, '.DS_Store'), 'skill-owned file');
    fs.mkdirSync(path.join(source, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(source, 'scripts/SKILL.md'), '# Repository tooling');
    const central = path.join(workspace, 'central');
    const linked = path.join(workspace, 'linked');
    const physical = path.join(workspace, 'physical');
    const options = {
      sources: [source], central, satellites: [linked], physicalSatellites: [physical],
      statePath: path.join(workspace, 'sync-state.json'),
    };
    const report = runDistribution(options);
    expect(report.errors).toEqual([]);
    expect(report.skillsFound).toBe(1);
    for (const target of [central, linked, physical]) {
      expect(fs.readFileSync(path.join(target, 'fixture/scripts/nested/helper.cjs'), 'utf8')).toBe('module.exports = 42;\n');
      expect(fs.readFileSync(path.join(target, 'fixture/scripts/node_modules/pkg/index.js'), 'utf8')).toBe('bundled dependency');
      for (const name of bundledDirectories) {
        expect(fs.readFileSync(path.join(target, 'fixture', name, 'nested/content.txt'), 'utf8')).toBe(name);
      }
      expect(fs.statSync(path.join(target, 'fixture/empty-directory')).isDirectory()).toBe(true);
      expect(fs.readFileSync(path.join(target, 'fixture/.DS_Store'), 'utf8')).toBe('skill-owned file');
      expect(fs.existsSync(path.join(target, 'scripts'))).toBe(false);
    }
    expect(fs.lstatSync(path.join(linked, 'fixture')).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(physical, 'fixture')).isSymbolicLink()).toBe(false);
    const repeated = runDistribution(options);
    expect(repeated.errors).toEqual([]);
    expect(repeated.results.some(result => result.action === 'mirrored')).toBe(false);
    fs.writeFileSync(helper, 'module.exports = 43;\n');
    expect(runDistribution(options).errors).toEqual([]);
    for (const target of [central, linked, physical]) {
      expect(fs.readFileSync(path.join(target, 'fixture/scripts/nested/helper.cjs'), 'utf8')).toBe('module.exports = 43;\n');
    }
  } finally {
    const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(workspace));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Refusing cleanup outside test temporary directory');
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

it('preserves links and backups without traversing external or missing targets', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-skill-links-'));
  try {
    const source = path.join(workspace, 'source');
    const skill = path.join(source, 'fixture');
    const external = path.join(workspace, 'external');
    fs.mkdirSync(skill, { recursive: true });
    fs.mkdirSync(external);
    fs.writeFileSync(path.join(external, 'keep.txt'), 'external content');
    fs.writeFileSync(path.join(skill, 'SKILL.md'), '# Fixture');
    fs.writeFileSync(path.join(skill, 'payload.txt'), 'version one');
    fs.symlinkSync('payload.txt', path.join(skill, 'relative-link'), 'file');
    fs.symlinkSync('missing.txt', path.join(skill, 'broken-link'), 'file');
    fs.symlinkSync(external, path.join(skill, 'external-link'), process.platform === 'win32' ? 'junction' : 'dir');
    const central = path.join(workspace, 'central');
    const physical = path.join(workspace, 'physical');
    const options = {
      sources: [source], central, satellites: [], physicalSatellites: [physical],
      statePath: path.join(workspace, 'sync-state.json'),
    };
    expect(runDistribution(options).errors).toEqual([]);
    const links = ['relative-link', 'broken-link', 'external-link'];
    for (const target of [central, physical]) {
      for (const link of links) {
        const copied = path.join(target, 'fixture', link);
        expect(fs.lstatSync(copied).isSymbolicLink()).toBe(true);
        expect(fs.readlinkSync(copied)).toBe(fs.readlinkSync(path.join(skill, link)));
      }
      expect(fs.readFileSync(path.join(target, 'fixture/relative-link'), 'utf8')).toBe('version one');
    }
    expect(runDistribution(options).results.every(result => result.action === 'unchanged')).toBe(true);
    fs.writeFileSync(path.join(skill, 'payload.txt'), 'version two');
    const updated = runDistribution(options);
    expect(updated.errors).toEqual([]);
    const backups = updated.results.filter(result => result.action === 'backed_up');
    expect(backups).toHaveLength(2);
    for (const backup of backups) {
      expect(fs.readFileSync(path.join(backup.backupPath!, 'payload.txt'), 'utf8')).toBe('version one');
      for (const link of links) expect(fs.lstatSync(path.join(backup.backupPath!, link)).isSymbolicLink()).toBe(true);
    }
    fs.unlinkSync(path.join(skill, 'external-link'));
    expect(runDistribution(options).errors).toEqual([]);
    expect(fs.existsSync(path.join(central, 'fixture/external-link'))).toBe(false);
    expect(fs.readFileSync(path.join(external, 'keep.txt'), 'utf8')).toBe('external content');
  } finally {
    const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(workspace));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Refusing cleanup outside test temporary directory');
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
