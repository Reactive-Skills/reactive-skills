import fs from 'node:fs';
import path from 'node:path';
import {
  discoverVetTargets,
  isSkillDirectory,
  isVetSeverity,
  loadVetAllowlist,
  sanitizeForOutput,
  VET_RULES,
  vetSkills,
  VetAllowlistError,
  type VetAllowlist,
  type VetReport,
  type VetSeverity,
} from '@reactive-skills/runtime/vet';
import { resolveSkillPath } from '../args.js';
import { AxiError } from '../errors.js';
import { renderDetail, renderHelp, renderList, renderOutput } from '../toon.js';

interface VetArgs {
  target?: string;
  failOn: VetSeverity;
  allowlist?: string;
  json: boolean;
  rules: boolean;
}

const USAGE = 'Usage: reactive-skills-axi vet [path-to-skill-or-directory] [--fail-on <high|medium|low>] [--allowlist <file>] [--json] [--rules]';

function usageError(message: string, suggestions: string[] = [USAGE]): AxiError {
  return new AxiError(message, 'USAGE_ERROR', suggestions);
}

function parseArgs(args: string[]): VetArgs {
  const parsed: VetArgs = { failOn: 'high', json: false, rules: false };
  const valueOf = (flag: string, index: number): string => {
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) throw usageError(`${flag} needs a value`);
    return value;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const [flag, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    if (flag === '--json') parsed.json = true;
    else if (flag === '--rules') parsed.rules = true;
    else if (flag === '--fail-on') {
      const value = inline ?? valueOf(flag, i++);
      if (!isVetSeverity(value)) throw usageError(`--fail-on must be high, medium or low, not "${sanitizeForOutput(value, 40)}"`);
      parsed.failOn = value;
    } else if (flag === '--allowlist') {
      parsed.allowlist = inline ?? valueOf(flag, i++);
    } else if (arg.startsWith('-')) {
      throw usageError(`Unknown flag: ${sanitizeForOutput(arg, 40)}`);
    } else if (parsed.target === undefined) {
      parsed.target = arg;
    } else {
      throw usageError('vet takes one path');
    }
  }
  return parsed;
}

/** A path, a skill name resolved the way other commands do, or the current directory's skills. */
function resolveTarget(target: string | undefined): string {
  const cwd = process.cwd();
  if (target) {
    const asPath = path.resolve(cwd, target);
    if (fs.existsSync(asPath)) {
      // A path to a skill's manifest or SKILL.md stands for its directory, as it does for validate.
      if (fs.statSync(asPath).isFile() && /^(?:skill\.ya?ml|SKILL\.md)$/.test(path.basename(asPath))) return path.dirname(asPath);
      // A link named on the command line is followed. Links found inside a directory are reported, not walked.
      return fs.lstatSync(asPath).isSymbolicLink() ? fs.realpathSync(asPath) : asPath;
    }
    const byName = resolveSkillPath(target);
    if (byName) return byName;
    throw usageError(`Skill not found at "${sanitizeForOutput(target, 80)}"`, ['Pass a skill directory, or a directory of skills', USAGE]);
  }
  if (isSkillDirectory(cwd)) return cwd;
  const skillsDir = path.join(cwd, 'skills');
  if (fs.existsSync(skillsDir)) return skillsDir;
  throw usageError('No skills found to vet in the current directory', ['Run from a skill directory, or pass a path', USAGE]);
}

