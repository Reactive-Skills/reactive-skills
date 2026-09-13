import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { EventStore } from '@reactive-skills/runtime';

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

export async function rebuildSqliteCommand(args: string[]): Promise<string> {
  const skillName = args[0];

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi rebuild-sqlite <skill-name>', 'Example: reactive-skills-axi rebuild-sqlite my-skill']
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
      renderDetail('rebuild-sqlite', {
        skill_id: skillName,
        status: 'no_state_to_rebuild',
        reactive_dir: reactiveDir,
      }, [
        { type: 'field', key: 'skill_id' },
        { type: 'field', key: 'status' },
        { type: 'field', key: 'reactive_dir' },
      ]),
      renderHelp([
        `No reactive state found at ${reactiveDir}.`,
        'Nothing to rebuild.',
        ...suggestions,
      ]),
    ]);
  }

  const eventStore = new EventStore({
    workspaceDir,
    skillId: skillName,
    enableSqlite: true,
  });

  try {
    const eventCount = eventStore.rebuildFromJsonl();
    const lines: string[] = [];
    lines.push(renderDetail('rebuild-sqlite', {
      skill_id: skillName,
      status: 'success',
      reactive_dir: reactiveDir,
      events_restored: eventCount,
    }, [
      { type: 'field', key: 'skill_id' },
      { type: 'field', key: 'status' },
      { type: 'field', key: 'reactive_dir' },
      { type: 'field', key: 'events_restored' },
    ]));

    const helpLines: string[] = [];
    helpLines.push(`SQLite rebuilt from JSONL audit log at ${reactiveDir}/events.db.`);
    helpLines.push(`Restored ${eventCount} event(s).`);
    helpLines.push('Run `reactive-skills-axi events 20 ' + skillName + '` to verify.');
    lines.push(renderHelp(helpLines));

    return renderOutput(lines);
  } catch (err) {
    const error = new AxiError(
      `Failed to rebuild SQLite for skill '${skillName}': ${err instanceof Error ? err.message : String(err)}`,
      'RUNTIME_ERROR',
      ['Check that the JSONL audit log exists at ' + reactiveDir, 'Ensure the skill directory is writable']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  } finally {
    eventStore.close();
  }
}