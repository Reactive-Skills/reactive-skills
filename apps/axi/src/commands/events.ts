import fs from 'node:fs';
import path from 'node:path';
import { JobManager } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderList, renderOutput } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { resolveSkillPath, resolveWorkspaceDir } from '../args.js';

interface EventEntry {
  seq: number;
  timestamp: string;
  type: string;
  state: string;
}

function parseEventsArgs(args: string[]): { limit: number; skillName?: string; jobId?: string } {
  const filtered: string[] = [];
  let jobId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--job' || arg === '-j' || arg === '--run' || arg === '--run-id') {
      jobId = args[++i];
    } else if (arg.startsWith('--job=')) {
      jobId = arg.slice('--job='.length);
    } else if (arg.startsWith('--run=')) {
      jobId = arg.slice('--run='.length);
    } else if (arg.startsWith('--run-id=')) {
      jobId = arg.slice('--run-id='.length);
    } else {
      filtered.push(arg);
    }
  }

  if (!jobId && process.env.REACTIVE_JOB_ID && process.env.REACTIVE_JOB_ID.trim()) {
    jobId = process.env.REACTIVE_JOB_ID.trim();
  }

  const parsedLimit = parseInt(filtered[0], 10);
  if (!Number.isNaN(parsedLimit)) {
    return { limit: parsedLimit, skillName: filtered[1], jobId };
  }
  return { limit: 20, skillName: filtered[0], jobId };
}

function findDefaultSkillFromWorkspace(): string | undefined {
  const reactiveSkillsDir = path.resolve(process.cwd(), '.reactive', 'skills');
  if (!fs.existsSync(reactiveSkillsDir)) return undefined;

  const dirs = fs.readdirSync(reactiveSkillsDir, { withFileTypes: true });
  const found = dirs.find((dirent) => {
    if (!dirent.isDirectory()) return false;
    const skillDir = path.join(reactiveSkillsDir, dirent.name);
    return fs.existsSync(path.join(skillDir, 'events.jsonl')) ||
      fs.existsSync(path.join(skillDir, 'events.db')) ||
      fs.existsSync(path.join(skillDir, 'runs'));
  });
  return found?.name;
}

function resolveEventsPath(workspaceDir: string, skillName: string): string {
  const skillStoreDir = path.join(workspaceDir, '.reactive', 'skills', skillName);
  return path.join(skillStoreDir, 'events.jsonl');
}

function readEventsJsonl(eventsPath: string, limit: number, runId?: string): EventEntry[] {
  if (!fs.existsSync(eventsPath)) return [];

  const content = fs.readFileSync(eventsPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  const events: EventEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (runId && parsed.run_id && parsed.run_id !== runId) continue;
      events.push({
        seq: parsed.seq || 0,
        timestamp: parsed.timestamp || '',
        type: parsed.type || '',
        state: parsed.state || '',
      });
    } catch {
      // Skip malformed lines.
    }
  }

  return events.slice(-limit);
}

export async function eventsCommand(args: string[]): Promise<string> {
  const parsed = parseEventsArgs(args);
  let targetSkill = parsed.skillName || findDefaultSkillFromWorkspace();

  if (!targetSkill) {
    const error = new AxiError(
      'No skill specified and no active skill runs found',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi events [limit] <skill-name> [--job <job-id>]']
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
      ['Checked: ./skills/, ~/.agents/skills/, ~/.gemini/config/skills/', 'Usage: reactive-skills-axi events [limit] [skill-name] [--job <job-id>]']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const workspaceDir = resolveWorkspaceDir(targetPath);
  const jobManager = new JobManager(workspaceDir);
  const requestedRunId = parsed.jobId || jobManager.getActiveJobId(targetSkill);
  const runId = jobManager.resolveRunId(targetSkill, requestedRunId) || requestedRunId;
  const eventsPath = resolveEventsPath(workspaceDir, targetSkill);
  const events = readEventsJsonl(eventsPath, parsed.limit, runId);

  if (events.length === 0) {
    const error = new AxiError(
      'No events found for skill: ' + targetSkill,
      'NO_EVENT_STORE',
      ['No events.jsonl found at ' + eventsPath, 'Run a reactive skill to generate events']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const lines: string[] = [];
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
