import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Workspace grant that lets judgments without a configured model be decided from the agent's own
 * payload (ADR 0012). Only `reactive-skills-axi approve --allow-self-reported` writes it, after the
 * user confirms a one-time code in an interactive terminal.
 *
 * The grant lives in the user's home folder, keyed by the workspace path, and never in the
 * workspace. A file copied, committed, or restored into a workspace cannot enable self-report, and a
 * revoke cannot be undone that way. An agent that deliberately writes to the home folder can still
 * create a grant; ADR 0012 accepts that residual risk.
 */
export interface SelfReportGrant {
  workspace: string;
  grantedAt: string;
  channel: string;
}

function canonicalWorkspace(workspaceDir: string): string {
  let resolved = path.resolve(workspaceDir);
  try {
    resolved = fs.realpathSync.native(resolved);
  } catch {
    // A workspace that does not exist yet is keyed by its resolved path.
  }
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** Where the grant for a workspace lives; it depends on the home folder of the process. */
export function selfReportGrantPath(workspaceDir: string): string {
  const id = crypto.createHash('sha256').update(canonicalWorkspace(workspaceDir)).digest('hex').slice(0, 32);
  return path.join(os.homedir(), '.reactive-skills', 'grants', `${id}.json`);
}

export function readSelfReportGrant(workspaceDir: string): SelfReportGrant | undefined {
  try {
    const grant = JSON.parse(fs.readFileSync(selfReportGrantPath(workspaceDir), 'utf8')) as Partial<SelfReportGrant>;
    if (grant.workspace !== canonicalWorkspace(workspaceDir)) return undefined;
    return typeof grant.grantedAt === 'string' && typeof grant.channel === 'string'
      ? { workspace: grant.workspace, grantedAt: grant.grantedAt, channel: grant.channel }
      : undefined;
  } catch {
    return undefined;
  }
}

export function hasSelfReportGrant(workspaceDir: string): boolean {
  return readSelfReportGrant(workspaceDir) !== undefined;
}

export function grantSelfReport(workspaceDir: string, channel: string): SelfReportGrant {
  const grant: SelfReportGrant = { workspace: canonicalWorkspace(workspaceDir), grantedAt: new Date().toISOString(), channel };
  const file = selfReportGrantPath(workspaceDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write then rename, so a concurrent reader never sees a partial grant.
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(grant, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, file);
  } catch (err) {
    fs.rmSync(temp, { force: true });
    throw err;
  }
  return grant;
}

/** Returns false when no grant existed; any other failure throws so a revoke never reports false success. */
export function revokeSelfReport(workspaceDir: string): boolean {
  try {
    fs.rmSync(selfReportGrantPath(workspaceDir));
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}
