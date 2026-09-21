import fs from 'node:fs';
import path from 'node:path';
import { createSortableId } from './event-store.js';
import { JobMetadata, JobMetadataSchema } from './types.js';

export const DEFAULT_JOB_ID = 'default';

/**
 * Converts arbitrary human strings (e.g. 'Auth Slice v1.0') into safe filesystem slugs.
 */
export function normalizeJobSlug(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleaned) {
    return `job-${createSortableId().slice(0, 8)}`;
  }
  return cleaned;
}

export interface CreateJobOptions {
  id?: string;
  runId?: string;
  alias?: string;
  name?: string;
  initialState?: string;
  parentRunId?: string;
  setActive?: boolean;
}

export const TERMINAL_STATES = new Set([
  'COMPLETED',
  'DONE',
  'SUCCESS',
  'ERROR',
  'BYPASS_DETECTED',
  'ABORTED',
  'TERMINAL',
]);

/**
 * Determines whether a job is in a terminal state (either by status or currentState).
 */
export function isJobTerminal(job: JobMetadata): boolean {
  if (job.status === 'completed' || job.status === 'archived' || job.status === 'failed') {
    return true;
  }
  const lastStateSegment = (job.currentState || '').split('.').pop() || job.currentState;
  return TERMINAL_STATES.has(lastStateSegment.toUpperCase());
}

/**
 * JobManager handles execution run isolation, active job pointer resolution,
 * and job metadata persistence.
 */
export class JobManager {
  private workspaceDir: string;

  constructor(workspaceDir = process.cwd()) {
    this.workspaceDir = path.resolve(workspaceDir);
  }

  public getSkillDir(skillId: string): string {
    return path.join(this.workspaceDir, '.reactive', 'skills', skillId);
  }

  public getActivePointerPath(skillId: string): string {
    return path.join(this.getSkillDir(skillId), 'active_job');
  }

  public getJobsDir(skillId: string): string {
    return path.join(this.getSkillDir(skillId), 'runs');
  }

  public getJobDir(skillId: string, jobId: string): string {
    return path.join(this.getJobsDir(skillId), jobId);
  }

  public getLegacyJobsDir(skillId: string): string {
    return path.join(this.getSkillDir(skillId), 'jobs');
  }

  public getLegacyJobDir(skillId: string, jobId: string): string {
    return path.join(this.getLegacyJobsDir(skillId), jobId);
  }

  /**
   * Resolves the current active job ID for a skill.
   * Prioritizes process.env.REACTIVE_JOB_ID, then active_job file,
   * falling back to DEFAULT_JOB_ID ('default') if no pointer exists.
   */
  public getActiveJobId(skillId: string): string {
    if (process.env.REACTIVE_JOB_ID && process.env.REACTIVE_JOB_ID.trim()) {
      return process.env.REACTIVE_JOB_ID.trim();
    }
    const pointerFile = this.getActivePointerPath(skillId);
    if (fs.existsSync(pointerFile)) {
      try {
        const id = fs.readFileSync(pointerFile, 'utf8').trim();
        if (id) return id;
      } catch {
        // Fall back to default
      }
    }
    return DEFAULT_JOB_ID;
  }

  /**
   * Sets the active job pointer for a skill.
   * If process.env.REACTIVE_JOB_ID is defined, does not mutate filesystem pointer
   * to protect concurrent subagent sessions.
   */
  public setActiveJobId(skillId: string, jobId: string): void {
    if (process.env.REACTIVE_JOB_ID && process.env.REACTIVE_JOB_ID.trim()) {
      return;
    }
    const targetDir = this.getSkillDir(skillId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const pointerFile = this.getActivePointerPath(skillId);
    const resolved = this.resolveRunId(skillId, jobId.trim()) || jobId.trim();
    fs.writeFileSync(pointerFile, resolved, 'utf8');
  }

  /**
   * Creates a new isolated job and persists its job.json metadata.
   */
  public createJob(skillId: string, options: CreateJobOptions = {}): JobMetadata {
    const id = options.runId || options.id || createSortableId();
    const name = options.alias || options.name ? normalizeJobSlug(options.alias || options.name || id) : normalizeJobSlug(id);
    const now = new Date().toISOString();

    const metadata: JobMetadata = {
      id,
      runId: id,
      name,
      skillId,
      status: 'active',
      currentState: options.initialState || 'INIT',
      parentRunId: options.parentRunId,
      createdAt: now,
      updatedAt: now,
    };

    const jobDir = this.getJobDir(skillId, id);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }
    fs.mkdirSync(path.join(jobDir, 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(jobDir, 'logs'), { recursive: true });

    const metadataPath = path.join(jobDir, 'job.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    if (options.setActive) {
      this.setActiveJobId(skillId, id);
    }

    return metadata;
  }

  /**
   * Retrieves a job's metadata by ID.
   */
  public getJob(skillId: string, jobId: string): JobMetadata | null {
    const resolvedId = this.resolveRunId(skillId, jobId) || jobId;
    const jobDir = this.getJobDir(skillId, resolvedId);
    const metadataPath = path.join(jobDir, 'job.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        return JobMetadataSchema.parse({ ...raw, id: raw.runId || raw.id, runId: raw.runId || raw.id });
      } catch {
        return null;
      }
    }

    // Fallback: if jobDir exists (e.g. created by EventStore), synthesize metadata
    if (fs.existsSync(jobDir)) {
      const stat = fs.statSync(jobDir);
      return {
        id: resolvedId,
        runId: resolvedId,
        name: normalizeJobSlug(resolvedId),
        skillId,
        status: 'active',
        currentState: 'INIT',
        createdAt: stat.birthtime && !isNaN(stat.birthtime.getTime()) ? stat.birthtime.toISOString() : new Date().toISOString(),
        updatedAt: stat.mtime && !isNaN(stat.mtime.getTime()) ? stat.mtime.toISOString() : new Date().toISOString(),
      };
    }

    const legacyJobDir = this.getLegacyJobDir(skillId, resolvedId);
    const legacyMetadataPath = path.join(legacyJobDir, 'job.json');
    if (fs.existsSync(legacyMetadataPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(legacyMetadataPath, 'utf8'));
        return JobMetadataSchema.parse({ ...raw, id: raw.runId || raw.id, runId: raw.runId || raw.id });
      } catch {
        return null;
      }
    }

