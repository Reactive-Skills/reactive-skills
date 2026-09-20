import fs from 'node:fs';
import { FSMEngine, JobManager, createSortableId } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { extractJobFlag, resolveSkillPath, resolveWorkspaceDir } from '../args.js';

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
      return initialContext;
    } catch {
      return new AxiError(
        'Invalid JSON payload file: ' + filePath,
        'VALIDATION_ERROR',
        ['Usage: --payload \'{"key":"value"}\' or --payload @filepath.json']
      );
    }
  }

  try {
    initialContext = JSON.parse(payloadStr);
    return initialContext;
  } catch {
    return new AxiError(
      'Invalid JSON payload',
      'VALIDATION_ERROR',
      ['Usage: --payload \'{"key":"value"}\' or --payload @filepath.json']
    );
  }
}

export async function invokeCommand(args: string[]): Promise<string> {
  const { jobId, filteredArgs } = extractJobFlag(args);
  const skillName = filteredArgs[0];

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi invoke <skill-name> [--job <job-id>] [--payload JSON]', 'Example: reactive-skills-axi invoke resume-customizer --job worksoft --payload \'{"company_name":"Worksoft"}\'']
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
    const runId = jobId || createSortableId();
    const jobManager = new JobManager(workspaceDir);
    jobManager.createJob(skillName, {
      id: runId,
      name: runId,
      setActive: true,
    });

    const engine = new FSMEngine({
      skillDir: skillPath,
      workspaceDir,
      jobId: runId,
      initialContext: parsedPayload,
      eventContext: { run_id: runId },
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
      : new AxiError(
          err instanceof Error ? err.message : 'Failed to invoke skill',
          'NOT_FOUND',
          ['Check the skill name and ensure it exists in skills/ or global registry', 'Usage: reactive-skills-axi invoke <skill-name-or-path>']
        );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }
}
