import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { SignalEvent, SkillManifest, StateDefinition } from './types.js';

/**
 * Exit-boundary governance: which repository paths only change through a recorded reactive run,
 * and the run bundle a change carries so a required check can verify it.
 *
 * Everything lives under `.reactive-governance/`, outside the gitignored `.reactive/` runtime
 * state, so the map and the bundles reach the pull request.
 *
 * Integrity, not identity: the bundle's hash chain is computed when the run is exported and is
 * unkeyed. It detects a bundle edited after export. Anyone able to recompute the whole bundle can
 * still forge it, which is why the exit check also compares sealed hashes with the head bytes and
 * re-executes the declared checks itself instead of reading any recorded result.
 */
export const GOVERNANCE_DIR = '.reactive-governance';
export const GOVERNANCE_FILE = `${GOVERNANCE_DIR}/governance.yaml`;
export const ATTESTATIONS_DIR = `${GOVERNANCE_DIR}/attestations`;
export const RUN_BUNDLE_FORMAT = 'reactive-run-bundle/v1';
export const GENESIS_HASH = '0'.repeat(64);

const CheckSchema = z.object({
  name: z.string().min(1),
  /** Literal argv, run without a shell from the repository root of the head checkout. */
  run: z.array(z.string()).min(1),
  timeout_ms: z.number().int().positive().max(3_600_000).optional(),
}).strict();

const GovernedEntrySchema = z.object({
  paths: z.array(z.string().min(1)).min(1),
  skill: z.string().min(1),
  skill_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  checks: z.array(CheckSchema).optional(),
}).strict();

export const GovernanceSchema = z.object({
  version: z.literal(1),
  governed: z.array(GovernedEntrySchema).default([]),
}).strict();

export type Governance = z.infer<typeof GovernanceSchema>;
export type GovernedEntry = z.infer<typeof GovernedEntrySchema>;

export interface RunBundleManifest {
  format: typeof RUN_BUNDLE_FORMAT;
  skill: string;
  run_id: string;
  skill_digest: string;
  terminal_state: string;
  head_hash: string;
  event_count: number;
  sealed: Record<string, string>;
  exported_at: string;
}

export function parseGovernance(text: string): Governance {
  return GovernanceSchema.parse(yaml.load(text) ?? {});
}

/**
 * Translate a path glob (`**` any depth, `*` and `?` within one segment) into an anchored regex.
 * # Performance & Risk Budget
 * - Tier: P0 (<1ms)
 * - Complexity: O(g), glob length
 * - Cyclomatic Complexity (CC): target <=6
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=8
 */
export function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/';
      source += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

export function matchesGlobs(relativePath: string, globs: string[]): boolean {
  return globs.some(glob => globToRegExp(glob).test(relativePath));
}

export function sha256Hex(bytes: string | Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function walkFiles(root: string, dir: string, skip: Set<string>, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(root, full, skip, out);
    else if (entry.isFile()) out.push(path.relative(root, full).split(path.sep).join('/'));
  }
}

/**
 * Content digest of a skill folder: sorted relative paths with their file hashes.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms for a typical skill folder)
 * - Complexity: O(f log f + B), files and their bytes
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=3
 */
export function skillDigest(skillDir: string): string {
  const files: string[] = [];
  walkFiles(skillDir, skillDir, new Set(['.git', 'node_modules', '.reactive']), files);
  const hash = crypto.createHash('sha256');
  for (const file of files.sort()) hash.update(`${file}\0${sha256Hex(fs.readFileSync(path.join(skillDir, file)))}\n`);
  return `sha256:${hash.digest('hex')}`;
}

/**
 * Files under `workspaceDir` matching any glob, hashed. Only the static prefix of each glob is walked.
 * # Performance & Risk Budget
 * - Tier: P3 (bounded by the governed trees; not on a per-call path)
 * - Complexity: O(f * g + B), files under the glob prefixes, globs and their bytes
 * - Cyclomatic Complexity (CC): target <=5
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=6
 */
