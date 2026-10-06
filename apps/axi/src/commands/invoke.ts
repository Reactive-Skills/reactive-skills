import fs from 'node:fs';
import { FSMEngine, JobManager, createSortableId } from '@reactive-skills/runtime';
import { AxiError, storeOpenError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { extractJobFlag, resolveSkillPath, resolveWorkspaceDir } from '../args.js';

const PAYLOAD_USAGE = 'Usage: --payload \'{"key":"value"}\' or --payload @filepath.json';

function rejectWrappedPayload(payload: unknown): AxiError | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  if (!Object.prototype.hasOwnProperty.call(payload, 'contextUpdates')) return null;

  const inner = (payload as Record<string, unknown>).contextUpdates;
  const corrected = typeof inner === 'object' && inner !== null && !Array.isArray(inner)
    ? JSON.stringify(inner)
    : '{"key":"value"}';
  return new AxiError(
    'invoke --payload takes a flat object that becomes the initial context, not a {"contextUpdates":{...}} wrapper',
    'VALIDATION_ERROR',
    [
      `Pass the context values at the top level: --payload '${corrected}'`,
      'The contextUpdates wrapper is the emit payload shape; invoke stores the payload object as context as-is.',
    ]
  );
}

function parsePayload(args: string[]): Record<string, any> | AxiError {
  let initialContext: Record<string, any> = {};
  const payloadIdx = args.indexOf('--payload');
  if (payloadIdx === -1) return initialContext;

  const payloadStr = args.slice(payloadIdx + 1).join(' ').trim();
  if (!payloadStr) return initialContext;

  if (payloadStr.startsWith('@') || fs.existsSync(payloadStr)) {
    const filePath = payloadStr.startsWith('@') ? payloadStr.slice(1) : payloadStr;
    try {
      initialContext = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return new AxiError(
        'Invalid JSON payload file: ' + filePath,
        'VALIDATION_ERROR',
        [PAYLOAD_USAGE]
      );
    }
    return rejectWrappedPayload(initialContext) ?? initialContext;
  }

  try {
    initialContext = JSON.parse(payloadStr);
  } catch {
    return new AxiError('Invalid JSON payload', 'VALIDATION_ERROR', [PAYLOAD_USAGE]);
  }
  return rejectWrappedPayload(initialContext) ?? initialContext;
}

export async function invokeCommand(args: string[]): Promise<string> {
  const { jobId, parentJobId, filteredArgs } = extractJobFlag(args);
  const skillName = filteredArgs[0];

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi invoke <skill-name> [--job <job-id>] [--parent <job-id>] [--payload JSON]', 'Example: reactive-skills-axi invoke resume-customizer --job worksoft --parent baseline --payload \'{"company_name":"Worksoft"}\'']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const parsedPayload = parsePayload(filteredArgs);
  if (parsedPayload instanceof AxiError) {
    return renderOutput([renderError(parsedPayload.message, parsedPayload.code, parsedPayload.suggestions)]);
  }

  try {
    const skillPath = resolveSkillPath(skillName);
    if (!skillPath) {
      const error = new AxiError(
        `Skill '${skillName}' not found in any known location`,
        'NOT_FOUND',
        ['Checked: ./skills/, ~/.agents/skills/, ~/.gemini/config/skills/']
      );
      return renderOutput([renderError(error.message, error.code, error.suggestions)]);
    }

    const workspaceDir = resolveWorkspaceDir(skillPath);
    const jobManager = new JobManager(workspaceDir);
    const parentRunId: string | undefined = parentJobId
      ? (jobManager.resolveRunId(skillName, parentJobId) || undefined)
      : undefined;
    if (parentJobId && !parentRunId) {
      const error = new AxiError(
        `Parent job '${parentJobId}' not found for skill '${skillName}'`,
        'VALIDATION_ERROR',
        [`Run \`reactive-skills-axi jobs ${skillName}\` to list available jobs.`]
      );
      return renderOutput([renderError(error.message, error.code, error.suggestions)]);
    }
    const existingRunId = jobId ? jobManager.resolveRunId(skillName, jobId) : null;
    if (existingRunId && parentRunId) {
      const existingJob = jobManager.getJob(skillName, existingRunId);
      if (existingJob?.parentRunId !== parentRunId) {
        const error = new AxiError(
          `Existing job '${jobId}' already has a different parent`,
          'VALIDATION_ERROR',
          ['Start a new child job when changing the parent run.']
        );
        return renderOutput([renderError(error.message, error.code, error.suggestions)]);
      }
    }
    const runId = existingRunId || createSortableId();

    const engine = new FSMEngine({
      skillDir: skillPath,
      workspaceDir,
      jobId: runId,
      jobName: jobId || runId,
      setActive: !jobId,
      parentRunId,
      initialContext: parsedPayload,
      eventContext: { run_id: runId, parent_run_id: parentRunId },
    });

    try {
      const currentState = engine.getCurrentState();
      const promptSlice = engine.generatePromptSlice();
      const events = engine.getEventStore().getAll();
      const latestEvent = events.length > 0 ? events[events.length - 1] : undefined;

      const lines: string[] = [];
      lines.push(renderDetail('invoke', {
        skill_id: skillName,
        current_state: currentState,
        run_id: runId,
        event_id: latestEvent?.id || 'none',
      }, [
        { type: 'field', key: 'skill_id' },
        { type: 'field', key: 'current_state' },
        { type: 'field', key: 'run_id' },
        { type: 'field', key: 'event_id' },
      ]));

      lines.push(renderDetail('prompt', {
        raw_prompt: promptSlice.rawPrompt,
        allowed_tools: promptSlice.allowedTools.join(',') || 'none',
        exit_conditions: promptSlice.exitConditions.length,
      }, [
        { type: 'field', key: 'raw_prompt' },
        { type: 'field', key: 'allowed_tools' },
        { type: 'field', key: 'exit_conditions' },
      ]));

      const suggestions = getSuggestions({
        domain: 'invoke',
        action: 'call',
        skillName,
        jobId: runId,
        currentState,
      });
      lines.push(renderHelp(suggestions));

      return renderOutput(lines);
    } finally {
      engine.close?.();
    }
  } catch (err) {
    const error = err instanceof AxiError
      ? err
      : storeOpenError(err) ?? new AxiError(
          err instanceof Error ? err.message : 'Failed to invoke skill',
          'NOT_FOUND',
          ['Check the skill name and ensure it exists in skills/ or global registry', 'Usage: reactive-skills-axi invoke <skill-name-or-path>']
        );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }
}
