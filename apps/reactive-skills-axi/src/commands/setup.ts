import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { encode } from '@toon-format/toon';
import { renderHelp, renderOutput } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { AxiError } from '../errors.js';

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
  status: 'configured' | 'already_configured' | 'would_configure' | 'not_detected' | 'error';
  path: string;
  details?: string;
}

export function buildServerEntry(useLocal = false): { command: string; args: string[] } {
  if (useLocal) {
    const localCli = path.resolve(process.cwd(), 'apps/reactive-skills-axi/dist/cli/index.js');
    return {
      command: 'node',
      args: [localCli, 'mcp'],
    };
  }
  return {
    command: 'npx',
    args: ['-y', 'reactive-skills-axi', 'mcp'],
  };
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

  const serverEntry = buildServerEntry(isLocal);
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

      const existingEntry = config[target.serverKey]['reactive-skills-axi'];
      const alreadyMatches = existingEntry &&
        existingEntry.command === serverEntry.command &&
        Array.isArray(existingEntry.args) &&
        JSON.stringify(existingEntry.args) === JSON.stringify(serverEntry.args);

      if (alreadyMatches) {
        results.push({
          client: target.name,
          status: 'already_configured',
          path: target.configPath,
        });
        continue;
      }

      if (isDryRun) {
        results.push({
          client: target.name,
          status: 'would_configure',
          path: target.configPath,
        });
        continue;
      }

      // Write changes
      config[target.serverKey]['reactive-skills-axi'] = serverEntry;

      if (!fs.existsSync(target.parentDir)) {
        fs.mkdirSync(target.parentDir, { recursive: true });
      }

      fs.writeFileSync(target.configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

      results.push({
        client: target.name,
        status: 'configured',
        path: target.configPath,
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
