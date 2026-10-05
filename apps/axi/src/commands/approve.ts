import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import yaml from 'js-yaml';
import { FSMEngine, JobManager, grantSelfReport, revokeSelfReport, selfReportGrantPath, type PendingApproval } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderOutput, renderDetail } from '../toon.js';
import { extractJobFlag, resolveWorkspaceDir, resolveSkillPath } from '../args.js';

const USAGE = [
  'Usage: reactive-skills-axi approve <skill> [--job <alias-or-run-id>] [--full]',
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

/**
 * Control, bidirectional, invisible, line-separator, and tag characters could fake or hide text in
 * the terminal, so they print as spaces.
 */
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff\u{e0000}-\u{e007f}]/gu;

function printable(text: string): string {
  return text.replace(UNSAFE_TEXT, ' ');
}

/**
 * The person approves the whole payload, so long evidence shows its start and its end with the size
 * and a hash, and `--full` prints all of it. Cuts fall on whole characters.
 */
function describeEvidence(payload: Record<string, any>, full: boolean): string {
  const text = JSON.stringify(payload ?? {});
  const digest = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
  const chars = Array.from(text);
  const shown = full || chars.length <= 800
    ? text
    : `${chars.slice(0, 600).join('')} ... (${chars.length - 800} characters hidden; rerun with --full to see all) ... ${chars.slice(-200).join('')}`;
  return `${printable(shown)} [${Buffer.byteLength(text)} bytes, sha256 ${digest}]`;
}

const CANCELLED = 'Cancelled without a decision: input ended or five answers did not match';

const MAX_ATTEMPTS = 5;

/**
 * The code approves and `reject` rejects. A wrong answer asks again, up to five times, so a typo
 * never reroutes the run; a blank line, such as an Enter pressed while the command started, does not
 * count. Returns null when input ends or the tries run out.
 */
async function askDecision(reader: LineReader, io: ApproveIO, expected: string): Promise<'approve' | 'reject' | null> {
  let wrong = 0;
  while (wrong < MAX_ATTEMPTS) {
    const answer = await reader.ask(`Type ${expected} to approve or reject to reject: `);
    if (answer === null) return null;
    const typed = answer.trim().toUpperCase();
    if (typed === '') continue;
    if (typed === expected) return 'approve';
    if (typed === 'REJECT') return 'reject';
    wrong += 1;
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
  const full = filteredArgs.includes('--full');
  const flags = ['--allow-self-reported', '--revoke-self-reported', '--full'];
  const unknown = filteredArgs.filter((a) => a.startsWith('-') && !flags.includes(a));
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
    return renderOutput([renderDetail('approve', { skill_id: skillName, workspace: workspaceDir, grant: selfReportGrantPath(workspaceDir), self_reported: 'disabled', changed: removed }, [
      { type: 'field', key: 'skill_id' },
      { type: 'field', key: 'workspace' },
      { type: 'field', key: 'grant' },
      { type: 'field', key: 'self_reported' },
      { type: 'field', key: 'changed' },
    ])]);
  }

  if (!io.input.isTTY || !io.output.isTTY) {
    throw new AxiError(
      'approve needs an interactive terminal: run it yourself in a terminal window, not through an agent, a pipe, or a script',
      'VALIDATION_ERROR',
      [
        'Open a terminal and run the same command there',
        'In Git Bash (mintty), prefix the command with winpty, or use PowerShell or Windows Terminal',
        ...USAGE,
      ]
    );
  }

  const reader = lineReader(io);
  try {
    return allowSelfReported
      ? await grantInteractively(reader, io, skillName, workspaceDir, code)
      : await decidePending(reader, io, skillName, skillPath, workspaceDir, jobId, code, full);
  } finally {
    reader.close();
  }
}

type LineReader = ReturnType<typeof lineReader>;

