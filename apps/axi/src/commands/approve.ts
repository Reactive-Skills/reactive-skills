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

/**
 * One line reader per command that queues lines, so a line typed before its prompt is not lost.
 * `ask` resolves null when input ends, for example on Ctrl+D, so the command cancels instead of hanging.
 */
function lineReader(io: ApproveIO) {
  const rl = readline.createInterface({ input: io.input, terminal: false });
  const lines: string[] = [];
  const waiting: Array<(answer: string | null) => void> = [];
  let closed = false;
  rl.on('line', (line) => {
    const next = waiting.shift();
    if (next) next(line);
    else lines.push(line);
  });
  rl.on('close', () => {
    closed = true;
    for (const resolve of waiting.splice(0)) resolve(null);
  });
  return {
    ask: (question: string) => {
      io.output.write(question);
      return new Promise<string | null>((resolve) => {
        if (lines.length > 0) resolve(lines.shift()!);
        else if (closed) resolve(null);
        else waiting.push(resolve);
      });
    },
    close: () => rl.close(),
  };
}

/** Control and bidirectional formatting characters could fake or hide lines in the terminal. */
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

function printable(text: string): string {
  return text.replace(UNSAFE_TEXT, ' ');
}

/** The person approves the whole payload, so show its size and a hash even when the text is cut. */
function describeEvidence(payload: Record<string, any>): string {
  const text = JSON.stringify(payload ?? {});
  const digest = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
  const shown = text.length > 600 ? `${text.slice(0, 600)}... (truncated)` : text;
  return `${printable(shown)} [${Buffer.byteLength(text)} bytes, sha256 ${digest}]`;
}

const CANCELLED = 'Cancelled without a decision: input ended or five answers did not match';

const MAX_ATTEMPTS = 5;

/**
 * The code approves and `reject` rejects. Anything else asks again, up to five tries, so a typo or
 * a stray Enter never reroutes the run. Returns null when input ends or the tries run out.
 */
async function askDecision(reader: LineReader, io: ApproveIO, expected: string): Promise<'approve' | 'reject' | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const answer = await reader.ask(`Type ${expected} to approve or reject to reject: `);
    if (answer === null) return null;
    const typed = answer.trim().toUpperCase();
    if (typed === expected) return 'approve';
    if (typed === 'REJECT') return 'reject';
    io.output.write('That did not match. ');
  }
  return null;
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
  if (answer === null) throw new AxiError(CANCELLED, 'VALIDATION_ERROR');
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
    const decisions: Array<Record<string, unknown>> = [];
    // Re-list after each decision: a transition can leave other requests outside the active state.
    const seen = new Set<string>();
    const next = (): PendingApproval | undefined => engine.getPendingApprovals().find((r) => !seen.has(r.id));
    for (let request = next(); request; request = next()) {
      seen.add(request.id);
      io.output.write(
        printable(`Pending gate: ${request.state} / ${request.signal} -> ${request.target}`) + '\n' +
          printable(`Criterion: ${request.criterion}`) + '\n' +
          (request.reason ? printable(`Why it needs you: ${request.reason}`) + '\n' : '') +
          `Agent evidence: ${describeEvidence(request.payload)}\n`
      );
      const decision = await askDecision(reader, io, code());
      if (decision === null) {
        if (decisions.length === 0) throw new AxiError(CANCELLED, 'VALIDATION_ERROR');
        break;
      }
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
