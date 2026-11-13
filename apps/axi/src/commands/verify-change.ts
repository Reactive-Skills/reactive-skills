import { execFileSync, spawnSync } from 'node:child_process';
import {
  ATTESTATIONS_DIR,
  GOVERNANCE_DIR,
  GOVERNANCE_FILE,
  matchesGlobs,
  parseGovernance,
  sha256Hex,
  verifyRunBundle,
  type Governance,
  type GovernedEntry,
  type RunBundleManifest,
} from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderOutput } from '../toon.js';

const USAGE = 'Usage: reactive-skills-axi verify-change --base <rev> --head <rev> [--repo <dir>] [--json]';
const DEFAULT_CHECK_TIMEOUT_MS = 600_000;

interface CheckResult { name: string; skill: string; status: 'pass' | 'fail' | 'not_run'; detail?: string }
interface Report {
  result: 'pass' | 'fail';
  base: string;
  head: string;
  governance: string;
  governed_changes: string[];
  bundles: Array<{ run_id: string; skill: string; ok: boolean; human_gate_events: number }>;
  checks: CheckResult[];
  failures: string[];
  notices: string[];
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index !== -1) return args[index + 1];
  return args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

function gitIn(repo: string) {
  const run = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const show = (rev: string, file: string): Buffer | null => {
    const result = spawnSync('git', ['show', `${rev}:${file}`], { cwd: repo, maxBuffer: 256 * 1024 * 1024 });
    return result.status === 0 ? result.stdout : null;
  };
  return { run, show };
}

/**
 * Exit-boundary check for one change. Governance (paths, digest pins, checks) is read from the BASE
 * commit, so a change cannot loosen the rules that judge it or add a command for CI to run.
 * Every changed governed path must be covered by a run bundle added in the same change; the bundle's
 * chain must be intact and end sealed at a terminal success state; the sealed hash must equal the
 * head bytes; and the declared checks are re-executed here. Recorded results are never read.
 * # Performance & Risk Budget
 * - Tier: P3 (CI; dominated by git and the declared checks)
 * - Complexity: O(c * g + N + B + K), changed paths, globs, bundle events and bytes, check runtime
 * - Cyclomatic Complexity (CC): target <=20 (command orchestration)
 * - Branch Coverage: target >=85%
 * - CRAP Score: target <=25
 */
export async function verifyChangeCommand(args: string[]): Promise<string> {
  const baseRef = flag(args, '--base');
  const headRef = flag(args, '--head');
  if (!baseRef || !headRef) throw new AxiError('--base and --head are required', 'VALIDATION_ERROR', [USAGE]);
  let repo: string;
  try {
    repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: flag(args, '--repo') ?? process.cwd(), encoding: 'utf8' }).trim();
  } catch {
    throw new AxiError('verify-change must run inside a git repository', 'VALIDATION_ERROR', [USAGE]);
  }
  const git = gitIn(repo);
  const resolve = (ref: string) => {
    try {
      return git.run('rev-parse', '--verify', `${ref}^{commit}`).trim();
    } catch {
      throw new AxiError(`Unknown revision '${ref}'`, 'NOT_FOUND', ['Fetch full history in CI (fetch-depth: 0)']);
    }
  };
  const base = resolve(baseRef);
  const head = resolve(headRef);
  const report: Report = { result: 'pass', base, head, governance: `${GOVERNANCE_FILE} at base`, governed_changes: [], bundles: [], checks: [], failures: [], notices: [] };

  const governanceText = git.show(base, GOVERNANCE_FILE);
  if (governanceText === null) {
    report.governance = 'none';
    report.notices.push(`No ${GOVERNANCE_FILE} at the base commit, so nothing is governed.`);
    return finish(report, args);
  }
  let governance: Governance;
  try {
    governance = parseGovernance(governanceText.toString('utf8'));
  } catch (err) {
    report.failures.push(`${GOVERNANCE_FILE} at base is invalid: ${(err as Error).message}`);
    return finish(report, args);
  }

  const mergeBase = git.run('merge-base', base, head).trim();
  const changed = git.run('diff', '--name-only', '--no-renames', '-z', mergeBase, head).split('\0').filter(Boolean);
  if (changed.includes(GOVERNANCE_FILE)) report.notices.push(`${GOVERNANCE_FILE} changed; the new map applies only after this change merges.`);

  // Only bundles added or updated by this change count, so an old run cannot cover new work.
  const bundles = changed
    .filter(file => new RegExp(`^${ATTESTATIONS_DIR.replace('.', '\\.')}/[^/]+/manifest\\.json$`).test(file))
    .map(file => loadBundle(git.show, head, file.slice(0, -'/manifest.json'.length), report))
    .filter((bundle): bundle is RunBundleManifest => bundle !== null);

  const touchedEntries = new Set<GovernedEntry>();
  for (const file of changed) {
    if (file === GOVERNANCE_DIR || file.startsWith(`${GOVERNANCE_DIR}/`)) continue;
    const entries = governance.governed.filter(entry => matchesGlobs(file, entry.paths));
    if (entries.length === 0) continue;
    report.governed_changes.push(file);
    const headBytes = git.show(head, file);
    const headHash = headBytes === null ? null : sha256Hex(headBytes);
    for (const entry of entries) {
      touchedEntries.add(entry);
      const failure = coverage(file, headHash, entry, bundles);
      if (failure) report.failures.push(failure);
    }
  }

  runChecks([...touchedEntries], repo, head, git.run, report);
  return finish(report, args);
}

