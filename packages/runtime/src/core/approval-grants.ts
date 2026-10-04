import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Workspace grant that lets judgments without a configured model be decided from the agent's own
 * payload (ADR 0012). Only `reactive-skills-axi approve --allow-self-reported` writes it, after the
 * user confirms a one-time code in an interactive terminal.
 *
 * The grant is signed with a key kept in the user's home folder and bound to the workspace path, so
 * a hand-written, edited, or copied grant, including one committed to a repository, does not count.
 * An agent that deliberately reads the key can still forge one; ADR 0012 accepts that residual risk.
 */
export interface SelfReportGrant {
  grantedAt: string;
  channel: string;
  signature: string;
}

function grantPath(workspaceDir: string): string {
  return path.join(workspaceDir, '.reactive', 'self-report-grant.json');
}

function keyPath(): string {
  return path.join(os.homedir(), '.reactive-skills', 'approval-key');
}

function readKey(): Buffer | undefined {
  try {
    const hex = fs.readFileSync(keyPath(), 'utf8').trim();
    return /^[0-9a-f]{64}$/.test(hex) ? Buffer.from(hex, 'hex') : undefined;
  } catch {
    return undefined;
  }
}

function ensureKey(): Buffer {
  const existing = readKey();
  if (existing) return existing;
  fs.mkdirSync(path.dirname(keyPath()), { recursive: true });
  try {
    fs.writeFileSync(keyPath(), `${crypto.randomBytes(32).toString('hex')}\n`, { mode: 0o600, flag: 'wx' });
  } catch (err) {
    // Another approve created the key first; use that one.
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
  }
  const key = readKey();
  if (!key) throw new Error(`Approval key at ${keyPath()} is unreadable or malformed`);
  return key;
}

function canonicalWorkspace(workspaceDir: string): string {
  let resolved = path.resolve(workspaceDir);
  try {
    resolved = fs.realpathSync.native(resolved);
  } catch {
    // A workspace that does not exist yet signs by its resolved path.
  }
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function sign(key: Buffer, workspaceDir: string, grantedAt: string, channel: string): string {
  return crypto.createHmac('sha256', key).update(JSON.stringify([canonicalWorkspace(workspaceDir), grantedAt, channel])).digest('hex');
}

export function readSelfReportGrant(workspaceDir: string): SelfReportGrant | undefined {
  try {
    const grant = JSON.parse(fs.readFileSync(grantPath(workspaceDir), 'utf8')) as Partial<SelfReportGrant>;
    const key = readKey();
    if (!key || typeof grant.grantedAt !== 'string' || typeof grant.channel !== 'string' || typeof grant.signature !== 'string') {
      return undefined;
    }
    const expected = Buffer.from(sign(key, workspaceDir, grant.grantedAt, grant.channel), 'hex');
    const actual = Buffer.from(grant.signature, 'hex');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return undefined;
    return { grantedAt: grant.grantedAt, channel: grant.channel, signature: grant.signature };
  } catch {
    return undefined;
  }
}

export function hasSelfReportGrant(workspaceDir: string): boolean {
  return readSelfReportGrant(workspaceDir) !== undefined;
}

export function grantSelfReport(workspaceDir: string, channel: string): SelfReportGrant {
  const grantedAt = new Date().toISOString();
  const grant: SelfReportGrant = { grantedAt, channel, signature: sign(ensureKey(), workspaceDir, grantedAt, channel) };
  fs.mkdirSync(path.dirname(grantPath(workspaceDir)), { recursive: true });
  fs.writeFileSync(grantPath(workspaceDir), `${JSON.stringify(grant, null, 2)}\n`, 'utf8');
  return grant;
}

/** Returns false when no grant existed; any other failure throws so a revoke never reports false success. */
export function revokeSelfReport(workspaceDir: string): boolean {
  try {
    fs.rmSync(grantPath(workspaceDir));
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}