function realPathOrSelf(value: string): string {
  try {
    return fs.realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

/** An allowlist the skills ship themselves would let a skill approve its own findings. */
function loadAllowlist(file: string, skillDirs: string[]): VetAllowlist {
  const real = realPathOrSelf(file);
  for (const dir of skillDirs) {
    const rel = path.relative(realPathOrSelf(dir), real);
    if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      throw usageError(`The allowlist ${file} is inside a skill being vetted`, ['Keep the allowlist outside the skills it covers, so reviewers approve it separately from the skill']);
    }
  }
  try {
    return loadVetAllowlist(file);
  } catch (err) {
    if (err instanceof VetAllowlistError) throw usageError(err.message, ['Each entry needs skill, rule, path and reason; the format is documented at https://github.com/Reactive-Skills/reactive-skills/blob/main/docs/vetting.md']);
    throw err;
  }
}

/** Skill-supplied names are printed, so control and format characters are escaped first. */
function toOutput(report: VetReport): VetReport {
  const clean = (value: string): string => sanitizeForOutput(value);
  return {
    ...report,
    skills: report.skills.map((skill) => ({
      ...skill,
      skill: clean(skill.skill),
      path: clean(skill.path),
      findings: skill.findings.map((finding) => ({ ...finding, file: clean(finding.file) })),
      suppressed: skill.suppressed.map((finding) => ({ ...finding, file: clean(finding.file), reason: clean(finding.reason) })),
    })),
    unusedAllowlist: report.unusedAllowlist.map((entry) => ({ ...entry, skill: clean(entry.skill), path: clean(entry.path) })),
  };
}

function renderRules(json: boolean): string {
  if (json) return JSON.stringify({ rules: VET_RULES }, null, 2);
  return renderOutput([
    renderList(
      'rules',
      VET_RULES.map((rule) => ({ id: rule.id, severity: rule.severity, summary: rule.summary })),
      [
        { type: 'field', key: 'id' },
        { type: 'field', key: 'severity' },
        { type: 'field', key: 'summary' },
      ]
    ),
    renderHelp(['Run `reactive-skills-axi vet <path>` to scan skills with these rules']),
  ]);
}

function renderReport(report: VetReport): string {
  const { summary } = report;
  const blocks: Array<string | undefined> = [
    renderDetail(
      'vet',
      {
        status: report.failed ? 'fail' : 'pass',
        fail_on: report.failOn,
        skills: summary.skills,
        files: summary.filesScanned,
        high: summary.high,
        medium: summary.medium,
        low: summary.low,
        suppressed: summary.suppressed,
      },
      [
        { type: 'field', key: 'status' },
        { type: 'field', key: 'fail_on' },
        { type: 'field', key: 'skills' },
        { type: 'field', key: 'files' },
        { type: 'field', key: 'high' },
        { type: 'field', key: 'medium' },
        { type: 'field', key: 'low' },
        { type: 'field', key: 'suppressed' },
      ]
    ),
  ];

  const findings = report.skills.flatMap((skill) => skill.findings.map((finding) => ({ skill: skill.skill, ...finding })));
  blocks.push(
    renderList('findings', findings.map((finding) => ({ ...finding, guard: finding.guard ? 'yes' : '' })), [
      { type: 'field', key: 'skill' },
      { type: 'field', key: 'severity' },
      { type: 'field', key: 'rule' },
      { type: 'field', key: 'file' },
      { type: 'field', key: 'line' },
      { type: 'field', key: 'count' },
      { type: 'field', key: 'guard' },
      { type: 'field', key: 'message' },
    ])
  );

  const suppressed = report.skills.flatMap((skill) => skill.suppressed.map((finding) => ({ skill: skill.skill, ...finding })));
  blocks.push(
    renderList('suppressed', suppressed, [
      { type: 'field', key: 'skill' },
      { type: 'field', key: 'rule' },
      { type: 'field', key: 'file' },
      { type: 'field', key: 'line' },
      { type: 'field', key: 'reason' },
    ])
  );
  blocks.push(
    renderList('unused_allowlist', report.unusedAllowlist, [
      { type: 'field', key: 'skill' },
      { type: 'field', key: 'rule' },
      { type: 'field', key: 'path' },
    ])
  );

  const help: string[] = [];
  if (report.failed) help.push(`Review the findings at or above ${report.failOn}; remove the risky use, or add a reviewed allowlist entry with a reason`);
  else if (findings.length === 0) help.push('No findings; vet is a static check, so it does not prove a skill is safe');
  else help.push(`No findings at or above ${report.failOn}; lower findings are listed for review`);
  if (report.unusedAllowlist.length > 0) help.push('Delete the unused allowlist entries listed above');
  blocks.push(renderHelp(help));
  return renderOutput(blocks);
}

/** `vet` command: statically scan skills against the runtime's shared rule set. */
export async function vetCommand(args: string[]): Promise<string> {
  const parsed = parseArgs(args);
  if (parsed.rules) return renderRules(parsed.json);

  const target = resolveTarget(parsed.target);
  let skillDirs: string[];
  try {
    skillDirs = discoverVetTargets(target);
  } catch (err) {
    throw usageError((err as Error).message);
  }
  if (skillDirs.length === 0) {
    throw usageError(`No skills found under "${sanitizeForOutput(parsed.target ?? target, 80)}"`, ['A skill directory has a skill.yaml or SKILL.md', USAGE]);
  }

  const allowlist = parsed.allowlist ? loadAllowlist(parsed.allowlist, skillDirs) : undefined;
  let report: VetReport;
  try {
    report = vetSkills(skillDirs, { failOn: parsed.failOn, allowlist });
  } catch (err) {
    throw usageError((err as Error).message);
  }

  process.exitCode = report.failed ? 1 : 0;
  const output = toOutput(report);
  return parsed.json ? JSON.stringify(output, null, 2) : renderReport(output);
}
