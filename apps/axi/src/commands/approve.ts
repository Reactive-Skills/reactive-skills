import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import yaml from 'js-yaml';
import { FSMEngine, JobManager, grantSelfReport, revokeSelfReport, type PendingApproval } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderOutput, renderDetail } from '../toon.js';
import { extractJobFlag, resolveWorkspaceDir, resolveSkillPath } from '../args.js';

const USAGE = [
  'Usage: reactive-skills-axi approve <skill> [--job <alias-or-run-id>]',
  'Usage: reactive-skills-axi approve <skill> --allow-self-reported',
  'Usage: reactive-skills-axi approve <skill> --revoke-self-reported',
];

/** Letters and digits that are hard to misread, so the user types the code back reliably. */
const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

export function generateApprovalCode(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

export interface ApproveIO {
  input: NodeJS.ReadableStream & { isTTY?: boolean };
  output: NodeJS.WritableStream & { isTTY?: boolean };
}

export interface ApproveOptions {
  /** Test seam for the one-time code. */
  generateCode?: () => string;
}

/** One line reader per command, so lines typed ahead are not lost between prompts. */
function lineReader(io: ApproveIO) {
  const rl = readline.createInterface({ input: io.input, output: io.output, terminal: false });
  return {
    ask: (question: string) => new Promise<string>((resolve) => rl.question(question, resolve)),
    close: () => rl.close(),
  };
}

function summarize(payload: Record<string, any>): string {
  const text = JSON.stringify(payload ?? {});
  return text.length > 600 ? `${text.slice(0, 600)}...` : text;
}

/**
 * Lets a person decide gates that no adapter could judge, and grant or revoke self-reported
 * decisions (ADR 0012). It runs only in an interactive terminal and asks for a one-time code, so an
 * agent working through its own shell or MCP tools cannot approve on the user's behalf. Errors are
 * thrown so the CLI writes them to stderr and exits non-zero.
 */
export async function approveCommand(
  args: string[],
  io: ApproveIO = { input: process.stdin, output: process.stdout },
  options: ApproveOptions = {}
): Promise<string> {
  const { jobId, filteredArgs } = extractJobFlag(args);
  if (filteredArgs.includes('--help') || filteredArgs.includes('-h')) {
    return renderOutput([USAGE.join('\n')]);
  }
  const allowSelfReported = filteredArgs.includes('--allow-self-reported');
  const revokeSelfReported = filteredArgs.includes('--revoke-self-reported');
  const unknown = filteredArgs.filter((a) => a.startsWith('-') && a !== '--allow-self-reported' && a !== '--revoke-self-reported');
  const skillName = filteredArgs.find((a) => !a.startsWith('-'));
  const code = options.generateCode ?? (() => generateApprovalCode());

  if (!skillName || unknown.length > 0 || (allowSelfReported && revokeSelfReported)) {
    throw new AxiError(unknown.length > 0 ? `Unknown option: ${unknown[0]}` : 'Missing skill name', 'VALIDATION_ERROR', USAGE);
  }
  const skillPath = resolveSkillPath(skillName);
  if (!skillPath) {
    throw new AxiError(`Skill '${skillName}' not found in any known location`, 'NOT_FOUND', ['Checked: ./skills/, ~/.agents/skills/, ~/.gemini/config/skills/']);
  }
  const workspaceDir = resolveWorkspaceDir(skillPath);

  if (revokeSelfReported) {
    const removed = revokeSelfReport(workspaceDir);
    return renderOutput([renderDetail('approve', { skill_id: skillName, workspace: workspaceDir, self_reported: 'disabled', changed: removed }, [
      { type: 'field', key: 'skill_id' },
      { type: 'field', key: 'workspace' },
      { type: 'field', key: 'self_reported' },
      { type: 'field', key: 'changed' },
    ])]);
  }

  if (!io.input.isTTY || !io.output.isTTY) {
    throw new AxiError(
      'approve needs an interactive terminal: run it yourself in a terminal window, not through an agent, a pipe, or a script',
      'VALIDATION_ERROR',
      ['Open a terminal and run the same command there', ...USAGE]
    );
  }

  const reader = lineReader(io);
  try {
    return allowSelfReported
      ? await grantInteractively(reader, io, skillName, workspaceDir, code)
      : await decidePending(reader, io, skillName, skillPath, workspaceDir, jobId, code);
  } finally {
    reader.close();
  }
}

type LineReader = ReturnType<typeof lineReader>;

async function grantInteractively(reader: LineReader, io: ApproveIO, skillName: string, workspaceDir: string, code: () => string): Promise<string> {
  io.output.write(
    "Self-reported decisions let the agent's own report decide natural-language gates when no model is configured.\n" +
      'Every such decision is flagged. This applies to the whole workspace until you revoke it.\n' +
      `Workspace: ${workspaceDir}\n`
  );
  const expected = code();
  const answer = await reader.ask(`Type ${expected} to enable self-reported decisions, anything else to cancel: `);
  const granted = answer.trim().toUpperCase() === expected;
  if (granted) grantSelfReport(workspaceDir, 'interactive_terminal');
  return renderOutput([renderDetail('approve', { skill_id: skillName, workspace: workspaceDir, self_reported: granted ? 'enabled' : 'unchanged' }, [
    { type: 'field', key: 'skill_id' },
    { type: 'field', key: 'workspace' },
    { type: 'field', key: 'self_reported' },
  ])]);
}

async function decidePending(
  reader: LineReader,
  io: ApproveIO,
  skillName: string,
  skillPath: string,
  workspaceDir: string,
  jobId: string | undefined,
  code: () => string
): Promise<string> {
  // Opening an engine on a missing run would create one, so a wrong folder fails loudly instead.
  const manifest = yaml.load(fs.readFileSync(path.join(skillPath, 'skill.yaml'), 'utf8')) as { name?: string } | undefined;
  const skillId = manifest?.name || path.basename(skillPath);
  const jobs = new JobManager(workspaceDir);
  const runRef = jobId || jobs.getActiveJobId(skillId);
  if (!jobs.getJob(skillId, runRef)) {
    throw new AxiError(`No run '${runRef}' of ${skillId} in ${workspaceDir}`, 'NOT_FOUND', [
      'Run approve from the folder named in the agent message',
      `Run \`reactive-skills-axi jobs ${skillName}\` there to list runs`,
    ]);
  }
  const engine = new FSMEngine({ skillDir: skillPath, workspaceDir, jobId, eventContext: { run_id: jobId } });
  try {
    const pending: PendingApproval[] = engine.getPendingApprovals();
    const decisions: Array<Record<string, unknown>> = [];
    for (const request of pending) {
      io.output.write(
        `\nPending gate: ${request.state} / ${request.signal} -> ${request.target}\n` +
          `Criterion: ${request.criterion}\n` +
          (request.reason ? `Why it needs you: ${request.reason}\n` : '') +
          `Agent evidence: ${summarize(request.payload)}\n`
      );
      const expected = code();
      const answer = await reader.ask(`Type ${expected} to approve, anything else to reject: `);
      const decision = answer.trim().toUpperCase() === expected ? 'approve' : 'reject';
      const result = await engine.decideApproval(request.id, decision, 'interactive_terminal');
      decisions.push({ signal: request.signal, decision, transitioned: result.transitioned, current_state: result.newState });
    }
    return renderOutput([renderDetail('approve', { skill_id: skillName, workspace: workspaceDir, decided: decisions.length, current_state: engine.getCurrentState(), decisions }, [
      { type: 'field', key: 'skill_id' },
      { type: 'field', key: 'workspace' },
      { type: 'field', key: 'decided' },
      { type: 'field', key: 'current_state' },
      ...(decisions.length > 0 ? [{ type: 'field' as const, key: 'decisions' }] : []),
    ])]);
  } finally {
    engine.close();
  }
}
