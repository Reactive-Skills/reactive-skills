import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { JobManager } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderList, renderDetail, renderOutput } from '../toon.js';
import { resolveWorkspaceDir } from '../args.js';

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

export async function jobsCommand(args: string[]): Promise<string> {
  const KNOWN_SUBCOMMANDS = ['list', 'switch', 'archive'];
  let subCommand = 'list';
  let skillName = '';
  let targetJobId: string | undefined;

  if (args.length > 0 && KNOWN_SUBCOMMANDS.includes(args[0])) {
    subCommand = args[0];
    skillName = args[1] || '';
    targetJobId = args[2];
  } else if (args.length > 1 && KNOWN_SUBCOMMANDS.includes(args[1])) {
    skillName = args[0] || '';
    subCommand = args[1];
    targetJobId = args[2];
  } else {
    subCommand = 'list';
    skillName = args[0] || '';
    targetJobId = args[1];
  }

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      [
        'Usage: reactive-skills-axi jobs <skill-name>',
        '       reactive-skills-axi jobs list <skill-name>',
        '       reactive-skills-axi jobs switch <skill-name> <job-id>',
        '       reactive-skills-axi jobs archive <skill-name> [job-id]',
      ]
    );
    return renderOutput([renderError(error.message, error.code, error.suggestions)]);
  }

  const skillPath = resolveSkillPath(skillName);
  if (!skillPath) {
    const error = new AxiError(
      `Skill '${skillName}' not found in any known location`,
      'NOT_FOUND',
      ['Checked: ./skills/, ~/.agents/skills/, ~/.gemini/config/skills/']
    );
    return renderOutput([renderError(error.message, error.code, error.suggestions)]);
  }

  const workspaceDir = resolveWorkspaceDir(skillPath);
  const jobManager = new JobManager(workspaceDir);

  switch (subCommand) {
    case 'switch': {
      if (!targetJobId) {
        const error = new AxiError(
          'Missing target job ID to switch to',
          'VALIDATION_ERROR',
          [`Usage: reactive-skills-axi jobs switch ${skillName} <job-id>`]
        );
        return renderOutput([renderError(error.message, error.code, error.suggestions)]);
      }

      const job = jobManager.getJob(skillName, targetJobId);
      if (!job) {
        const error = new AxiError(
          `Job '${targetJobId}' not found for skill '${skillName}'`,
          'NOT_FOUND',
          [`Run \`reactive-skills-axi jobs ${skillName}\` to list available jobs`]
        );
        return renderOutput([renderError(error.message, error.code, error.suggestions)]);
      }

      jobManager.setActiveJobId(skillName, targetJobId);

      // Re-mirror deliverables: copy archive deliverables to root if they exist
      const docsDir = path.join(workspaceDir, '.docs', skillName);
      const archiveDir = path.join(docsDir, 'jobs', targetJobId);
      let mirroredCount = 0;

      if (fs.existsSync(archiveDir)) {
        const files = fs.readdirSync(archiveDir);
        for (const file of files) {
          const src = path.join(archiveDir, file);
          if (fs.statSync(src).isFile()) {
            const dest = path.join(docsDir, file);
            fs.copyFileSync(src, dest);
            mirroredCount++;
          }
        }
      }

      const lines: string[] = [];
      lines.push(renderDetail('jobs_switch', {
        skill_id: skillName,
        active_job: targetJobId,
        status: job.status,
        current_state: job.currentState,
        mirrored_deliverables: mirroredCount,
      }, [
        { type: 'field', key: 'skill_id' },
        { type: 'field', key: 'active_job' },
        { type: 'field', key: 'status' },
        { type: 'field', key: 'current_state' },
        { type: 'field', key: 'mirrored_deliverables' },
      ]));
      lines.push(renderHelp([
        `Switched active job to '${targetJobId}'.`,
        `Canonical deliverables in .docs/${skillName}/ synchronized.`,
      ]));
      return renderOutput(lines);
    }

    case 'archive': {
      const archiveJobId = targetJobId || jobManager.getActiveJobId(skillName);
      const job = jobManager.getJob(skillName, archiveJobId);
      if (!job) {
        const error = new AxiError(
          `Job '${archiveJobId}' not found to archive`,
          'NOT_FOUND',
          [`Run \`reactive-skills-axi jobs ${skillName}\` to list available jobs`]
        );
        return renderOutput([renderError(error.message, error.code, error.suggestions)]);
      }

      jobManager.updateJob(skillName, archiveJobId, {
        status: 'archived',
        completedAt: new Date().toISOString(),
      });

      // Rotate pointer if active job was archived
      const currentActive = jobManager.getActiveJobId(skillName);
      let freshJobId = currentActive;
      if (currentActive === archiveJobId) {
        const freshJob = jobManager.createJob(skillName, { setActive: true });
        freshJobId = freshJob.id;
      }

      const lines: string[] = [];
      lines.push(renderDetail('jobs_archive', {
        skill_id: skillName,
        archived_job: archiveJobId,
        active_job: freshJobId,
      }, [
        { type: 'field', key: 'skill_id' },
        { type: 'field', key: 'archived_job' },
        { type: 'field', key: 'active_job' },
      ]));
      lines.push(renderHelp([
        `Job '${archiveJobId}' archived successfully.`,
        `Current active job is '${freshJobId}'.`,
      ]));
      return renderOutput(lines);
    }

    case 'list':
    default: {
      const jobs = jobManager.listJobs(skillName);
      const activeJobId = jobManager.getActiveJobId(skillName);

      if (jobs.length === 0) {
        const lines: string[] = [];
        lines.push(renderDetail('jobs', {
          skill_id: skillName,
          status: 'no_jobs_found',
          active_job: activeJobId,
        }, [
          { type: 'field', key: 'skill_id' },
          { type: 'field', key: 'status' },
          { type: 'field', key: 'active_job' },
        ]));
        lines.push(renderHelp([
          `No historical jobs found for skill '${skillName}'.`,
          `Run \`reactive-skills-axi state ${skillName}\` to start execution.`,
        ]));
        return renderOutput(lines);
      }

      const items = jobs.map(j => ({
        id: j.id,
        name: j.name,
        status: j.status,
        current_state: j.currentState,
        is_active: j.id === activeJobId,
        created_at: j.createdAt,
      }));

      const lines: string[] = [];
      lines.push(renderList('jobs', items, [
        { type: 'field', key: 'id' },
        { type: 'field', key: 'name' },
        { type: 'field', key: 'status' },
        { type: 'field', key: 'current_state' },
        { type: 'boolYesNo', key: 'is_active' },
        { type: 'relativeTime', key: 'created_at' },
      ]));

      lines.push(renderHelp([
        `Active job is '${activeJobId}'.`,
        `Run \`reactive-skills-axi jobs switch ${skillName} <job-id>\` to switch active job.`,
        `Run \`reactive-skills-axi state ${skillName} --job <job-id>\` to inspect a specific job.`,
      ]));

      return renderOutput(lines);
    }
  }
}