export function sealGovernedFiles(workspaceDir: string, globs: string[]): Record<string, string> {
  const sealed: Record<string, string> = {};
  const skip = new Set(['.git', 'node_modules', '.reactive', GOVERNANCE_DIR]);
  for (const glob of globs) {
    const prefix = glob.split('/').filter((segment, index, all) => !/[*?]/.test(all.slice(0, index + 1).join('/'))).join('/');
    const files: string[] = [];
    const start = path.join(workspaceDir, prefix);
    if (fs.existsSync(start) && fs.statSync(start).isFile()) files.push(prefix);
    else walkFiles(workspaceDir, start, skip, files);
    for (const file of files) {
      if (globToRegExp(glob).test(file)) sealed[file] = sha256Hex(fs.readFileSync(path.join(workspaceDir, file)));
    }
  }
  return Object.fromEntries(Object.entries(sealed).sort(([a], [b]) => a.localeCompare(b)));
}

const FAILURE_STATES = new Set(['ERROR', 'BYPASS_DETECTED', 'ABORTED', 'FAILED', 'CANCELLED', 'BLOCKED']);

/**
 * A run ended well when its leaf state has nowhere to go and is not a failure state.
 * # Performance & Risk Budget
 * - Tier: P0 (<1ms)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=5
 */
export function isTerminalSuccessState(leaf: StateDefinition | null | undefined, statePath: string): boolean {
  if (!leaf) return false;
  const name = (statePath.split('.').pop() ?? statePath).toUpperCase();
  if (FAILURE_STATES.has(name)) return false;
  return Object.keys(leaf.transitions ?? {}).length === 0 && Object.keys(leaf.substates ?? {}).length === 0;
}

/**
 * Serialize events as hash-chained JSONL: each line carries `prev_hash`, the SHA-256 of the line before it.
 * # Performance & Risk Budget
 * - Tier: P2 (O(N) export, not a per-call path)
 * - Complexity: O(N + B), events and their bytes
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=3
 */
export function chainEvents(events: SignalEvent[]): { text: string; head: string } {
  let prev = GENESIS_HASH;
  const lines: string[] = [];
  for (const event of events) {
    const line = JSON.stringify({ ...event, prev_hash: prev });
    lines.push(line);
    prev = sha256Hex(line);
  }
  return { text: lines.length ? `${lines.join('\n')}\n` : '', head: prev };
}

export interface BundleVerification {
  ok: boolean;
  errors: string[];
  events: Array<SignalEvent & { prev_hash: string }>;
  finalState?: string;
  humanGateEvents: number;
}

/**
 * Re-walk a bundle: chain intact from SKILL_INITIALIZED, ending in ARTIFACTS_SEALED whose seal and
 * terminal state agree with the manifest and with the folded transitions, at a state that is not a failure. Recorded check results
 * are never consulted here.
 * # Performance & Risk Budget
 * - Tier: P3 (O(N) per bundle in CI)
 * - Complexity: O(N + B), events and their bytes
 * - Cyclomatic Complexity (CC): target <=15
 * - Branch Coverage: target >=85%
 * - CRAP Score: target <=20
 */
