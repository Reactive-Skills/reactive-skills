import fs from 'node:fs';
import path from 'node:path';

/**
 * Workspace grant that lets judgments without a configured model be decided from the agent's own
 * payload (ADR 0012). Only `reactive-skills-axi approve --allow-self-reported` writes it, after the
 * user confirms a one-time code in an interactive terminal.
 */
export interface SelfReportGrant {
  grantedAt: string;
  channel: string;
}

function grantPath(workspaceDir: string): string {
  return path.join(workspaceDir, '.reactive', 'self-report-grant.json');
}

export function readSelfReportGrant(workspaceDir: string): SelfReportGrant | undefined {
  try {
    const grant = JSON.parse(fs.readFileSync(grantPath(workspaceDir), 'utf8')) as Partial<SelfReportGrant>;
    return typeof grant.grantedAt === 'string' && typeof grant.channel === 'string'
      ? { grantedAt: grant.grantedAt, channel: grant.channel }
      : undefined;
  } catch {
    return undefined;
  }
}

export function hasSelfReportGrant(workspaceDir: string): boolean {
  return readSelfReportGrant(workspaceDir) !== undefined;
}

export function grantSelfReport(workspaceDir: string, channel: string): SelfReportGrant {
  const grant: SelfReportGrant = { grantedAt: new Date().toISOString(), channel };
  fs.mkdirSync(path.dirname(grantPath(workspaceDir)), { recursive: true });
  fs.writeFileSync(grantPath(workspaceDir), `${JSON.stringify(grant, null, 2)}\n`, 'utf8');
  return grant;
}

export function revokeSelfReport(workspaceDir: string): boolean {
  try {
    fs.rmSync(grantPath(workspaceDir));
    return true;
  } catch {
    return false;
  }
}
