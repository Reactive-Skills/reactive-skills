import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { FSMEngine } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { extractJobFlag, resolveWorkspaceDir, resolveSkillPath } from '../args.js';


export async function stateCommand(args: string[]): Promise<string> {
  const { jobId, filteredArgs } = extractJobFlag(args);
  let skillName = filteredArgs[0];

  // If no skillName provided, check if current directory is a skill
  if (!skillName && fs.existsSync(path.join(process.cwd(), 'skill.yaml'))) {
    skillName = path.basename(process.cwd());
  }

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi state <skill-name> [--job <job-id>]', 'Example: reactive-skills-axi state my-skill']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
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
    const engine = new FSMEngine({
      skillDir: skillPath,
      workspaceDir,
      jobId,
      autoRotateTerminal: true,
    });

    try {
      const currentState = engine.getCurrentState();
      const promptSlice = engine.generatePromptSlice();
      const events = engine.getEventStore().getAll();
      const latestEvent = events.length > 0 ? events[events.length - 1] : undefined;
      const effectiveJobId = (typeof engine.getJobId === 'function' ? engine.getJobId() : jobId) || 'default';
      const effectiveAlias = (typeof engine.getJobName === 'function' ? engine.getJobName() : undefined) || effectiveJobId;

      const lines: string[] = [];
      lines.push(renderDetail('state', {
        skill_id: skillName,
        current_state: currentState,
        event_id: latestEvent?.id || 'none',
        run_id: effectiveJobId,
      }, [
        { type: 'field', key: 'skill_id' },
        { type: 'field', key: 'current_state' },
        { type: 'field', key: 'event_id' },
        { type: 'field', key: 'run_id' },
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
        domain: 'state',
        action: 'get',
        skillName,
        jobId: effectiveAlias,
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
          err instanceof Error ? err.message : 'Failed to retrieve skill state',
          'RUNTIME_ERROR',
          ['Check the skill name and ensure it exists in skills/ or global registry', 'Usage: reactive-skills-axi state <skill-name> [--job <job-id>]']
        );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }
}