    // Check if it's the active job pointer
    if (jobId === this.getActiveJobId(skillId)) {
      const pointerFile = this.getActivePointerPath(skillId);
      if (fs.existsSync(pointerFile)) {
        const stat = fs.statSync(pointerFile);
        return {
          id: resolvedId,
          runId: resolvedId,
          name: normalizeJobSlug(resolvedId),
          skillId,
          status: 'active',
          currentState: 'INIT',
          createdAt: stat.birthtime && !isNaN(stat.birthtime.getTime()) ? stat.birthtime.toISOString() : new Date().toISOString(),
          updatedAt: stat.mtime && !isNaN(stat.mtime.getTime()) ? stat.mtime.toISOString() : new Date().toISOString(),
        };
      }
    }

    // Legacy fallback: if requesting 'default' and legacy events.jsonl exists at skill root
    if (jobId === DEFAULT_JOB_ID) {
      const legacyEventStore = path.join(this.getSkillDir(skillId), 'events.jsonl');
      if (fs.existsSync(legacyEventStore)) {
        return {
          id: DEFAULT_JOB_ID,
          name: DEFAULT_JOB_ID,
          skillId,
          status: 'active',
          currentState: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }

    return null;
  }

  /**
   * Updates a job's metadata (e.g. status, currentState, completedAt).
   */
  public updateJob(skillId: string, jobId: string, updates: Partial<JobMetadata>): JobMetadata {
    const resolvedId = this.resolveRunId(skillId, jobId) || jobId;
    const existing = this.getJob(skillId, resolvedId) || this.createJob(skillId, { runId: resolvedId, name: resolvedId });
    const updated: JobMetadata = {
      ...existing,
      ...updates,
      id: existing.runId || existing.id,
      runId: existing.runId || existing.id,
      name: updates.name ? normalizeJobSlug(updates.name) : existing.name,
      updatedAt: new Date().toISOString(),
    };

    const validated = JobMetadataSchema.parse(updated);
    const jobDir = this.getJobDir(skillId, updated.runId || updated.id);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }
    fs.mkdirSync(path.join(jobDir, 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(jobDir, 'logs'), { recursive: true });

    const metadataPath = path.join(jobDir, 'job.json');
    fs.writeFileSync(metadataPath, JSON.stringify(validated, null, 2), 'utf8');
    return validated;
  }

  /**
   * Lists all jobs for a skill.
   */
  public listJobs(skillId: string): JobMetadata[] {
    const jobs: JobMetadata[] = [];
    const jobsDir = this.getJobsDir(skillId);

    if (fs.existsSync(jobsDir)) {
      const entries = fs.readdirSync(jobsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const job = this.getJob(skillId, entry.name);
          if (job) {
            jobs.push(job);
          }
        }
      }
    }

    const legacyJobsDir = this.getLegacyJobsDir(skillId);
    if (fs.existsSync(legacyJobsDir)) {
      const entries = fs.readdirSync(legacyJobsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const job = this.getJob(skillId, entry.name);
          if (job && !jobs.some(existing => existing.id === job.id)) jobs.push(job);
        }
      }
    }

    const activeJobId = this.getActiveJobId(skillId);
    if (!jobs.some(j => j.id === activeJobId)) {
      const activeJob = this.getJob(skillId, activeJobId);
      if (activeJob) {
        jobs.push(activeJob);
      }
    }

    // Check for legacy root event store if no jobs found
    if (jobs.length === 0) {
      const legacyEventStore = path.join(this.getSkillDir(skillId), 'events.jsonl');
      if (fs.existsSync(legacyEventStore)) {
        const defaultJob = this.getJob(skillId, DEFAULT_JOB_ID);
        if (defaultJob) jobs.push(defaultJob);
      }
    }

