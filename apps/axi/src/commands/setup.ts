import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { encode } from '@toon-format/toon';
import { renderHelp, renderOutput } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { AxiError } from '../errors.js';
import { AXI_PACKAGE_NAME, pinnedAxiPackageSpec } from '@reactive-skills/runtime';

const require = createRequire(import.meta.url);
const packageMetadata = require('../../package.json') as { version?: string };
const SERVER_NAME = 'reactive-skills-axi';
const LEGACY_PACKAGE_NAME = 'reactive-skills-axi';

export interface ClientTarget {
  id: string;
  name: string;
  configPath: string;
  parentDir: string;
  serverKey: string;
}

export function getClientTargets(): ClientTarget[] {
  const home = os.homedir();
  const platform = os.platform();

  const targets: ClientTarget[] = [];

  // 1. Claude Desktop
  let claudeConfigPath: string;
  if (platform === 'win32') {
    claudeConfigPath = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'darwin') {
    claudeConfigPath = path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    claudeConfigPath = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }
  targets.push({
    id: 'claude',
    name: 'Claude Desktop',
    configPath: claudeConfigPath,
    parentDir: path.dirname(claudeConfigPath),
    serverKey: 'mcpServers',
  });

  // 2. Cursor (User global)
  const cursorGlobalPath = path.join(home, '.cursor', 'mcp.json');
  targets.push({
    id: 'cursor',
    name: 'Cursor (Global)',
    configPath: cursorGlobalPath,
    parentDir: path.dirname(cursorGlobalPath),
    serverKey: 'mcpServers',
  });

  // 3. Antigravity / Gemini
  const antigravityConfigPath = path.join(home, '.gemini', 'antigravity', 'mcp_config.json');
  targets.push({
    id: 'antigravity',
    name: 'Google Antigravity',
    configPath: antigravityConfigPath,
    parentDir: path.dirname(antigravityConfigPath),
    serverKey: 'mcpServers',
  });

  // 4. VS Code (Cline extension)
  let clineConfigPath: string;
  if (platform === 'win32') {
    clineConfigPath = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
  } else if (platform === 'darwin') {
    clineConfigPath = path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
  } else {
    clineConfigPath = path.join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
  }
  targets.push({
    id: 'cline',
    name: 'VS Code (Cline)',
    configPath: clineConfigPath,
    parentDir: path.dirname(clineConfigPath),
    serverKey: 'mcpServers',
  });

  // 5. VS Code (Roo Code extension)
  let rooConfigPath: string;
  if (platform === 'win32') {
    rooConfigPath = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json');
  } else if (platform === 'darwin') {
    rooConfigPath = path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json');
  } else {
    rooConfigPath = path.join(home, '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json');
  }
  targets.push({
    id: 'roo',
    name: 'VS Code (Roo Code)',
    configPath: rooConfigPath,
    parentDir: path.dirname(rooConfigPath),
    serverKey: 'mcpServers',
  });

  // 6. Universal Agents Standard
  const agentsConfigPath = path.join(home, '.agents', 'mcp.json');
  targets.push({
    id: 'agents',
    name: 'Agents Standard (~/.agents)',
    configPath: agentsConfigPath,
    parentDir: path.dirname(agentsConfigPath),
    serverKey: 'mcpServers',
  });

  return targets;
}

export interface SetupResult {
  client: string;
  status: 'configured' | 'updated' | 'already_configured' | 'would_configure' | 'would_update' | 'not_detected' | 'error';
  path: string;
  details?: string;
}

export interface ServerEntry {
  command: string;
  args: string[];
}

export interface ServerEntryOptions {
  useLocal?: boolean;
  /** Version of the running CLI; defaults to this package's own version. */
  version?: string;
  /** Absolute path of an installed (global) CLI entry script, when setup runs from one. */
  installedScript?: string | null;
}

