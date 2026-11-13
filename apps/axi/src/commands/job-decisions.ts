import { FSMEngine, JobManager, hostSessionIds, isJobTerminal, isSafeGuardSession, recordGuardPark, type JobMetadata } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderDetail, renderHelp, renderOutput } from '../toon.js';
import { extractJobFlag, findSkillByManifestName, resolveSkillId, resolveSkillPath, resolveWorkspaceDir } from '../args.js';

interface SelectedRun {
  skillName: string;
  skillPath: string;
  workspaceDir: string;
  skillId: string;
  runId: string;
  job: JobMetadata;
}

/** Pull `--name value` / `--name=value` out of args. */
function takeFlag(args: string[], name: string): { value?: string; rest: string[] } {
  const rest: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name) value = args[++i] ?? '';
    else if (args[i].startsWith(`${name}=`)) value = args[i].slice(name.length + 1);
    else rest.push(args[i]);
  }
  return { value, rest };
}

function selectRun(args: string[], usage: string): { run: SelectedRun; reason: string; session?: string } {
  const { jobId, filteredArgs } = extractJobFlag(args);
  const reasonFlag = takeFlag(filteredArgs, '--reason');
  const sessionFlag = takeFlag(reasonFlag.rest, '--session');
  const skillName = sessionFlag.rest.find(arg => !arg.startsWith('-'));
  if (!skillName) throw new AxiError('Missing skill name', 'VALIDATION_ERROR', [usage]);
  const reason = reasonFlag.value?.trim();
  if (!reason) throw new AxiError('A --reason is required: it is recorded in the run ledger', 'VALIDATION_ERROR', [usage]);
  const skillPath = resolveSkillPath(skillName) ?? findSkillByManifestName(skillName);
  if (!skillPath) throw new AxiError(`Skill '${skillName}' not found in any known location`, 'NOT_FOUND', ['Checked: ./skills/, ~/.agents/skills/, ~/.gemini/config/skills/']);
  const workspaceDir = resolveWorkspaceDir(skillPath);
  const skillId = resolveSkillId(skillPath);
  const jobs = new JobManager(workspaceDir);
  const reference = jobId || jobs.getActiveJobId(skillId);
  const runId = jobs.resolveRunId(skillId, reference) || reference;
  const job = jobs.getJob(skillId, runId);
  if (!job) throw new AxiError(`No run '${reference}' of ${skillId} in ${workspaceDir}`, 'NOT_FOUND', [`Run \`reactive-skills-axi jobs ${skillName}\` to list runs`]);
  return { run: { skillName, skillPath, workspaceDir, skillId, runId: job.runId || job.id, job }, reason, session: sessionFlag.value?.trim() || undefined };
}

function appendJobEvent(run: SelectedRun, type: string, payload: Record<string, unknown>): void {
  const engine = new FSMEngine({ skillDir: run.skillPath, workspaceDir: run.workspaceDir, jobId: run.runId, eventContext: { run_id: run.runId } });
  try {
    engine.getEventStore().append(type, payload, { state: engine.getCurrentState(), source: 'cli' });
  } finally {
    engine.close?.();
  }
}

const PARK_USAGE = 'Usage: reactive-skills-axi park <skill> --reason "<why>" [--job <run>] [--session <host-session-id>]';
const ABANDON_USAGE = 'Usage: reactive-skills-axi abandon <skill> --reason "<why>" [--job <run>]';

/**
 * Set a run aside for one host session: the run is untouched, the decision is recorded.
 * # Performance & Risk Budget
 * - Tier: P2 cold command (<100ms excluding process startup)
 * - Complexity: O(L + r), verified ledger bytes and replay on engine open
 * - Cyclomatic Complexity (CC): target <=6
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=8
 */
export async function parkCommand(args: string[]): Promise<string> {
  const { run, reason, session: flagged } = selectRun(args, PARK_USAGE);
  const session = flagged ?? hostSessionIds()[0];
  if (!session || !isSafeGuardSession(session)) {
    throw new AxiError('A host session id is needed: pass --session <id> (the guard prints it), or run this from the agent harness', 'VALIDATION_ERROR', [PARK_USAGE]);
  }
  try {
    recordGuardPark(session, run.runId, run.skillId, reason);
  } catch (err) {
    throw new AxiError((err as Error).message, 'VALIDATION_ERROR', [`Resume it instead: reactive-skills-axi state ${run.skillName} --job ${run.runId}`]);
  }
  appendJobEvent(run, 'JOB_PARKED', { reason, session });
  return renderOutput([
    renderDetail('park', { skill_id: run.skillId, run_id: run.runId, session, status: 'parked', state: run.job.currentState },
      ['skill_id', 'run_id', 'session', 'status', 'state'].map(key => ({ type: 'field' as const, key }))),
    renderHelp([`The run is unchanged. Resume it later with \`reactive-skills-axi state ${run.skillName} --job ${run.runId}\`.`]),
  ]);
}

/**
 * End a run with a recorded reason; it stops being an active job for every session.
 * # Performance & Risk Budget
 * - Tier: P2 cold command (<100ms excluding process startup)
 * - Complexity: O(L + r), verified ledger bytes and replay on engine open
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=6
 */
export async function abandonCommand(args: string[]): Promise<string> {
  const { run, reason } = selectRun(args, ABANDON_USAGE);
  if (isJobTerminal(run.job)) {
    throw new AxiError(`Run ${run.runId} of ${run.skillId} already ended (${run.job.status}, ${run.job.currentState})`, 'VALIDATION_ERROR', [`Run \`reactive-skills-axi jobs ${run.skillName}\` to list runs`]);
  }
  appendJobEvent(run, 'JOB_ABANDONED', { reason, session: hostSessionIds()[0] ?? null });
  new JobManager(run.workspaceDir).updateJob(run.skillId, run.runId, { status: 'archived', completedAt: new Date().toISOString() });
  return renderOutput([
    renderDetail('abandon', { skill_id: run.skillId, run_id: run.runId, status: 'abandoned', last_state: run.job.currentState },
      ['skill_id', 'run_id', 'status', 'last_state'].map(key => ({ type: 'field' as const, key }))),
    renderHelp([`Start a new run with \`reactive-skills-axi invoke ${run.skillName}\`.`]),
  ]);
}
