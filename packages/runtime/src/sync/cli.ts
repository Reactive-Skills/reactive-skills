import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runDistribution } from './distribution.js';
import { DistributionOptions, DistributionReport, SyncCommandResult } from './types.js';

class MissingSkillNameError extends Error {}

function expandPath(p: string): string {
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(p);
}

function splitOptionList(value: string, option: string, itemLabel: string): string[] {
  const items = value.split(',').map(item => item.trim());
  if (items.some(item => item.length === 0)) {
    throw new Error(`${option} values must contain non-empty ${itemLabel}`);
  }
  return items;
}

function parseArgs(args: string[]): {
  sourceDir?: string;
  sourceDirs: string[];
  targetDirs: string[];
  targetSkills?: string[];
  physicalTargets: string[];
  central?: string;
  configPath?: string;
  dryRun: boolean;
  noBackup: boolean;
  link?: boolean;
  allSources?: boolean;
  json: boolean;
  showConfig: boolean;
  help: boolean;
} {
  const result: {
    sourceDir?: string;
    sourceDirs: string[];
    targetDirs: string[];
    targetSkills?: string[];
    physicalTargets: string[];
    central?: string;
    configPath?: string;
    dryRun: boolean;
    noBackup: boolean;
    link?: boolean;
    allSources?: boolean;
    json: boolean;
    showConfig: boolean;
    help: boolean;
  } = {
    sourceDirs: [],
    targetDirs: [],
    physicalTargets: [],
    dryRun: false,
    noBackup: false,
    allSources: false,
    json: false,
    showConfig: false,
    help: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case '--help':
      case '-h':
        result.help = true;
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--force':
      case '--mirror':
        break;
      case '--link':
        result.link = true;
        break;
      case '--copy':
        result.link = false;
        break;
      case '--all-sources':
        result.allSources = true;
        break;
      case '--no-backup':
        result.noBackup = true;
        break;
      case '--json':
        result.json = true;
        break;
      case '--show-config':
        result.showConfig = true;
        break;
      case '--central':
        if (i + 1 >= args.length) throw new Error('--central requires a directory');
        result.central = expandPath(args[++i]);
        break;
      case '--config':
        if (i + 1 >= args.length) throw new Error('--config requires a file');
        result.configPath = expandPath(args[++i]);
        break;
      case '--physical-target': {
        if (i + 1 >= args.length) throw new Error('--physical-target requires a directory');
        result.physicalTargets.push(...splitOptionList(args[++i], arg, 'directories').map(expandPath));
        break;
      }
      case '--source':
      case '-s': {
        if (i + 1 >= args.length) throw new Error(`${arg} requires a directory`);
        for (const source of splitOptionList(args[++i], arg, 'directories').map(expandPath)) {
          result.sourceDirs.push(source);
          if (!result.sourceDir) result.sourceDir = source;
        }
        break;
      }
      case '--target':
      case '-t': {
        if (i + 1 >= args.length) throw new Error(`${arg} requires a directory`);
        result.targetDirs.push(...splitOptionList(args[++i], arg, 'directories').map(expandPath));
        break;
      }
      case '--skill': {
        const skillName = args[i + 1];
        if (!skillName || skillName.startsWith('-')) {
          throw new MissingSkillNameError('--skill requires a skill name');
        }
        const skillNames = splitOptionList(skillName, '--skill', 'skill names');
        result.targetSkills ??= [];
        result.targetSkills.push(...skillNames);
        i++;
        break;
      }
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        if (result.sourceDirs.length === 0) {
          const s = expandPath(arg);
          result.sourceDir = s;
          result.sourceDirs.push(s);
        } else {
          result.targetDirs.push(expandPath(arg));
        }
    }
    i++;
  }

  return result;
}

