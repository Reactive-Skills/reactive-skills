import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderList, renderOutput } from '../toon.js';
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

interface EventEntry {
  seq: number;
  timestamp: string;
  type: string;
  state: string;
}

function readEventsJsonl(skillPath: string, limit: number, runId?: string | null): EventEntry[] {
  const workspaceDir = path.dirname(skillPath);
  const skillName = path.basename(skillPath);
  const skillStoreDir = path.join(workspaceDir, '.reactive', 'skills', skillName);

  let eventsPath: string;
  if (runId) {
    eventsPath = path.join(skillStoreDir, runId, 'events.jsonl');
  } else {
    let latestRunDir: string | null = null;
    if (fs.existsSync(skillStoreDir)) {
      const runDirs = fs.readdirSync(skillStoreDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort();
      if (runDirs.length > 0) {
        latestRunDir = path.join(skillStoreDir, runDirs[runDirs.length - 1]);
      }
    }
    if (latestRunDir) {
      eventsPath = path.join(latestRunDir, 'events.jsonl');
    } else {
      eventsPath = path.join(skillStoreDir, 'events.jsonl');
    }
  }

  if (!fs.existsSync(eventsPath)) {
    return [];
  }

  const content = fs.readFileSync(eventsPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  const events: EventEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      events.push({
        seq: parsed.seq || 0,
        timestamp: parsed.timestamp || '',
        type: parsed.type || '',
        state: parsed.state || '',
      });
    } catch {
      // skip malformed lines
    }
  }

  return events.slice(-limit);
}

export async function eventsCommand(args: string[]): Promise<string> {
  const limit = parseInt(args[0], 10) || 20;
  let targetSkill = args[1];
  let runId: string | null = null;

  if (!targetSkill || isNaN(parseInt(args[0], 10))) {
    targetSkill = args[0];
  }

  const runIdIdx = args.indexOf('--run-id');
  if (runIdIdx !== -1) runId = args[runIdIdx + 1];

  if (!targetSkill) {
    const reactiveSkillsDir = path.resolve(process.cwd(), '.reactive', 'skills');
    if (fs.existsSync(reactiveSkillsDir)) {
      const dirs = fs.readdirSync(reactiveSkillsDir, { withFileTypes: true });
      const found = dirs.find((d) => d.isDirectory() && fs.existsSync(path.join(reactiveSkillsDir, d.name, 'events.jsonl')));
      if (found) {
        targetSkill = found.name;
      }
    }
  }

  if (!targetSkill) {
    const error = new AxiError(
      'No skill specified and no active skill runs found',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi events [limit] <skill-name>']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const targetPath = resolveSkillPath(targetSkill);

  if (!targetPath || !fs.existsSync(targetPath)) {
    const error = new AxiError(
      `Skill '${targetSkill}' not found in any known location`,
      'NOT_FOUND',
      ['Checked: ./skills/, ~/.agents/skills/, ~/.gemini/config/skills/', 'Usage: reactive-skills-axi events [limit] [skill-name]']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const events = readEventsJsonl(targetPath, limit, runId);

  const lines: string[] = [];

  if (events.length === 0) {
    const eventsPath = '.reactive/skills/' + targetSkill + '/events.jsonl';
    const error = new AxiError(
      'No events found for skill: ' + targetSkill,
      'NO_EVENT_STORE',
      ['No events.jsonl found at ' + eventsPath, 'Run a reactive skill to generate events']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  lines.push('count: ' + events.length + ' events shown');

  lines.push(renderList('events', events, [
    { type: 'field', key: 'seq' },
    { type: 'field', key: 'timestamp' },
    { type: 'field', key: 'type' },
    { type: 'field', key: 'state' },
  ]));

  const suggestions = getSuggestions({ domain: 'events', action: 'tail' });
  lines.push(renderHelp(suggestions));

  return lines.join('\n');
}
