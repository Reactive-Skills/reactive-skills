import fs from 'node:fs';
import path from 'node:path';
import { LegacySkillAdapter } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput } from '../toon.js';
import { getSuggestions } from '../suggestions.js';

const SKILLS_DIR = path.resolve(process.cwd(), 'skills');

export async function upgradeCommand(args: string[]): Promise<string> {
  if (!args[0]) {
    const error = new AxiError(
      'Missing target skill path',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi upgrade <path-to-legacy-skill>', 'Example: reactive-skills-axi upgrade skills/my-legacy-skill']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const targetPath = path.resolve(process.cwd(), args[0]);
  const skillMdPath = path.join(targetPath, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) {
    const error = new AxiError(
      'Legacy SKILL.md not found at ' + skillMdPath,
      'NOT_FOUND',
      ['Check the path and ensure it contains a SKILL.md file', 'Usage: reactive-skills-axi upgrade <path>']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  try {
    const skillName = path.basename(targetPath);
    LegacySkillAdapter.upgradeToModular(targetPath);

    const suggestions = getSuggestions({ domain: 'upgrade', action: 'convert', skillName });
    const okLine = 'ok: upgraded skill at ' + targetPath;

    return renderOutput([
      okLine,
      renderHelp(suggestions),
    ]);
  } catch (err) {
    const error = err instanceof AxiError
      ? err
      : new AxiError(
          err instanceof Error ? err.message : 'Upgrade failed',
          'INVALID_SKILL',
          ['Ensure the SKILL.md has valid frontmatter', 'Check the skill.yaml format after upgrade']
        );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }
}