function realpathOrSelf(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Returns the absolute CLI entry script when this CLI runs from a global npm install
 * (a package under the Node prefix's global node_modules), otherwise null. Project-local
 * node_modules and the transient npx cache do not count.
 */
export function detectGlobalInstallScript(): string | null {
  const packageRoot = realpathOrSelf(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const script = path.join(packageRoot, 'dist', 'cli', 'index.js');
  if (!fs.existsSync(script)) return null;

  const prefixes = new Set<string>();
  if (process.env.npm_config_prefix) prefixes.add(process.env.npm_config_prefix);
  prefixes.add(path.dirname(process.execPath));
  prefixes.add(path.dirname(path.dirname(process.execPath)));

  for (const prefix of prefixes) {
    const globalRoots = [path.join(prefix, 'lib', 'node_modules'), path.join(prefix, 'node_modules')];
    for (const root of globalRoots) {
      if (isInside(packageRoot, realpathOrSelf(root)) && !packageRoot.split(path.sep).includes('_npx')) {
        return script;
      }
    }
  }
  return null;
}

/**
 * The MCP server entry setup registers: the scoped package pinned to this CLI's exact version
 * via npx, or the absolute installed script for a global install. Never the bare alias name.
 */
export function buildServerEntry(options: ServerEntryOptions | boolean = {}): ServerEntry {
  const opts: ServerEntryOptions = typeof options === 'boolean' ? { useLocal: options } : options;
  if (opts.useLocal) {
    const localCli = fs.existsSync(path.resolve(process.cwd(), 'apps/axi/dist/cli/index.js'))
      ? path.resolve(process.cwd(), 'apps/axi/dist/cli/index.js')
      : path.resolve(process.cwd(), 'apps/reactive-skills-axi/dist/cli/index.js');
    return {
      command: 'node',
      args: [localCli, 'mcp'],
    };
  }
  const installedScript = opts.installedScript === undefined ? detectGlobalInstallScript() : opts.installedScript;
  if (installedScript) {
    return {
      command: 'node',
      args: [installedScript, 'mcp'],
    };
  }
  return {
    command: 'npx',
    args: ['-y', pinnedAxiPackageSpec(opts.version ?? packageMetadata.version), 'mcp'],
  };
}

function entriesEqual(a: any, b: ServerEntry): boolean {
  return Boolean(a) &&
    a.command === b.command &&
    Array.isArray(a.args) &&
    JSON.stringify(a.args) === JSON.stringify(b.args);
}

/** True when an existing MCP entry launches this package through npx, whatever its spelling or version. */
export function isNpxLaunchOfAxi(entry: any): boolean {
  if (!entry || typeof entry !== 'object' || typeof entry.command !== 'string' || !Array.isArray(entry.args)) {
    return false;
  }
  const launcher = path.basename(entry.command).toLowerCase().replace(/\.(cmd|exe)$/, '');
  if (launcher !== 'npx') return false;
  return entry.args.some((arg: unknown) => {
    if (typeof arg !== 'string') return false;
    const name = arg.startsWith('@') ? arg.slice(0, arg.indexOf('@', 1) === -1 ? undefined : arg.indexOf('@', 1)) : arg.split('@')[0];
    return name === LEGACY_PACKAGE_NAME || name === AXI_PACKAGE_NAME;
  });
}

function describeEntry(entry: any): string {
  if (!entry || typeof entry !== 'object') return String(entry);
  return [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])].join(' ');
}

export async function setupCommand(args: string[]): Promise<string> {
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');
  const isLocal = args.includes('--local');

  let filterClient: string | null = null;
  const clientIdx = args.indexOf('--client');
  if (clientIdx !== -1 && args[clientIdx + 1]) {
    filterClient = args[clientIdx + 1].toLowerCase();
  }

  const allTargets = getClientTargets();
  const selectedTargets = filterClient && filterClient !== 'all'
    ? allTargets.filter(t => t.id === filterClient || t.name.toLowerCase().includes(filterClient!))
    : allTargets;

  if (filterClient && selectedTargets.length === 0) {
    throw new AxiError(
      `Unknown harness client: '${filterClient}'`,
      'VALIDATION_ERROR',
      [`Supported clients: ${allTargets.map(t => t.id).join(', ')}, all`, 'Run `reactive-skills-axi setup` to auto-detect installed harnesses']
    );
  }

  const serverEntry = buildServerEntry({ useLocal: isLocal });
  const results: SetupResult[] = [];

  for (const target of selectedTargets) {
    const fileExists = fs.existsSync(target.configPath);
    const parentExists = fs.existsSync(target.parentDir);

    // If neither exists and not forced/explicitly specified, client is not installed
    if (!fileExists && !parentExists && !isForce && !filterClient) {
      results.push({
        client: target.name,
        status: 'not_detected',
        path: target.configPath,
      });
      continue;
    }

    try {
      let config: Record<string, any> = {};
      if (fileExists) {
        const raw = fs.readFileSync(target.configPath, 'utf8').trim();
        if (raw.length > 0) {
          try {
            config = JSON.parse(raw);
          } catch (parseErr: any) {
            results.push({
              client: target.name,
              status: 'error',
              path: target.configPath,
              details: `Invalid JSON: ${parseErr.message}`,
            });
            continue;
          }
        }
      }

      if (!config[target.serverKey] || typeof config[target.serverKey] !== 'object') {
        config[target.serverKey] = {};
      }

      const servers = config[target.serverKey] as Record<string, any>;

      // Existing npx launches of this package (bare alias, unpinned, or stale pin) under any key
      // are rewritten in place so a user's chosen server name survives.
      const staleKeys = Object.keys(servers).filter(
        key => isNpxLaunchOfAxi(servers[key]) && !entriesEqual(servers[key], serverEntry)
      );
      const hasCurrentLaunch = Object.values(servers).some(entry => entriesEqual(entry, serverEntry));
      const canonical = servers[SERVER_NAME];

      const updates = new Set(staleKeys);
      if (canonical !== undefined && !entriesEqual(canonical, serverEntry)) {
        updates.add(SERVER_NAME);
      }
      if (canonical === undefined && staleKeys.length === 0 && !hasCurrentLaunch) {
        updates.add(SERVER_NAME);
      }

      if (updates.size === 0) {
        results.push({
          client: target.name,
          status: 'already_configured',
          path: target.configPath,
        });
        continue;
      }

      const isUpdate = [...updates].some(key => servers[key] !== undefined);
      const details = [...updates]
        .filter(key => servers[key] !== undefined)
        .map(key => `${key}: ${describeEntry(servers[key])} -> ${describeEntry(serverEntry)}`)
        .join('; ');

      if (isDryRun) {
        results.push({
          client: target.name,
          status: isUpdate ? 'would_update' : 'would_configure',
          path: target.configPath,
          ...(details ? { details } : {}),
        });
        continue;
      }

      // Write changes
      for (const key of updates) {
        servers[key] = { ...serverEntry, args: [...serverEntry.args] };
      }

      if (!fs.existsSync(target.parentDir)) {
        fs.mkdirSync(target.parentDir, { recursive: true });
      }

      fs.writeFileSync(target.configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

      results.push({
        client: target.name,
        status: isUpdate ? 'updated' : 'configured',
        path: target.configPath,
        ...(details ? { details } : {}),
      });
    } catch (err: any) {
      results.push({
        client: target.name,
        status: 'error',
        path: target.configPath,
        details: err.message,
      });
    }
  }

  // Format TOON output
  const lines: string[] = [];
  const actionLabel = isDryRun ? 'dry_run' : 'completed';
  lines.push(`setup_status: ${actionLabel}`);

  const activeResults = results.filter(r => r.status !== 'not_detected');
  if (activeResults.length > 0) {
    const encoded = encode({
      harnesses: activeResults.map((r, i) => ({
        [`harnesses[${i}]`]: {
          client: r.client,
          status: r.status,
          path: r.path,
          ...(r.details ? { details: r.details } : {}),
        },
      })),
    });
    lines.push(encoded);
  } else {
    lines.push('notice: No compatible agent harnesses were detected.');
    lines.push('Run with --force to create default config paths, or --client <name> to specify target.');
  }

  const suggestions = getSuggestions({ domain: 'setup', action: 'configure' });
  lines.push(renderHelp(suggestions));

  return renderOutput(lines);
}
