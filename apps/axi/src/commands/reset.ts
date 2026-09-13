import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
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

function deleteRecursive(dirPath: string): { deleted: string[]; errors: string[] } {
  const deleted: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(dirPath)) {
    return { deleted, errors };
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    try {
      if (entry.isDirectory()) {
        const nested = deleteRecursive(fullPath);
        deleted.push(...nested.deleted);
        errors.push(...nested.errors);
      } else {
        fs.unlinkSync(fullPath);
        deleted.push(fullPath);
      }
    } catch (err) {
      errors.push(`${fullPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  try {
    fs.rmdirSync(dirPath);
    deleted.push(dirPath);
  } catch (err) {
    errors.push(`${dirPath}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { deleted, errors };
}

export async function resetCommand(args: string[]): Promise<string> {
  const skillName = args[0];

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi reset <skill-name>', 'Example: reactive-skills-axi reset my-skill']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const skillPath = resolveSkillPath(skillName);
  if (!skillPath) {
    const error = new AxiError(
      `Skill '${skillName}' not found in any known location`,
      'NOT_FOUND',
      ['Checked: ./skills/, ~/.agents/skills/, ~/.gemini/config/skills/']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const workspaceDir = path.dirname(skillPath);
  const reactiveDir = path.join(workspaceDir, '.reactive', 'skills', skillName);

  if (!fs.existsSync(reactiveDir)) {
    const suggestions = getSuggestions({ domain: 'reset', action: 'call', skillName });
    return renderOutput([
      renderDetail('reset', {
        skill_id: skillName,
        status: 'no_state_to_clear',
        reactive_dir: reactiveDir,
      }, [
        { type: 'field', key: 'skill_id' },
        { type: 'field', key: 'status' },
        { type: 'field', key: 'reactive_dir' },
      ]),
      renderHelp([
        `No prior state found at ${reactiveDir}.`,
        'Nothing to reset.',
        ...suggestions,
      ]),
    ]);
  }

  const { deleted, errors } = deleteRecursive(reactiveDir);

  const adrDir = path.join(workspaceDir, 'adr');
  const adrExists = fs.existsSync(adrDir);
  const docsDir = path.join(workspaceDir, '.docs', skillName);
  const docsExist = fs.existsSync(docsDir);

  const lines: string[] = [];
  lines.push(renderDetail('reset', {
    skill_id: skillName,
    status: errors.length === 0 ? 'success' : 'partial',
    reactive_dir: reactiveDir,
    files_cleared: deleted.length,
    errors: errors.length,
  }, [
    { type: 'field', key: 'skill_id' },
    { type: 'field', key: 'status' },
    { type: 'field', key: 'reactive_dir' },
    { type: 'field', key: 'files_cleared' },
    { type: 'field', key: 'errors' },
  ]));

  const helpLines: string[] = [];
  if (adrExists) {
    helpLines.push('ADRs in adr/ were preserved.');
  }
  if (docsExist) {
    helpLines.push(`Deliverable docs in .docs/${skillName}/ were preserved and will be regenerated on next invoke.`);
  }
  helpLines.push(`Event store and snapshots at ${reactiveDir} have been cleared.`);
  helpLines.push(`Run \`reactive-skills-axi invoke ${skillName}\` to start a fresh run.`);
  lines.push(renderHelp(helpLines));

  if (errors.length > 0) {
    lines.unshift(renderError(
      `Partial reset: ${errors.length} file(s) could not be deleted`,
      'RUNTIME_ERROR',
      errors
    ));
  }

  return renderOutput(lines);
}
