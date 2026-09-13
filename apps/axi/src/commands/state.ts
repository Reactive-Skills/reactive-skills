import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { FSMEngine, createSortableId } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';

const HOME_DIR = os.homedir();

function resolveSkillPath(skillName: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'skills', skillName),
    path.resolve(HOME_DIR, '.agents', 'skills', skillName),
    path.resolve(HOME_DIR, '.gemini', 'config', 'skills', skillName),
  ];
  for (const candidate of candidates) {
    const yamlPath = path.join(candidate, 'skill.yaml');
    if (fs.existsSync(yamlPath)) {
      return candidate;
    }
  }
  return null;
}

export async function stateCommand(args: string[]): Promise<string> {
  let skillName = args[0];

  // If no skillName provided, check if current directory is a skill
  if (!skillName && fs.existsSync(path.join(process.cwd(), 'skill.yaml'))) {
    skillName = path.basename(process.cwd());
  }

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi state <skill-name>', 'Example: reactive-skills-axi state my-skill']
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

    // Load existing run_id or create new
    let runId: string | undefined;
    const runIdPath = path.join(skillPath, '.reactive', 'run-id.txt');
    if (fs.existsSync(runIdPath)) {
      runId = fs.readFileSync(runIdPath, 'utf8').trim();
    } else {
      runId = createSortableId();
      fs.mkdirSync(path.dirname(runIdPath), { recursive: true });
      fs.writeFileSync(runIdPath, runId, 'utf8');
    }

    const engine = new FSMEngine({
      skillDir: skillPath,
      workspaceDir: path.dirname(skillPath),
    });

    const currentState = engine.getCurrentState();
    const promptSlice = engine.generatePromptSlice();
    const events = engine.getEventStore().getAll();
    const latestEvent = events.length > 0 ? events[events.length - 1] : undefined;

    const lines: string[] = [];
    lines.push(renderDetail('state', {
      skill_id: skillName,
      current_state: currentState,
      event_id: latestEvent?.id || 'none',
      run_id: runId,
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

    const suggestions = getSuggestions({ domain: 'state', action: 'get', skillName });
    lines.push(renderHelp(suggestions));

    return renderOutput(lines);
  } catch (err) {
    const error = err instanceof AxiError
      ? err
      : new AxiError(
          err instanceof Error ? err.message : 'Failed to retrieve skill state',
          'RUNTIME_ERROR',
          ['Check the skill name and ensure it exists in skills/ or global registry', 'Usage: reactive-skills-axi state <skill-name>']
        );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }
}
