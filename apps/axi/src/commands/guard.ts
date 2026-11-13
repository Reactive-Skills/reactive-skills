import path from 'node:path';
import { guardOffGrantPath, guardWorkspaceRoot, grantGuardOff, readGuardOffGrant, readGuardSession, revokeGuardOff, hostSessionIds } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderDetail, renderOutput } from '../toon.js';
import { generateApprovalCode, lineReader, type ApproveIO, type ApproveOptions } from './approve.js';

const USAGE = [
  'Usage: reactive-skills-axi guard off --reason "<why>" [--workspace-dir <dir>]',
  'Usage: reactive-skills-axi guard on [--workspace-dir <dir>]',
  'Usage: reactive-skills-axi guard status [--workspace-dir <dir>] [--session <id>]',
];

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index !== -1) return args[index + 1];
  return args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

/**
 * Turn the protocol guard off for a workspace (interactive terminal and one-time code only), back on, or show it.
 * There is deliberately no environment variable or workspace file for this: an agent could set either.
 * # Performance & Risk Budget
 * - Tier: P2 cold command (<100ms excluding the person typing)
 * - Complexity: O(d + b), workspace depth and record bytes
 * - Cyclomatic Complexity (CC): target <=10
 * - Branch Coverage: target >=85%
 * - CRAP Score: target <=12
 */
export async function guardCommand(args: string[], io: ApproveIO = { input: process.stdin, output: process.stdout }, options: ApproveOptions = {}): Promise<string> {
  const action = args[0];
  const workspace = guardWorkspaceRoot(path.resolve(flag(args, '--workspace-dir') ?? process.cwd()));
  if (action === 'on') {
    const removed = revokeGuardOff(workspace);
    return renderOutput([renderDetail('guard', { workspace, guard: 'on', grant_removed: removed ? 'yes' : 'none' },
      ['workspace', 'guard', 'grant_removed'].map(key => ({ type: 'field' as const, key })))]);
  }
  if (action === 'status') {
    const grant = readGuardOffGrant(workspace);
    const session = flag(args, '--session') ?? hostSessionIds()[0];
    const record = session ? readGuardSession(session) : {};
    return renderOutput([renderDetail('guard', {
      workspace,
      guard: grant ? `off for this workspace since ${grant.grantedAt} (${grant.reason})` : 'on',
      session: session ?? 'unknown',
      session_off: record.off ? record.off.reason : 'no',
      parked_runs: Object.keys(record.park ?? {}).length,
      required_skills: Object.keys(record.required ?? {}).join(',') || 'none',
    }, ['workspace', 'guard', 'session', 'session_off', 'parked_runs', 'required_skills'].map(key => ({ type: 'field' as const, key })))]);
  }
  if (action !== 'off') throw new AxiError(`Unknown guard action '${action ?? ''}'`, 'USAGE_ERROR', USAGE);

  const reason = flag(args, '--reason')?.trim();
  if (!reason) throw new AxiError('A --reason is required: it is written to the guard log', 'VALIDATION_ERROR', USAGE);
  if (!io.input.isTTY || !io.output.isTTY) {
    throw new AxiError(
      'guard off needs an interactive terminal: run it yourself in a terminal window, not through an agent, a pipe, or a script',
      'VALIDATION_ERROR',
      ['Open a terminal and run the same command there', 'For one agent session, type `/reactive-guard off <reason>` as your own prompt instead', ...USAGE]
    );
  }
  io.output.write(
    'This turns the reactive protocol guard off for every agent session in this workspace until you run `guard on`.\n' +
      `Workspace: ${workspace}\nThe grant is stored at ${guardOffGrantPath(workspace)}.\n`
  );
  const reader = lineReader(io);
  try {
    const expected = (options.generateCode ?? (() => generateApprovalCode()))();
    const answer = await reader.ask(`Type ${expected} to turn the guard off, anything else to cancel: `);
    const granted = answer !== null && answer.trim().toUpperCase() === expected;
    if (granted) grantGuardOff(workspace, reason, 'interactive_terminal');
    return renderOutput([renderDetail('guard', { workspace, guard: granted ? 'off' : 'unchanged', grant: guardOffGrantPath(workspace) },
      ['workspace', 'guard', 'grant'].map(key => ({ type: 'field' as const, key })))]);
  } finally {
    reader.close();
  }
}