export function verifyRunBundle(manifest: RunBundleManifest, eventsText: string): BundleVerification {
  const errors: string[] = [];
  const events: Array<SignalEvent & { prev_hash: string }> = [];
  const lines = eventsText.split('\n').filter(line => line.length > 0);
  let prev = GENESIS_HASH;
  for (const [index, line] of lines.entries()) {
    let event: SignalEvent & { prev_hash: string };
    try {
      event = JSON.parse(line);
    } catch {
      errors.push(`hash chain broken at line ${index + 1}: not JSON`);
      break;
    }
    if (event.prev_hash !== prev) {
      errors.push(`hash chain broken at line ${index + 1}: prev_hash does not match the line before it`);
      break;
    }
    events.push(event);
    prev = sha256Hex(line);
  }
  if (errors.length === 0 && prev !== manifest.head_hash) errors.push('hash chain head does not match the manifest head_hash');
  if (manifest.format !== RUN_BUNDLE_FORMAT) errors.push(`unknown bundle format '${manifest.format}'`);
  const first = events[0];
  const last = events.at(-1);
  if (first?.type !== 'SKILL_INITIALIZED') errors.push('chain does not start at SKILL_INITIALIZED');
  if (last?.type !== 'ARTIFACTS_SEALED') errors.push('chain does not end at ARTIFACTS_SEALED');
  if (events.some(event => event.run_id && event.run_id !== manifest.run_id)) errors.push('chain holds events from another run');
  let finalState: string | undefined = first?.payload?.initial_state;
  for (const event of events) if (event.type === 'STATE_TRANSITION' && typeof event.payload?.to === 'string') finalState = event.payload.to;
  if (last?.type === 'ARTIFACTS_SEALED') {
    const sealedPayload = last.payload as { sealed?: Record<string, string>; skill_digest?: string; terminal_state?: string };
    if (JSON.stringify(sealedPayload.sealed ?? {}) !== JSON.stringify(manifest.sealed)) errors.push('manifest sealed hashes differ from the sealed event in the chain');
    if (sealedPayload.skill_digest !== manifest.skill_digest) errors.push('manifest skill_digest differs from the sealed event in the chain');
    if (sealedPayload.terminal_state !== finalState || manifest.terminal_state !== finalState) errors.push(`terminal state does not match the recorded transitions (${finalState ?? 'none'})`);
  }
  if (finalState && FAILURE_STATES.has((finalState.split('.').pop() ?? finalState).toUpperCase())) errors.push(`run ended in failure state ${finalState}`);
  const humanGateEvents = events.filter(event => event.type.startsWith('HUMAN_')).length;
  return { ok: errors.length === 0, errors, events, finalState, humanGateEvents };
}

export interface ExportedBundle {
  dir: string;
  manifest: RunBundleManifest;
}

/**
 * Seal the governed files for this skill, append ARTIFACTS_SEALED to the run, and write the bundle.
 * A run is sealed once; exporting it again rewrites the bundle from the first seal.
 * `append` writes one event to the run's ledger; `events` returns the run's events afterwards.
 * # Performance & Risk Budget
 * - Tier: P3 (export once per run)
 * - Complexity: O(N + f + B), run events, governed files and their bytes
 * - Cyclomatic Complexity (CC): target <=6
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=8
 */
export function exportRunBundle(options: {
  workspaceDir: string;
  skillDir: string;
  manifest: SkillManifest;
  runId: string;
  terminalState: string;
  append: (type: string, payload: Record<string, unknown>) => void;
  events: () => SignalEvent[];
}): ExportedBundle {
  // Seal once per run: a later export reuses the first seal and the chain up to it, so it cannot bless edits made after the run.
  const isSeal = (event: SignalEvent) => event.type === 'ARTIFACTS_SEALED';
  let all = options.events();
  if (!all.some(isSeal)) {
    const governanceFile = path.join(options.workspaceDir, GOVERNANCE_FILE);
    const governance = fs.existsSync(governanceFile) ? parseGovernance(fs.readFileSync(governanceFile, 'utf8')) : { version: 1 as const, governed: [] };
    const globs = governance.governed.filter(entry => entry.skill === options.manifest.name).flatMap(entry => entry.paths);
    options.append('ARTIFACTS_SEALED', { sealed: sealGovernedFiles(options.workspaceDir, globs), skill_digest: skillDigest(options.skillDir), terminal_state: options.terminalState, governed_paths: globs });
    all = options.events();
  }
  const events = all.slice(0, all.findIndex(isSeal) + 1);
  const seal = events.at(-1)?.payload as { sealed: Record<string, string>; skill_digest: string; terminal_state: string };
  const { text, head } = chainEvents(events);
  const manifest: RunBundleManifest = {
    format: RUN_BUNDLE_FORMAT,
    skill: options.manifest.name,
    run_id: options.runId,
    skill_digest: seal.skill_digest,
    terminal_state: seal.terminal_state,
    head_hash: head,
    event_count: events.length,
    sealed: seal.sealed,
    exported_at: new Date().toISOString(),
  };
  const dir = path.join(options.workspaceDir, ATTESTATIONS_DIR, options.runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'events.jsonl'), text, 'utf8');
  fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { dir, manifest };
}
