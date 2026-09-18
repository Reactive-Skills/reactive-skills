import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runSync } from './engine.js';
import { SyncReport } from './types.js';

function expandPath(p: string): string {
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(p);
}

function parseArgs(args: string[]): {
  sourceDir?: string;
  sourceDirs: string[];
  targetDirs: string[];
  targetSkill?: string;
  dryRun: boolean;
  noBackup: boolean;
  link?: boolean;
  allSources?: boolean;
  json: boolean;
  help: boolean;
} {
  const result: {
    sourceDir?: string;
    sourceDirs: string[];
    targetDirs: string[];
    targetSkill?: string;
    dryRun: boolean;
    noBackup: boolean;
    link?: boolean;
    allSources?: boolean;
    json: boolean;
    help: boolean;
  } = {
    sourceDirs: [],
    targetDirs: [],
    dryRun: false,
    noBackup: false,
    allSources: false,
    json: false,
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
      case '--source':
      case '-s':
        if (i + 1 < args.length) {
          const s = expandPath(args[++i]);
          result.sourceDirs.push(s);
          if (!result.sourceDir) result.sourceDir = s;
        }
        break;
      case '--target':
      case '-t':
        if (i + 1 < args.length) {
          result.targetDirs.push(expandPath(args[++i]));
        }
        break;
      case '--skill':
        if (i + 1 < args.length) {
          result.targetSkill = args[++i];
        }
        break;
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
reactive-skills sync-engine: Locked mirror/PUT skill synchronization

Usage:
  reactive-skills sync-engine [source] [targets...] [flags]

Arguments:
  source                Source skills directory (default: ~/.agents/skills)
  target                One or more target directories (default: all known satellites)

Flags:
  --source, -s <dir>    Source skills directory
  --target, -t <dir>    Add a target directory (repeatable)
  --skill <name>        Sync a specific skill only
  --dry-run             Preview changes without writing
  --link                Use symlinks/junctions instead of physical file copy (preferred)
  --copy                Force physical file copy (opposite of --link)
  --mirror              Mirror mode (default): destination becomes identical to source payload
  --force               Accepted but no-op (mirror is the only mode)
  --no-backup           Skip timestamped backup before overwrite
  --json                Machine-readable JSON output
  --help, -h            Show this help

Satellites (default targets):
  ~/.agents/skills
  ~/.claude/skills
  ~/.codex/skills
  ~/.gemini/config/skills
  ~/.pi/skills
  ~/.kilocode/skills
  ~/.copilot/skills
  ~/.hermes/skills
  ~/.crew/skills
  ~/.devin/skills
`);
}

function defaultTargets(): string[] {
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
  ];
}

function formatReport(report: SyncReport, json: boolean): string {
  if (json) {
    return JSON.stringify(report, null, 2);
  }

  const lines: string[] = [];
  const prefix = report.dryRun ? '[dry-run] ' : '';

  lines.push(`${prefix}Source: ${report.sourceDir}`);
  lines.push(
    `${prefix}Skills: ${report.skillsFound} found, ${report.skillsValid} valid, ${report.skillsInvalid} invalid`,
  );
  lines.push(`${prefix}Targets: ${report.targetDirs.length}`);
  lines.push('');

  for (const r of report.results) {
    const icon =
      r.action === 'linked' ? '⚯' :
      r.action === 'mirrored' ? '⇄' :
      r.action === 'unchanged' ? '=' :
      r.action === 'skipped_invalid' ? '!' :
      r.action === 'backed_up' ? '~' :
      r.action === 'skipped_overlap' ? '⊘' : '?';
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

export async function syncEngineCommand(args: string[]): Promise<string> {
  let opts: ReturnType<typeof parseArgs>;
  try {
    opts = parseArgs(args);
  } catch (err: any) {
    return `ERROR: ${err.message}\n\nUse --help for usage.`;
  }

  if (opts.help) {
    printHelp();
    return '';
  }

  let sourceDirs: string[] = [...opts.sourceDirs];

  // If --all-sources or no source was explicitly passed via CLI, load ~/.agents/sources.json
  const sourcesCfgPath = path.join(os.homedir(), '.agents', 'sources.json');
  if ((opts.allSources || sourceDirs.length === 0) && fs.existsSync(sourcesCfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(sourcesCfgPath, 'utf8'));
      if (Array.isArray(cfg.sources)) {
        for (const s of cfg.sources) {
          const exp = expandPath(s);
          if (!sourceDirs.includes(exp)) {
            sourceDirs.push(exp);
          }
        }
      }
    } catch {}
  }

  // If still no sources found, check if current working directory is a skill repo
  if (sourceDirs.length === 0) {
    const cwd = process.cwd();
    const hasSkillYaml = fs.existsSync(path.join(cwd, 'skill.yaml'));
    const hasSkillsDir = fs.existsSync(path.join(cwd, 'skills'));
    if (hasSkillYaml || hasSkillsDir) {
      sourceDirs.push(cwd);
    } else {
      sourceDirs.push(path.join(os.homedir(), '.agents', 'skills'));
    }
  }

  const targetDirs = opts.targetDirs.length > 0 ? opts.targetDirs : defaultTargets();

  const report = runSync({
    sourceDirs,
    sourceDir: sourceDirs[0],
    targetDirs,
    targetSkill: opts.targetSkill,
    dryRun: opts.dryRun,
    backup: !opts.noBackup,
    link: opts.link,
  });

  return formatReport(report, opts.json);
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('sync/cli.js') ||
   process.argv[1].endsWith('sync\\cli.js') ||
   process.argv[1].endsWith('sync/cli.ts'));

if (isDirectRun) {
  syncEngineCommand(process.argv.slice(2))
    .then((output) => {
      if (output) console.log(output);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}