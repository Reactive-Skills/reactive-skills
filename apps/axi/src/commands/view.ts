import path from 'node:path';
import fs from 'node:fs';
import { EventStore, FSMEngine, JobManager, TelemetryServer } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { extractJobFlag, resolveWorkspaceDir, resolveSkillPath } from '../args.js';

/**
 * Extract telemetry selection and listener arguments before workspace discovery.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target)
 * - Complexity: O(a), argument count
 * - Cyclomatic Complexity (CC): target <=15
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=20
 */
function parseViewArgs(args: string[]) {
  const { jobId, filteredArgs } = extractJobFlag(args);
  let skillName: string | undefined;
  let port: number | undefined;
  let preferredPort: number | undefined;
  let host = '127.0.0.1';
  let once = false;

  for (let i = 0; i < filteredArgs.length; i++) {
    const arg = filteredArgs[i];
    if (arg === '--port' && i + 1 < filteredArgs.length) {
      const parsed = parseInt(filteredArgs[i + 1], 10);
      if (!isNaN(parsed)) port = parsed;
      i++;
    } else if (arg === '--preferred-port' && i + 1 < filteredArgs.length) {
      const parsed = parseInt(filteredArgs[i + 1], 10);
      if (!isNaN(parsed)) preferredPort = parsed;
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

  return { jobId, skillName, port, preferredPort, host, once };
}

/**
 * Open telemetry for the selected workspace and run.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms target excluding listener startup and command lifetime)
 * - Complexity: O(s + n), workspace skill discovery and cold ledger replay
 * - Cyclomatic Complexity (CC): target <=30 (existing command orchestration)
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=30
 */
export async function viewCommand(args: string[]): Promise<string> {
  const parsed = parseViewArgs(args);
  let { skillName } = parsed;
  const { jobId, port, preferredPort, host, once } = parsed;

  // Fallback 1: check current directory
  if (!skillName && fs.existsSync(path.join(process.cwd(), 'skill.yaml'))) {
    skillName = path.basename(process.cwd());
  }

  // Fallback 2: check .reactive/skills
  if (!skillName) {
    const reactiveSkillsDir = path.resolve(resolveWorkspaceDir(), '.reactive', 'skills');
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
      ['Usage: reactive-skills-axi view <skill-name> [--job <job-id>] [--port <number>]', 'Example: reactive-skills-axi view my-skill --job review-slice']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  const skillPath = resolveSkillPath(skillName);
  const workspaceDir = resolveWorkspaceDir(skillPath || undefined);

  let engine: FSMEngine | undefined;
  let eventStore: EventStore | undefined;
  let telemetry: TelemetryServer | undefined;

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

    if (!eventStore) {
      throw new Error('Telemetry event store was not initialized');
    }

    const telemetryServer = new TelemetryServer({
      eventStore,
      fsmEngine: engine,
      jobId: engine?.getJobId() ?? jobId,
      port,
      preferredPort,
      host,
      skillName,
    });
    telemetry = telemetryServer;

    const { port: boundPort, url } = await telemetryServer.start();

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
      await telemetryServer.stop();
      if (engine) {
        engine.close();
      } else {
        eventStore.close();
      }
      return renderOutput([detail, renderHelp(suggestions)]);
    }

    // Keep process alive if running interactively
    process.on('SIGINT', async () => {
      await telemetryServer.stop();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await telemetryServer.stop();
      process.exit(0);
    });

    return renderOutput([detail, renderHelp(suggestions)]);
  } catch (err: any) {
    if (telemetry) {
      await telemetry.stop().catch(() => undefined);
    }
    if (engine) {
      engine.close();
    } else {
      eventStore?.close();
    }
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
