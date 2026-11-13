import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { AxiError } from '../errors.js';
import { renderOutput } from '../toon.js';

/** Every hook entry this installs carries this name in its command; reinstalling replaces them. */
export const GUARD_MARKER = 'reactive-skills-guard.sh';

type HookHost = 'claude' | 'codex' | 'cursor';
interface HookTarget { id: HookHost; name: string; configPath: string; detectDir: string }

export function hookTargets(home = os.homedir()): HookTarget[] {
  return [
    { id: 'claude', name: 'Claude Code', configPath: path.join(home, '.claude', 'settings.json'), detectDir: path.join(home, '.claude') },
    { id: 'codex', name: 'Codex', configPath: path.join(home, '.codex', 'hooks.json'), detectDir: path.join(home, '.codex') },
    { id: 'cursor', name: 'Cursor', configPath: path.join(home, '.cursor', 'hooks.json'), detectDir: path.join(home, '.cursor') },
  ];
}

export function packagedGuardScript(): string {
  return fileURLToPath(new URL('../../hooks/reactive-skills-guard.sh', import.meta.url));
}

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

/**
 * The hook entries for one host. Claude and Codex share the PreToolUse/Stop shape; Cursor uses its own
 * camelCase events, `Write` matcher and one stop follow-up.
 * # Performance & Risk Budget
 * - Tier: P0 (<1ms)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=4
 */
export function guardHookEntries(host: HookHost, script: string): Record<string, unknown[]> {
  const command = (event: string) => `bash ${quote(script)} ${event} --host ${host}`;
  if (host === 'cursor') {
    return {
      preToolUse: [{ command: command('pretool'), matcher: 'Write' }],
      stop: [{ command: command('stop') }],
      sessionStart: [{ command: command('session-start') }],
      beforeSubmitPrompt: [{ command: command('prompt') }],
    };
  }
  const entry = (event: string, matcher?: string) => ({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: command(event), timeout: 10 }] });
  return {
    PreToolUse: [entry('pretool', host === 'claude' ? 'Edit|Write|MultiEdit|NotebookEdit|Skill' : 'apply_patch|Edit|Write')],
    Stop: [entry('stop')],
    SessionStart: [entry('session-start')],
    UserPromptSubmit: [entry('prompt')],
  };
}

function isGuardEntry(entry: any): boolean {
  return JSON.stringify(entry ?? null).includes(GUARD_MARKER);
}

/**
 * Merge the guard entries into a host config, removing older guard entries first and keeping everything else.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(e), existing hook entries
 * - Cyclomatic Complexity (CC): target <=6
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=8
 */
export function mergeGuardHooks(config: Record<string, any>, host: HookHost, script: string): Record<string, any> {
  const next: Record<string, any> = { ...config, hooks: { ...(config.hooks ?? {}) } };
  if (host === 'cursor') next.version = next.version ?? 1;
  for (const [event, list] of Object.entries(next.hooks)) {
    if (!Array.isArray(list)) continue;
    const kept = (list as unknown[]).filter(entry => !isGuardEntry(entry));
    if (kept.length) next.hooks[event] = kept;
    else delete next.hooks[event];
  }
  for (const [event, entries] of Object.entries(guardHookEntries(host, script))) {
    next.hooks[event] = [...(Array.isArray(next.hooks[event]) ? next.hooks[event] : []), ...entries];
  }
  return next;
}

/**
 * `setup --hooks`: copy the guard script to the user's home and register it with each detected host.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms excluding process startup)
 * - Complexity: O(t + b), targets and config bytes
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=85%
 * - CRAP Score: target <=15
 */
export async function setupHooksCommand(args: string[], home = os.homedir()): Promise<string> {
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const clientIndex = args.indexOf('--client');
  const filter = clientIndex !== -1 ? args[clientIndex + 1]?.toLowerCase() : undefined;
  const targets = hookTargets(home).filter(target => !filter || filter === 'all' || target.id === filter);
  if (filter && targets.length === 0) throw new AxiError(`Unknown hook client '${filter}'`, 'VALIDATION_ERROR', ['Supported: claude, codex, cursor, all']);

  const installed = path.join(home, '.reactive-skills', 'guard', 'bin', GUARD_MARKER);
  const lines: string[] = [`setup_hooks: ${dryRun ? 'dry_run' : 'completed'}`, `guard_script: ${installed}`];
  let hasJq = true;
  try { execFileSync('jq', ['--version'], { stdio: 'ignore' }); } catch { hasJq = false; }
  if (!hasJq) lines.push('warning: jq was not found on PATH; the guard fails open (allows everything) until jq is installed.');
  if (!dryRun) {
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.copyFileSync(packagedGuardScript(), installed);
    fs.chmodSync(installed, 0o755);
  }

  const results: string[] = [];
  for (const target of targets) {
    if (!filter && !force && !fs.existsSync(target.detectDir)) {
      results.push(`  ${target.id}: not_detected (${target.configPath})`);
      continue;
    }
    let config: Record<string, any> = {};
    if (fs.existsSync(target.configPath)) {
      const raw = fs.readFileSync(target.configPath, 'utf8').trim();
      try {
        config = raw ? JSON.parse(raw) : {};
      } catch (err) {
        results.push(`  ${target.id}: error (invalid JSON in ${target.configPath}: ${(err as Error).message})`);
        continue;
      }
    }
    const merged = mergeGuardHooks(config, target.id, installed);
    const status = JSON.stringify(merged) === JSON.stringify(config) ? 'already_configured' : (Object.values(config.hooks ?? {}).flat().some(isGuardEntry) ? 'updated' : 'configured');
    if (!dryRun && status !== 'already_configured') {
      fs.mkdirSync(path.dirname(target.configPath), { recursive: true });
      fs.writeFileSync(target.configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    }
    results.push(`  ${target.id}: ${dryRun && status !== 'already_configured' ? `would_${status === 'updated' ? 'update' : 'configure'}` : status} (${target.configPath})`);
  }
  lines.push(`hosts[${results.length}]:`, ...results);
  lines.push('help[2]:', '  Hooks are user-level: they apply to every workspace; quiet workspaces cost a few milliseconds per write.', '  Restart running agent sessions so they load the new hooks.');
  return renderOutput(lines);
}
