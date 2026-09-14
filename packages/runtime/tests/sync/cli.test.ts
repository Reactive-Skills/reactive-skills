import { describe, it, expect, vi } from 'vitest';
import { syncEngineCommand } from '../../src/sync/cli.js';
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