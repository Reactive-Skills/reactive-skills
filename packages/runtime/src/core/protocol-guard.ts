import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * State shared by the host protocol guard (`reactive-skills-guard.sh`) and the AXI verbs that
 * satisfy or disable it. It lives in the user's home folder, never in the workspace, so a file
 * committed or copied into a workspace cannot clear an obligation (the same rule as ADR 0012
 * grants). An agent that deliberately writes to the home folder can still forge it; the guard
 * denies write-tool edits there while a session is engaged, and shell writes are out of its scope.
 *
 * The shell guard reads these files with jq, so every path and shape here is part of its contract.
 */
export interface GuardSessionRecord {
  /** Skills loaded in the session (Skill tool or a human `/name` prompt), keyed by name. */
  required?: Record<string, string>;
  /** Runs this session set aside with a reason, keyed by run id. */
  park?: Record<string, { skill: string; reason: string; at: string }>;
  /** Set only from the human's own `/reactive-guard off <reason>` prompt. */
  off?: { reason: string; at: string } | null;
}

export interface GuardOffGrant {
  workspace: string;
  grantedAt: string;
  channel: string;
  reason: string;
}

const SAFE_SESSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function guardHome(home = os.homedir()): string {
  return path.join(home, '.reactive-skills', 'guard');
}

export function isSafeGuardSession(session: string): boolean {
  return SAFE_SESSION.test(session);
}

export function guardSessionPath(session: string, home = os.homedir()): string {
  if (!isSafeGuardSession(session)) throw new Error(`Invalid host session id '${session}'`);
  return path.join(guardHome(home), 'sessions', `${session}.json`);
}

/**
 * Nearest directory at or above `start` that holds reactive run state; `start` itself when none does.
 * The shell guard walks the same way, so both sides key grants by the same workspace.
 * # Performance & Risk Budget
 * - Tier: P0 (<1ms)
 * - Complexity: O(d), directory depth
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=5
 */
export function guardWorkspaceRoot(start: string): string {
  let dir = canonical(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.reactive', 'skills'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return canonical(start);
    dir = parent;
  }
}

function canonical(dir: string): string {
  try {
    return fs.realpathSync.native(path.resolve(dir));
  } catch {
    return path.resolve(dir);
  }
}

/** Grant file for a workspace; the shell guard computes `sha256(realpath)[0:32]` the same way. */
export function guardOffGrantPath(workspaceDir: string, home = os.homedir()): string {
  const id = crypto.createHash('sha256').update(guardWorkspaceRoot(workspaceDir)).digest('hex').slice(0, 32);
  return path.join(home, '.reactive-skills', 'grants', `guard-off-${id}.json`);
}

/**
 * Read a session record; an absent or unreadable record is empty.
 * # Performance & Risk Budget
 * - Tier: P0 (<1ms)
 * - Complexity: O(b), record bytes
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=3
 */
export function readGuardSession(session: string, home = os.homedir()): GuardSessionRecord {
  try {
    return JSON.parse(fs.readFileSync(guardSessionPath(session, home), 'utf8')) as GuardSessionRecord;
  } catch {
    return {};
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, file);
  } catch (err) {
    fs.rmSync(temp, { force: true });
    throw err;
  }
}

/**
 * Append one line to the guard log the shell guard also writes.
 * # Performance & Risk Budget
 * - Tier: P0 (<1ms)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=1
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=2
 */
export function appendGuardLog(session: string | null, event: string, detail: string, home = os.homedir()): void {
  fs.mkdirSync(guardHome(home), { recursive: true });
  fs.appendFileSync(path.join(guardHome(home), 'guard-log.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), session, event, detail })}\n`, 'utf8');
}

/**
 * Record that a session sets a run aside. Refused when the session loaded that skill itself.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms)
 * - Complexity: O(b), record bytes
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=3
 */
export function recordGuardPark(session: string, runId: string, skill: string, reason: string, home = os.homedir()): void {
  const record = readGuardSession(session, home);
  if (record.required?.[skill]) {
    throw new Error(`'${skill}' was loaded in this session, so it cannot be parked: run it, or stop and tell the user why it cannot run`);
  }
  const park = { ...(record.park ?? {}), [runId]: { skill, reason, at: new Date().toISOString() } };
  writeJsonAtomic(guardSessionPath(session, home), { ...record, park });
  appendGuardLog(session, 'park', `${skill}:${runId}: ${reason}`, home);
}

export function readGuardOffGrant(workspaceDir: string, home = os.homedir()): GuardOffGrant | undefined {
  try {
    const grant = JSON.parse(fs.readFileSync(guardOffGrantPath(workspaceDir, home), 'utf8')) as GuardOffGrant;
    return grant.workspace === guardWorkspaceRoot(workspaceDir) ? grant : undefined;
  } catch {
    return undefined;
  }
}

/** Only `reactive-skills-axi guard off`, after an interactive one-time code, calls this. */
export function grantGuardOff(workspaceDir: string, reason: string, channel: string, home = os.homedir()): GuardOffGrant {
  const grant: GuardOffGrant = { workspace: guardWorkspaceRoot(workspaceDir), grantedAt: new Date().toISOString(), channel, reason };
  writeJsonAtomic(guardOffGrantPath(workspaceDir, home), grant);
  appendGuardLog(null, 'guard-off-workspace', `${grant.workspace}: ${reason}`, home);
  return grant;
}

export function revokeGuardOff(workspaceDir: string, home = os.homedir()): boolean {
  try {
    fs.rmSync(guardOffGrantPath(workspaceDir, home));
    appendGuardLog(null, 'guard-on-workspace', guardWorkspaceRoot(workspaceDir), home);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}