    return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Resolve either an immutable run ID or a mutable human-readable alias. */
  public resolveRunId(skillId: string, reference: string): string | null {
    const mappingPath = path.join(this.getSkillDir(skillId), '.legacy-run-migrations.json');
    if (fs.existsSync(mappingPath)) {
      try {
        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8')) as Record<string, string>;
        if (mapping[reference]) return mapping[reference];
      } catch {
        // Fall through to direct and alias lookup.
      }
    }
    const direct = this.getJobMetadataAt(this.getJobDir(skillId, reference));
    if (direct) return direct.runId || direct.id;
    const legacy = this.getJobMetadataAt(this.getLegacyJobDir(skillId, reference));
    if (legacy) return legacy.runId || legacy.id;

    for (const directory of [this.getJobsDir(skillId), this.getLegacyJobsDir(skillId)]) {
      if (!fs.existsSync(directory)) continue;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const metadata = this.getJobMetadataAt(path.join(directory, entry.name));
        if (metadata && normalizeJobSlug(metadata.name) === normalizeJobSlug(reference)) {
          return metadata.runId || metadata.id;
        }
      }
    }
    return null;
  }

  /**
   * Copy legacy per-job filesystem state into UUID-backed run directories.
   * Legacy directories remain intact until an operator explicitly removes them.
   */
  public migrateLegacyRuns(skillId: string): Record<string, string> {
    const legacyDir = this.getLegacyJobsDir(skillId);
    if (!fs.existsSync(legacyDir)) return {};
    const mappingPath = path.join(this.getSkillDir(skillId), '.legacy-run-migrations.json');
    let mapping: Record<string, string> = {};
    if (fs.existsSync(mappingPath)) {
      try { mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8')); } catch { mapping = {}; }
    }
    let changed = false;
    for (const entry of fs.readdirSync(legacyDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const oldId = entry.name;
      const newId = mapping[oldId] || createSortableId();
      if (!mapping[oldId]) {
        mapping[oldId] = newId;
        changed = true;
      }
      const oldPath = path.join(legacyDir, oldId);
      const newPath = this.getJobDir(skillId, newId);
      fs.mkdirSync(path.join(newPath, 'artifacts'), { recursive: true });
      fs.mkdirSync(path.join(newPath, 'logs'), { recursive: true });
      for (const directory of ['artifacts', 'logs']) {
        const source = path.join(oldPath, directory);
        const target = path.join(newPath, directory);
        if (fs.existsSync(source) && fs.readdirSync(source).length > 0 && fs.readdirSync(target).length === 0) {
          fs.cpSync(source, target, { recursive: true });
        }
      }
      const oldMetadataPath = path.join(oldPath, 'job.json');
      const newMetadataPath = path.join(newPath, 'job.json');
      if (!fs.existsSync(newMetadataPath)) {
        let raw: any = {};
        if (fs.existsSync(oldMetadataPath)) {
          try { raw = JSON.parse(fs.readFileSync(oldMetadataPath, 'utf8')); } catch { raw = {}; }
        }
        const now = new Date().toISOString();
        const metadata = {
          id: newId,
          runId: newId,
          name: raw.name || normalizeJobSlug(oldId),
          skillId,
          status: raw.status || 'active',
          currentState: raw.currentState || 'INIT',
          parentRunId: raw.parentRunId,
          createdAt: raw.createdAt || now,
          updatedAt: raw.updatedAt || now,
          completedAt: raw.completedAt,
        };
        fs.writeFileSync(newMetadataPath, JSON.stringify(metadata, null, 2), 'utf8');
      }
    }
    if (changed) {
      fs.mkdirSync(path.dirname(mappingPath), { recursive: true });
      fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf8');
    }
    return mapping;
  }

  private getJobMetadataAt(jobDir: string): JobMetadata | null {
    const metadataPath = path.join(jobDir, 'job.json');
    if (!fs.existsSync(metadataPath)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return JobMetadataSchema.parse({ ...raw, id: raw.runId || raw.id, runId: raw.runId || raw.id });
    } catch {
      return null;
    }
  }

  /**
   * Rotates the active job pointer to a fresh job if the current active job is in a terminal state.
   */
  public rotateIfTerminal(skillId: string): { rotated: boolean; activeJobId: string; previousJobId?: string } {
    const activeJobId = this.getActiveJobId(skillId);
    const job = this.getJob(skillId, activeJobId);

    if (job && isJobTerminal(job)) {
      this.updateJob(skillId, activeJobId, {
        status: 'archived',
        completedAt: job.completedAt || new Date().toISOString(),
      });

      const freshJob = this.createJob(skillId, {
        setActive: true,
      });

      return {
        rotated: true,
        activeJobId: freshJob.id,
        previousJobId: activeJobId,
      };
    }

    return {
      rotated: false,
      activeJobId,
    };
  }
}
