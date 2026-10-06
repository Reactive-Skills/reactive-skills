import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  setupCommand,
  getClientTargets,
  buildServerEntry,
  isNpxLaunchOfAxi,
} from '../../src/commands/setup.js';

const metadata = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
) as { version: string };
const PINNED = `@reactive-skills/axi@${metadata.version}`;

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('setupCommand', () => {
  let home: string;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-setup-test-'));
    vi.spyOn(os, 'homedir').mockReturnValue(home);
    vi.stubEnv('APPDATA', path.join(home, 'AppData', 'Roaming'));
    vi.stubEnv('npm_config_prefix', path.join(home, 'no-global-prefix'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('reports supported client targets', () => {
    const ids = getClientTargets().map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining(['claude', 'cursor', 'antigravity', 'cline', 'roo', 'agents']));
  });

  it('rejects unknown client with VALIDATION_ERROR', async () => {
    await expect(setupCommand(['--client', 'nonexistent_client'])).rejects.toThrow(/Unknown harness client/);
  });

  describe('buildServerEntry', () => {
    it('pins the scoped package to the running version', () => {
      const entry = buildServerEntry({ installedScript: null });
      expect(entry).toEqual({ command: 'npx', args: ['-y', PINNED, 'mcp'] });
      expect(entry.args).not.toContain('reactive-skills-axi');
    });

    it('uses the absolute installed script for a global install', () => {
      const script = path.resolve('/opt/global/lib/node_modules/@reactive-skills/axi/dist/cli/index.js');
      expect(buildServerEntry({ installedScript: script })).toEqual({ command: 'node', args: [script, 'mcp'] });
    });

    it('refuses a non-exact version', () => {
      expect(() => buildServerEntry({ installedScript: null, version: 'latest' })).toThrow(/non-exact version/);
      expect(() => buildServerEntry({ installedScript: null, version: undefined as unknown as string })).not.toThrow();
    });

    it('points at the local checkout with --local', () => {
      const entry = buildServerEntry({ useLocal: true });
      expect(entry.command).toBe('node');
      expect(entry.args[1]).toBe('mcp');
    });
  });

  describe('isNpxLaunchOfAxi', () => {
    it.each([
      [['-y', 'reactive-skills-axi', 'mcp']],
      [['-y', 'reactive-skills-axi@latest', 'mcp']],
      [['-y', 'reactive-skills-axi@0.19.0', 'mcp']],
      [['-y', '@reactive-skills/axi', 'mcp']],
      [['-y', '@reactive-skills/axi@latest', 'mcp']],
      [['-y', PINNED, 'mcp']],
    ])('recognizes npx %j', (args) => {
      expect(isNpxLaunchOfAxi({ command: 'npx', args })).toBe(true);
    });

    it('ignores unrelated entries', () => {
      expect(isNpxLaunchOfAxi({ command: 'npx', args: ['-y', 'other-server'] })).toBe(false);
      expect(isNpxLaunchOfAxi({ command: 'node', args: ['server.js', 'reactive-skills-axi'] })).toBe(false);
      expect(isNpxLaunchOfAxi(null)).toBe(false);
    });
  });

  describe('writing configs', () => {
    it('writes the pinned entry for every harness config format', async () => {
      const output = await setupCommand(['--client', 'all', '--force']);
      expect(output).toContain('setup_status: completed');

      const targets = getClientTargets();
      expect(targets.length).toBeGreaterThanOrEqual(6);
      for (const target of targets) {
        const config = readJson(target.configPath);
        const entry = config[target.serverKey]['reactive-skills-axi'];
        expect(entry, target.id).toEqual(buildServerEntry());
        expect(JSON.stringify(entry)).not.toMatch(/"reactive-skills-axi"\s*[,\]]/);
      }
    });

    it('preserves unrelated servers and settings', async () => {
      const cursor = getClientTargets().find(t => t.id === 'cursor')!;
      fs.mkdirSync(cursor.parentDir, { recursive: true });
      fs.writeFileSync(cursor.configPath, JSON.stringify({ theme: 'dark', mcpServers: { other: { command: 'x' } } }));

      await setupCommand(['--client', 'cursor']);
      const config = readJson(cursor.configPath);
      expect(config.theme).toBe('dark');
      expect(config.mcpServers.other).toEqual({ command: 'x' });
      expect(config.mcpServers['reactive-skills-axi'].args).toContain(PINNED);
    });

    it('reports an already pinned entry as already_configured', async () => {
      await setupCommand(['--client', 'cursor']);
      const output = await setupCommand(['--client', 'cursor']);
      expect(output).toContain('already_configured');
    });
  });

  describe('rewriting old entries', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['bare name', { command: 'npx', args: ['-y', 'reactive-skills-axi', 'mcp'] }],
      ['bare name at latest', { command: 'npx', args: ['-y', 'reactive-skills-axi@latest', 'mcp'] }],
      ['unpinned scoped name', { command: 'npx', args: ['-y', '@reactive-skills/axi', 'mcp'] }],
      ['stale pin', { command: 'npx', args: ['-y', '@reactive-skills/axi@0.1.0', 'mcp'] }],
    ];

    it.each(cases)('rewrites a %s entry and reports it', async (_label, oldEntry) => {
      const cursor = getClientTargets().find(t => t.id === 'cursor')!;
      fs.mkdirSync(cursor.parentDir, { recursive: true });
      fs.writeFileSync(cursor.configPath, JSON.stringify({ mcpServers: { 'reactive-skills-axi': oldEntry } }));

      const output = await setupCommand(['--client', 'cursor']);
      expect(output).toContain('updated');
      expect(output).toContain('-> npx -y ' + PINNED + ' mcp');
      expect(readJson(cursor.configPath).mcpServers['reactive-skills-axi']).toEqual(buildServerEntry());
    });

    it('rewrites an entry stored under a custom server name without adding a duplicate', async () => {
      const cursor = getClientTargets().find(t => t.id === 'cursor')!;
      fs.mkdirSync(cursor.parentDir, { recursive: true });
      fs.writeFileSync(
        cursor.configPath,
        JSON.stringify({ mcpServers: { 'reactive-skills': { command: 'npx', args: ['-y', '@reactive-skills/axi', 'mcp'] } } })
      );

      await setupCommand(['--client', 'cursor']);
      const servers = readJson(cursor.configPath).mcpServers;
      expect(Object.keys(servers)).toEqual(['reactive-skills']);
      expect(servers['reactive-skills']).toEqual(buildServerEntry());
    });
  });

  describe('--dry-run', () => {
    it('writes nothing, creates nothing and reports would_configure', async () => {
      const cursor = getClientTargets().find(t => t.id === 'cursor')!;
      fs.mkdirSync(cursor.parentDir, { recursive: true });

      const output = await setupCommand(['--dry-run', '--client', 'cursor']);
      expect(output).toContain('setup_status: dry_run');
      expect(output).toContain('would_configure');
      expect(fs.existsSync(cursor.configPath)).toBe(false);

      await setupCommand(['--dry-run', '--client', 'all', '--force']);
      for (const target of getClientTargets()) {
        if (target.id !== 'cursor') expect(fs.existsSync(target.parentDir)).toBe(false);
      }
    });

    it('reports would_update for an old entry and leaves the file untouched', async () => {
      const cursor = getClientTargets().find(t => t.id === 'cursor')!;
      fs.mkdirSync(cursor.parentDir, { recursive: true });
      const original = JSON.stringify({ mcpServers: { 'reactive-skills-axi': { command: 'npx', args: ['-y', 'reactive-skills-axi', 'mcp'] } } });
      fs.writeFileSync(cursor.configPath, original);

      const output = await setupCommand(['--dry-run', '--client', 'cursor']);
      expect(output).toContain('would_update');
      expect(output).toContain('-> npx -y ' + PINNED + ' mcp');
      expect(fs.readFileSync(cursor.configPath, 'utf8')).toBe(original);
    });
  });
});