function printHelp(): void {
  console.log(`
reactive-skills sync-engine: source → central → satellite synchronization

Usage:
  reactive-skills sync-engine [source] [targets...] [flags]

Arguments:
  source                Optional source skills directory
  target                Satellite directory

Flags:
  --source, -s <dir>[,<dir>...]
                       Ordered sources (repeatable; overrides config sources)
  --central <dir>      Physical central directory (default: ~/.agents/skills)
  --target, -t <dir>[,<dir>...]
                       Satellite directories (repeatable; overrides config satellites)
  --physical-target <dir>[,<dir>...]
                       Satellite directories requiring physical copies (repeatable)
  --config <file>      Config file (default: ~/.agents/sync.json)
  --show-config        Show resolved config and source precedence
  --skill <name>[,<name>...]
                       Select one or more skills (repeatable; default: all skills)
  --all-sources         Add configured sources to explicit --source paths
  --dry-run             Preview changes without writing
  --link                Accepted for compatibility; linked satellites are the default
  --copy                Use physical copies for all selected satellites
  --mirror              Accepted for compatibility
  --force               Accepted for compatibility
  --no-backup           Skip timestamped backup before overwrite
  --json                Machine-readable JSON output
  --help, -h            Show this help

Default satellites (installed agent directories only):
  ~/.claude/skills
  ~/.codex/skills
  ~/.gemini/config/skills
  ~/.pi/skills
  ~/.kilocode/skills
  ~/.copilot/skills
  ~/.hermes/skills
  ~/.crew/skills
  ~/.devin/skills

Examples:
  reactive-skills-axi sync --show-config
  reactive-skills-axi sync --central ~/work/skill-registry --dry-run
  reactive-skills-axi sync --source ~/work/public,~/work/private --target ~/.codex/skills,~/.claude/skills --physical-target ~/.gemini/config/skills --dry-run
`);
}

function defaultTargets(central: string): string[] {
  const home = os.homedir();
  return [
    path.join(home, '.agents', 'skills'),
    path.join(home, '.claude', 'skills'),
    path.join(home, '.codex', 'skills'),
    path.join(home, '.gemini', 'config', 'skills'),
    path.join(home, '.pi', 'skills'),
    path.join(home, '.kilocode', 'skills'),
    path.join(home, '.copilot', 'skills'),
    path.join(home, '.hermes', 'skills'),
    path.join(home, '.crew', 'skills'),
    path.join(home, '.devin', 'skills'),
  ].filter(target => path.resolve(target) !== path.resolve(central))
    .filter(target => fs.existsSync(target) || fs.existsSync(path.dirname(target)));
}

interface FileConfig {
  sources?: string[];
  central?: string;
  satellites?: string[];
  physicalSatellites?: string[];
}

