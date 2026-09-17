import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { JobManager } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { extractJobFlag, resolveWorkspaceDir, resolveSkillPath } from '../args.js';


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
  const isPurge = args.includes('--purge') || args.includes('-p');
  const cleanArgs = args.filter(a => a !== '--purge' && a !== '-p');
  const { jobId, filteredArgs } = extractJobFlag(cleanArgs);
  const skillName = filteredArgs[0];

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi reset <skill-name> [--job <job-id>] [--purge]', 'Example: reactive-skills-axi reset my-skill']
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

  const workspaceDir = resolveWorkspaceDir(skillPath);
  const reactiveDir = path.join(workspaceDir, '.reactive', 'skills', skillName);
  const skillParentReactiveDir = path.join(path.dirname(skillPath), '.reactive', 'skills', skillName);

  if (!fs.existsSync(reactiveDir) && !fs.existsSync(skillParentReactiveDir)) {
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

  const jobManager = new JobManager(workspaceDir);

  if (isPurge) {
    const { deleted, errors } = deleteRecursive(reactiveDir);
    if (skillParentReactiveDir !== reactiveDir && fs.existsSync(skillParentReactiveDir)) {
      const { deleted: oDel, errors: oErr } = deleteRecursive(skillParentReactiveDir);
      deleted.push(...oDel);
      errors.push(...oErr);
    }
    const lines: string[] = [];
    lines.push(renderDetail('reset', {
      skill_id: skillName,
      status: errors.length === 0 ? 'purged' : 'partial',
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
    lines.push(renderHelp([
      `All event stores, snapshots, and jobs at ${reactiveDir} were completely purged.`,
      `Run \`reactive-skills-axi invoke ${skillName}\` to start a fresh run.`,
    ]));
    return renderOutput(lines);
  }

  // Non-destructive reset: archive current active job and rotate to fresh job
  const activeJobId = jobId || jobManager.getActiveJobId(skillName);
  jobManager.updateJob(skillName, activeJobId, {
    status: 'archived',
    completedAt: new Date().toISOString(),
  });

  const freshJob = jobManager.createJob(skillName, {
    setActive: true,
  });

  const lines: string[] = [];
  lines.push(renderDetail('reset', {
    skill_id: skillName,
    status: 'archived_and_rotated',
    archived_job: activeJobId,
    fresh_job: freshJob.id,
    reactive_dir: reactiveDir,
  }, [
    { type: 'field', key: 'skill_id' },
    { type: 'field', key: 'status' },
    { type: 'field', key: 'archived_job' },
    { type: 'field', key: 'fresh_job' },
    { type: 'field', key: 'reactive_dir' },
  ]));

  const helpLines: string[] = [
    `Job '${activeJobId}' has been archived non-destructively.`,
    `Active job rotated to fresh job '${freshJob.id}'.`,
    `Run \`reactive-skills-axi state ${skillName}\` to inspect initial state.`,
    `Pass \`--purge\` to permanently delete all historical jobs and event data.`,
  ];
  lines.push(renderHelp(helpLines));

  return renderOutput(lines);
}
