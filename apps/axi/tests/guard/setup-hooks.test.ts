import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CLI, cleanEnv, createFixture, type Fixture } from './harness.js';

describe('setup --hooks installs the guard at user level', () => {
  let fx: Fixture;
  const setup = (...args: string[]) => spawnSync(process.execPath, [CLI, 'setup', '--hooks', ...args], {
    cwd: fx.workspace, encoding: 'utf8', timeout: 30_000, env: cleanEnv(fx.home),
  });
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(fx.home, file), 'utf8'));

  beforeEach(() => {
    fx = createFixture('reactive-setup-hooks-');
    fs.mkdirSync(path.join(fx.home, '.claude'), { recursive: true });
    // An unrelated hook the user already has must survive.
    fs.writeFileSync(path.join(fx.home, '.claude', 'settings.json'), JSON.stringify({
      model: 'x',
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-hook' }] }] },
    }));
  });
  afterEach(() => fx.cleanup());

  it('registers Claude, Codex and Cursor entries that run the copied script, idempotently', () => {
    const first = setup('--client', 'all');
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain('claude: configured');
    expect(first.stdout).toContain('codex: configured');
    expect(first.stdout).toContain('cursor: configured');

    const script = path.join(fx.home, '.reactive-skills', 'guard', 'bin', 'reactive-skills-guard.sh');
    expect(fs.existsSync(script)).toBe(true);

    const claude = read('.claude/settings.json');
    expect(claude.model).toBe('x');
    expect(claude.hooks.PreToolUse).toHaveLength(2);
    expect(claude.hooks.PreToolUse[0].hooks[0].command).toBe('my-own-hook');
    expect(claude.hooks.PreToolUse[1].matcher).toContain('Write');
    expect(claude.hooks.PreToolUse[1].hooks[0].command).toContain(`'${script}' pretool --host claude`);
    for (const event of ['Stop', 'SessionStart', 'UserPromptSubmit']) expect(JSON.stringify(claude.hooks[event])).toContain('reactive-skills-guard.sh');

    const codex = read('.codex/hooks.json');
    expect(codex.hooks.PreToolUse[0].matcher).toContain('apply_patch');
    expect(codex.hooks.Stop[0].hooks[0].command).toContain('--host codex');

    const cursor = read('.cursor/hooks.json');
    expect(cursor.version).toBe(1);
    expect(cursor.hooks.preToolUse[0]).toMatchObject({ matcher: 'Write' });
    expect(cursor.hooks.stop[0].command).toContain('--host cursor');

    const second = setup('--client', 'all');
    expect(second.stdout).toContain('claude: already_configured');
    expect(read('.claude/settings.json')).toEqual(claude);

    // The registered command really runs the installed guard.
    const command = claude.hooks.Stop[0].hooks[0].command as string;
    const ran = spawnSync('bash', ['-c', command], { cwd: fx.workspace, input: JSON.stringify({ session_id: 'S1', cwd: fx.workspace }), encoding: 'utf8', env: cleanEnv(fx.home) });
    expect(ran.status).toBe(0);
  });

  it('skips hosts that are not installed unless asked, and writes nothing on a dry run', () => {
    const dry = setup('--dry-run');
    expect(dry.stdout).toContain('claude: would_configure');
    expect(dry.stdout).toContain('codex: not_detected');
    expect(fs.existsSync(path.join(fx.home, '.reactive-skills'))).toBe(false);
    expect(read('.claude/settings.json').hooks.Stop).toBeUndefined();
  });
});
