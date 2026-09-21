import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { EventStore, FSMEngine, JobManager, TelemetryServer } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { extractJobFlag, resolveWorkspaceDir } from '../args.js';

const HOME_DIR = os.homedir();

function resolveSkillPath(skillName: string): string | null {
  const directPath = path.resolve(process.cwd(), skillName);
  if (fs.existsSync(path.join(directPath, 'skill.yaml'))) {
    return directPath;
  }

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

export async function viewCommand(args: string[]): Promise<string> {
  const { jobId, filteredArgs } = extractJobFlag(args);
  let skillName: string | undefined;
  let port = 4242;
  let host = '127.0.0.1';
  let once = false;

  for (let i = 0; i < filteredArgs.length; i++) {
    const arg = filteredArgs[i];
    if (arg === '--port' && i + 1 < filteredArgs.length) {
      const parsed = parseInt(filteredArgs[i + 1], 10);
      if (!isNaN(parsed)) port = parsed;
      i++;
    } else if (arg === '--host' && i + 1 < filteredArgs.length) {
      host = filteredArgs[i + 1];
      i++;
    } else if (arg === '--once') {
      once = true;
    } else if (!arg.startsWith('--') && !skillName) {
      skillName = arg;
    }
  }

  // Fallback 1: check current directory
  if (!skillName && fs.existsSync(path.join(process.cwd(), 'skill.yaml'))) {
    skillName = path.basename(process.cwd());
  }

  // Fallback 2: check .reactive/skills
  if (!skillName) {
    const reactiveSkillsDir = path.resolve(process.cwd(), '.reactive', 'skills');
    if (fs.existsSync(reactiveSkillsDir)) {
      const dirs = fs.readdirSync(reactiveSkillsDir, { withFileTypes: true });
      const found = dirs.find((d) => d.isDirectory() && (
        fs.existsSync(path.join(reactiveSkillsDir, d.name, 'events.jsonl')) ||
        fs.existsSync(path.join(reactiveSkillsDir, d.name, 'events.db'))
      ));
      if (found) {
        skillName = found.name;
      }
    }
  }

  if (!skillName) {
    const error = new AxiError(
      'No skill specified and no active skill found in workspace',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi view <skill-name> [--job <job-id>] [--port 4242]', 'Example: reactive-skills-axi view my-skill --job review-slice']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const skillPath = resolveSkillPath(skillName);
  const workspaceDir = skillPath ? resolveWorkspaceDir(skillPath) : process.cwd();

  let engine: FSMEngine | undefined;
  let eventStore: EventStore;

  try {
    if (skillPath) {
      if (jobId && !new JobManager(workspaceDir).getJob(skillName, jobId)) {
        throw new Error(`Job '${jobId}' not found for skill '${skillName}'. Run reactive-skills-axi jobs ${skillName} to list jobs.`);
      }
      engine = new FSMEngine({
        skillDir: skillPath,
        workspaceDir,
        jobId,
      });
      eventStore = engine.getEventStore();
    } else {
      eventStore = new EventStore({
        workspaceDir,
        skillId: skillName,
        ...(jobId ? { jobId, runId: jobId } : {}),
        enableSqlite: true,
      });
    }

    const telemetry = new TelemetryServer({
      eventStore,
      fsmEngine: engine,
      jobId: engine?.getJobId() ?? jobId,
      port,
      host,
      skillName,
    });

    const { port: boundPort, url } = await telemetry.start();

    const detail = renderDetail('view', {
      status: 'listening',
      skill_id: skillName,
      job_id: engine?.getJobId() ?? jobId,
      port: boundPort,
      url,
      dashboard: url,
      events_sse: `${url}/events`,
      state_endpoint: `${url}/state`,
      health_endpoint: `${url}/health`,
    }, [
      { type: 'field', key: 'status' },
      { type: 'field', key: 'skill_id' },
      { type: 'field', key: 'job_id' },
      { type: 'field', key: 'port' },
      { type: 'field', key: 'url' },
      { type: 'field', key: 'dashboard' },
      { type: 'field', key: 'events_sse' },
      { type: 'field', key: 'state_endpoint' },
      { type: 'field', key: 'health_endpoint' },
    ]);

    const suggestions = getSuggestions({ domain: 'events', action: 'tail', skillName });

    if (once) {
      await telemetry.stop();
      if (engine) {
        engine.close();
      } else {
        eventStore.close();
      }
      return renderOutput([detail, renderHelp(suggestions)]);
    }

    // Keep process alive if running interactively
    process.on('SIGINT', async () => {
      await telemetry.stop();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await telemetry.stop();
      process.exit(0);
    });

    return renderOutput([detail, renderHelp(suggestions)]);
  } catch (err: any) {
    const error = new AxiError(
      `Failed to launch telemetry viewer: ${err.message}`,
      'RUNTIME_ERROR',
      ['Check if port is already in use', 'Verify skill.yaml manifest validity']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }
}