function loadConfig(configPath: string, required: boolean): FileConfig {
  if (!fs.existsSync(configPath)) {
    if (required) throw new Error(`Sync config not found: ${configPath}`);
    return {};
  }
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as FileConfig;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Invalid sync config: ${configPath}`);
  for (const field of ['sources', 'satellites', 'physicalSatellites'] as const) {
    const value = parsed[field];
    if (value !== undefined && (!Array.isArray(value) || value.some(item => typeof item !== 'string'))) {
      throw new Error(`Invalid ${field} in sync config: ${configPath}`);
    }
  }
  if (parsed.central !== undefined && typeof parsed.central !== 'string') throw new Error(`Invalid central in sync config: ${configPath}`);
  return parsed;
}

function formatReport(report: DistributionReport, json: boolean): string {
  if (json) {
    return JSON.stringify(report, null, 2);
  }

  const lines: string[] = [];
  const prefix = report.dryRun ? '[dry-run] ' : '';

  lines.push(`${prefix}Sources: ${report.sourceDirs?.length ? report.sourceDirs.join(', ') : '(none)'}`);
  lines.push(`${prefix}Central: ${report.central}`);
  lines.push(`${prefix}Skills: ${report.skillsFound} found, ${report.skillsValid} valid, ${report.skillsInvalid} invalid`);
  lines.push(`${prefix}Satellites: ${report.satellites.length} linked, ${report.physicalSatellites.length} physical`);
  lines.push('');

  for (const r of report.results) {
    const icon =
      r.action === 'linked' ? '⚯' :
      r.action === 'mirrored' ? '⇄' :
      r.action === 'unchanged' ? '=' :
      r.action === 'skipped_invalid' ? '!' :
      r.action === 'backed_up' ? '~' :
      r.action === 'skipped_overlap' ? '⊘' :
      r.action === 'removed_link' ? '−' : '?';
    const detail = r.reason || r.backupPath || '';
    lines.push(`  ${icon} ${r.skill} -> ${path.basename(r.target)} ${detail}`);
  }

  if (report.orphans.length > 0) {
    lines.push('');
    lines.push('Orphans (in dest but not source):');
    for (const o of report.orphans) {
      lines.push(`  ${path.basename(o.target)}: ${o.names.join(', ')}`);
    }
  }

  if (report.collisions.length > 0) {
    lines.push('Source precedence:');
    for (const collision of report.collisions) {
      lines.push(`  ${collision.skill}: ${collision.winner} wins over ${collision.shadowed}`);
    }
  }

  if (report.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const e of report.errors) {
      lines.push(`  ! ${e}`);
    }
  }

  lines.push('');
  lines.push(
    `${report.errors.length === 0 ? 'OK' : 'ERRORS'}: ${report.results.length} results, ${report.errors.length} errors`,
  );
  return lines.join('\n');
}

export async function executeSyncEngineCommand(args: string[]): Promise<SyncCommandResult> {
  let opts: ReturnType<typeof parseArgs>;
  try {
    opts = parseArgs(args);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    const output = args.includes('--json')
      ? JSON.stringify({ errors: [message] }, null, 2)
      : `ERROR: ${message}\n\nUse --help for usage.`;
    return { output, exitCode: 1 };
  }

  if (opts.help) {
    printHelp();
    return { output: '', exitCode: 0 };
  }

  try {
    const configPath = opts.configPath ?? path.join(os.homedir(), '.agents', 'sync.json');
    const config = loadConfig(configPath, !!opts.configPath);
    let configuredSources = (config.sources ?? []).map(expandPath);
    if (!fs.existsSync(configPath)) {
      const legacySourcesPath = path.join(os.homedir(), '.agents', 'sources.json');
      if (fs.existsSync(legacySourcesPath)) {
        try {
          const legacyConfig = JSON.parse(fs.readFileSync(legacySourcesPath, 'utf8'));
          if (Array.isArray(legacyConfig.sources)) {
            configuredSources = legacyConfig.sources
              .filter((source: unknown): source is string => typeof source === 'string')
              .map(expandPath);
          }
        } catch {
          // Preserve the former best-effort behavior for the legacy source list.
        }
      }
    }
    const sources = opts.sourceDirs.length > 0
      ? [...opts.sourceDirs, ...(opts.allSources ? configuredSources : [])]
      : configuredSources;
    const central = opts.central ?? expandPath(config.central ?? '~/.agents/skills');
    const satellites = opts.targetDirs.length > 0
      ? opts.targetDirs
      : (config.satellites?.map(expandPath) ?? defaultTargets(central));
    const configuredPhysical = (config.physicalSatellites ?? []).map(expandPath);
    let physicalSatellites = configuredPhysical;
    if (opts.targetDirs.length > 0) {
      const selected = new Set(opts.targetDirs.map(target => path.resolve(target)));
      physicalSatellites = physicalSatellites.filter(target => selected.has(path.resolve(target)));
    }
    physicalSatellites = [...physicalSatellites, ...opts.physicalTargets];
    if (opts.link === false) physicalSatellites = [...satellites, ...physicalSatellites];

    if (opts.showConfig) {
      const physical = new Set(physicalSatellites.map(target => path.resolve(target)));
      const centralPath = path.resolve(central);
      return {
        output: JSON.stringify({
          configPath,
          sources,
          central,
          satellites: satellites.filter(target => path.resolve(target) !== centralPath && !physical.has(path.resolve(target))),
          physicalSatellites: physicalSatellites.filter(target => path.resolve(target) !== centralPath),
          statePath: path.join(path.dirname(configPath), 'sync-state.json'),
        }, null, 2),
        exitCode: 0,
      };
    }

    const distributionOptions: DistributionOptions = {
      sources,
      central,
      satellites,
      physicalSatellites,
      statePath: path.join(path.dirname(configPath), 'sync-state.json'),
      targetSkills: opts.targetSkills,
      dryRun: opts.dryRun,
      backup: !opts.noBackup,
      preserveUnselectedLinks: opts.targetDirs.length > 0,
    };
    const report = runDistribution(distributionOptions);
    return {
      output: formatReport(report, opts.json),
      exitCode: (report.selectionErrors?.length ?? 0) > 0 ? 1 : 0,
    };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      output: opts.json
        ? JSON.stringify({ errors: [message] }, null, 2)
        : `ERROR: ${message}\n\nUse --help for usage.`,
      exitCode: 1,
    };
  }
}

/** Backward-compatible text-only wrapper for existing runtime and MCP callers. */
export async function syncEngineCommand(args: string[]): Promise<string> {
  const result = await executeSyncEngineCommand(args);
  return result.output;
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('sync/cli.js') ||
   process.argv[1].endsWith('sync\\cli.js') ||
   process.argv[1].endsWith('sync/cli.ts'));

if (isDirectRun) {
  executeSyncEngineCommand(process.argv.slice(2))
    .then(({ output, exitCode }) => {
      if (output) console.log(output);
      if (exitCode !== 0) process.exitCode = exitCode;
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