async function grantInteractively(reader: LineReader, io: ApproveIO, skillName: string, workspaceDir: string, code: () => string): Promise<string> {
  io.output.write(
    "Self-reported decisions let the agent's own report decide natural-language gates when no model is configured.\n" +
      'Every such decision is flagged. This applies to the whole workspace until you revoke it.\n' +
      `Workspace: ${workspaceDir}\n` +
      `The grant is stored in your home folder at ${selfReportGrantPath(workspaceDir)}; the agent's runtime must use the same home folder.\n`
  );
  const expected = code();
  const answer = await reader.ask(`Type ${expected} to enable self-reported decisions, anything else to cancel: `);
  if (answer === null) throw new AxiError(CANCELLED, 'VALIDATION_ERROR');
  const granted = answer.trim().toUpperCase() === expected;
  if (granted) grantSelfReport(workspaceDir, 'interactive_terminal');
  return renderOutput([renderDetail('approve', { skill_id: skillName, workspace: workspaceDir, grant: selfReportGrantPath(workspaceDir), self_reported: granted ? 'enabled' : 'unchanged' }, [
    { type: 'field', key: 'skill_id' },
    { type: 'field', key: 'workspace' },
    { type: 'field', key: 'grant' },
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
  code: () => string,
  full: boolean
): Promise<string> {
  // Opening an engine on a missing run would create one, so a wrong folder fails loudly instead.
  const manifest = yaml.load(fs.readFileSync(path.join(skillPath, 'skill.yaml'), 'utf8')) as { name?: string } | undefined;
  const skillId = manifest?.name || path.basename(skillPath);
  const jobs = new JobManager(workspaceDir);
  const runRef = jobId || jobs.getActiveJobId(skillId);
  if (!jobs.getJob(skillId, runRef)) {
    throw new AxiError(`No run of ${skillId}${jobId ? ` named '${jobId}'` : ''} in ${workspaceDir}`, 'NOT_FOUND', [
      'Run approve from the folder named in the agent message',
      `Run \`reactive-skills-axi jobs ${skillName}\` there to list runs`,
    ]);
  }
  const engine = new FSMEngine({ skillDir: skillPath, workspaceDir, jobId, eventContext: { run_id: jobId } });
  try {
    const decisions: string[] = [];
    let cancelled = false;
    // Re-list after each decision: a transition can leave other requests outside the active state.
    const seen = new Set<string>();
    const next = (): PendingApproval | undefined => engine.getPendingApprovals().find((r) => !seen.has(r.id));
    for (let request = next(); request; request = next()) {
      seen.add(request.id);
      io.output.write(
        printable(`Pending gate: ${request.state} / ${request.signal} -> ${request.target}`) + '\n' +
          printable(`Criterion: ${request.criterion}`) + '\n' +
          (request.reason ? printable(`Why it needs you: ${request.reason}`) + '\n' : '') +
          `Agent evidence: ${describeEvidence(request.payload, full)}\n`
      );
      const decision = await askDecision(reader, io, code());
      if (decision === null) {
        if (decisions.length === 0) throw new AxiError(CANCELLED, 'VALIDATION_ERROR');
        cancelled = true;
        break;
      }
      let result;
      try {
        result = await engine.decideApproval(request.id, decision, 'interactive_terminal');
      } catch (err) {
        const stale = (err as { code?: string }).code === 'RUN_VERSION_CONFLICT' || /^No pending approval/.test((err as Error).message);
        if (!stale) throw err;
        throw new AxiError('The run changed while you were deciding, so this decision was not applied. Run approve again to see the current gates.', 'VALIDATION_ERROR');
      }
      const outcome = result.transitioned ? `moved to ${result.newState}` : `refused: ${result.refusalReason ?? 'no transition'}`;
      decisions.push(printable(`${request.state} / ${request.signal}: ${decision}, ${outcome}`));
    }
    return renderOutput([renderDetail('approve', { skill_id: skillName, workspace: workspaceDir, decided: decisions.length, current_state: engine.getCurrentState(), decisions, cancelled }, [
      { type: 'field', key: 'skill_id' },
      { type: 'field', key: 'workspace' },
      { type: 'field', key: 'decided' },
      { type: 'field', key: 'current_state' },
      ...(decisions.length > 0 ? [{ type: 'field' as const, key: 'decisions' }] : []),
      // Input ended at a later gate after earlier decisions were applied.
      ...(cancelled ? [{ type: 'field' as const, key: 'cancelled' }] : []),
    ])]);
  } finally {
    engine.close();
  }
}