function loadBundle(show: (rev: string, file: string) => Buffer | null, head: string, dir: string, report: Report): RunBundleManifest | null {
  const manifestBytes = show(head, `${dir}/manifest.json`);
  const events = show(head, `${dir}/events.jsonl`);
  let manifest: RunBundleManifest;
  try {
    manifest = JSON.parse(manifestBytes?.toString('utf8') ?? '');
  } catch {
    report.failures.push(`${dir}: manifest.json is missing or not JSON`);
    return null;
  }
  const verified = verifyRunBundle(manifest, events?.toString('utf8') ?? '');
  report.bundles.push({ run_id: manifest.run_id, skill: manifest.skill, ok: verified.ok, human_gate_events: verified.humanGateEvents });
  for (const error of verified.errors) report.failures.push(`${dir}: ${error}`);
  // Human-gate events are reported for information only; they never fail the check.
  if (verified.humanGateEvents > 0) report.notices.push(`${dir}: ${verified.humanGateEvents} human gate event(s) recorded (informational)`);
  return verified.ok ? manifest : null;
}

/**
 * Why `file` is not covered by a valid bundle for `entry`, or null when it is.
 * # Performance & Risk Budget
 * - Tier: P0 (<1ms per path)
 * - Complexity: O(b), bundles in the change
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function coverage(file: string, headHash: string | null, entry: GovernedEntry, bundles: RunBundleManifest[]): string | null {
  const forSkill = bundles.filter(bundle => bundle.skill === entry.skill);
  if (forSkill.length === 0) return `${file}: governed by ${entry.skill}, but the change has no run record for it`;
  const pinned = entry.skill_digest ? forSkill.filter(bundle => bundle.skill_digest === entry.skill_digest) : forSkill;
  if (pinned.length === 0) return `${file}: the ${entry.skill} run used skill digest ${forSkill[0].skill_digest}, not the pinned ${entry.skill_digest}`;
  const covered = pinned.some(bundle => headHash === null ? !(file in bundle.sealed) : bundle.sealed[file] === headHash);
  if (covered) return null;
  if (headHash === null) return `${file}: deleted, but the ${entry.skill} run sealed it as present`;
  return pinned.some(bundle => file in bundle.sealed)
    ? `${file}: differs from the bytes the ${entry.skill} run sealed (edited after the run, or outside it)`
    : `${file}: not sealed by any ${entry.skill} run in the change`;
}

function runChecks(entries: GovernedEntry[], repo: string, head: string, run: (...args: string[]) => string, report: Report): void {
  const checks = entries.flatMap(entry => (entry.checks ?? []).map(check => ({ ...check, skill: entry.skill })));
  if (checks.length === 0) return;
  const current = run('rev-parse', 'HEAD').trim();
  const dirty = run('status', '--porcelain').trim();
  if (current !== head || dirty) {
    report.failures.push(`declared checks need a clean checkout of the head commit (checkout is ${current.slice(0, 12)}${dirty ? ' with local changes' : ''}, head is ${head.slice(0, 12)})`);
    for (const check of checks) report.checks.push({ name: check.name, skill: check.skill, status: 'not_run' });
    return;
  }
  for (const check of checks) {
    const result = spawnSync(check.run[0], check.run.slice(1), { cwd: repo, encoding: 'utf8', timeout: check.timeout_ms ?? DEFAULT_CHECK_TIMEOUT_MS, shell: false });
    const passed = result.status === 0 && !result.error;
    const tail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').slice(-5).join(' | ');
    report.checks.push({ name: check.name, skill: check.skill, status: passed ? 'pass' : 'fail', ...(passed ? {} : { detail: result.error?.message ?? `exit ${result.status}${tail ? `: ${tail}` : ''}` }) });
    if (!passed) report.failures.push(`check ${check.name} (${check.skill}) failed when re-executed`);
  }
}

function finish(report: Report, args: string[]): string {
  report.result = report.failures.length === 0 ? 'pass' : 'fail';
  process.exitCode = report.result === 'pass' ? 0 : 1;
  if (args.includes('--json')) return JSON.stringify(report, null, 2);
  const lines = [
    `result: ${report.result}`,
    `base: ${report.base}`,
    `head: ${report.head}`,
    `governance: ${report.governance}`,
    `governed_changes[${report.governed_changes.length}]${report.governed_changes.length ? `: ${report.governed_changes.join(', ')}` : ''}`,
    `bundles[${report.bundles.length}]:${report.bundles.map(bundle => `\n  ${bundle.skill} ${bundle.run_id} ${bundle.ok ? 'valid' : 'invalid'}`).join('')}`,
    `checks[${report.checks.length}]:${report.checks.map(check => `\n  ${check.name} (${check.skill}): ${check.status}${check.detail ? ` - ${check.detail}` : ''}`).join('')}`,
  ];
  if (report.failures.length) lines.push(`failures[${report.failures.length}]:${report.failures.map(failure => `\n  - ${failure}`).join('')}`);
  if (report.notices.length) lines.push(`notices[${report.notices.length}]:${report.notices.map(notice => `\n  - ${notice}`).join('')}`);
  return renderOutput(lines);
}
