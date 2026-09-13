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

export async function invokeCommand(args: string[]): Promise<string> {
  const skillName = args[0];

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi invoke <skill-name> [--payload JSON]', 'Example: reactive-skills-axi invoke resume-customizer --payload \'{"company_name":"Worksoft"}\'']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  let initialContext: Record<string, any> = {};
  const payloadIdx = args.indexOf('--payload');
  if (payloadIdx !== -1) {
    const payloadStr = args.slice(payloadIdx + 1).join(' ').trim();
    if (payloadStr) {
      if (payloadStr.startsWith('@') || fs.existsSync(path.resolve(payloadStr))) {
        const filePath = payloadStr.startsWith('@') ? path.resolve(payloadStr.slice(1)) : path.resolve(payloadStr);
        try {
          initialContext = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch {
          const error = new AxiError(
            'Invalid JSON payload file: ' + filePath,
            'VALIDATION_ERROR',
            ['Usage: --payload \'{"key":"value"}\' or --payload @filepath.json']
          );
          return renderOutput([renderError(error.message, error.code, error.suggestions)]);
        }
      } else {
        try {
          initialContext = JSON.parse(payloadStr);
        } catch {
          const error = new AxiError(
            'Invalid JSON payload',
            'VALIDATION_ERROR',
            ['Usage: --payload \'{"key":"value"}\' or --payload @filepath.json']
          );
          return renderOutput([renderError(error.message, error.code, error.suggestions)]);
        }
      }
    }
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
    const runId = createSortableId();
    const parentEngine = new FSMEngine({
      skillDir: skillPath,
      workspaceDir: path.dirname(skillPath),
      runId,
      initialContext,
    });
    const result = await parentEngine.invokeSkill(skillName);

    // Persist run_id for subsequent emit calls
    const runIdPath = path.join(skillPath, '.reactive', 'run-id.txt');
    fs.mkdirSync(path.dirname(runIdPath), { recursive: true });
    if (runId) {
      fs.writeFileSync(runIdPath, runId, 'utf8');
    }

    const lines: string[] = [];
    lines.push(renderDetail('invoke', {
      skill_id: result.skillId,
      current_state: result.currentState,
      event_id: result.event.id,
    }, [
      { type: 'field', key: 'skill_id' },
      { type: 'field', key: 'current_state' },
      { type: 'field', key: 'event_id' },
    ]));

    lines.push(renderDetail('prompt', {
      raw_prompt: result.promptSlice.rawPrompt,
      allowed_tools: result.promptSlice.allowedTools.join(',') || 'none',
      exit_conditions: result.promptSlice.exitConditions.length,
    }, [
      { type: 'field', key: 'raw_prompt' },
      { type: 'field', key: 'allowed_tools' },
      { type: 'field', key: 'exit_conditions' },
    ]));

    const suggestions = getSuggestions({ domain: 'invoke', action: 'call', skillName: result.skillId });
    lines.push(renderHelp(suggestions));

    return renderOutput(lines);
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

