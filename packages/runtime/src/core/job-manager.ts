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
    return path.join(this.getSkillDir(skillId), 'jobs');
  }

  public getJobDir(skillId: string, jobId: string): string {
    return path.join(this.getJobsDir(skillId), jobId);
  }

  /**
   * Resolves the current active job ID for a skill.
   * Falls back to DEFAULT_JOB_ID ('default') if no pointer exists.
   */
  public getActiveJobId(skillId: string): string {
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
   */
  public setActiveJobId(skillId: string, jobId: string): void {
    const targetDir = this.getSkillDir(skillId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const pointerFile = this.getActivePointerPath(skillId);
    fs.writeFileSync(pointerFile, jobId.trim(), 'utf8');
  }

  /**
   * Creates a new isolated job and persists its job.json metadata.
   */
  public createJob(skillId: string, options: CreateJobOptions = {}): JobMetadata {
    const id = options.id || createSortableId();
    const name = options.name ? normalizeJobSlug(options.name) : normalizeJobSlug(id);
    const now = new Date().toISOString();

    const metadata: JobMetadata = {
      id,
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
    const jobDir = this.getJobDir(skillId, jobId);
    const metadataPath = path.join(jobDir, 'job.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        return JobMetadataSchema.parse(raw);
      } catch {
        return null;
      }
    }

    // Fallback: if jobDir exists (e.g. created by EventStore), synthesize metadata
    if (fs.existsSync(jobDir)) {
      const stat = fs.statSync(jobDir);
      return {
        id: jobId,
        name: normalizeJobSlug(jobId),
        skillId,
        status: 'active',
        currentState: 'INIT',
        createdAt: stat.birthtime && !isNaN(stat.birthtime.getTime()) ? stat.birthtime.toISOString() : new Date().toISOString(),
        updatedAt: stat.mtime && !isNaN(stat.mtime.getTime()) ? stat.mtime.toISOString() : new Date().toISOString(),
      };
    }

    // Check if it's the active job pointer
    if (jobId === this.getActiveJobId(skillId)) {
      const pointerFile = this.getActivePointerPath(skillId);
      if (fs.existsSync(pointerFile)) {
        const stat = fs.statSync(pointerFile);
        return {
          id: jobId,
          name: normalizeJobSlug(jobId),
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
    const existing = this.getJob(skillId, jobId) || this.createJob(skillId, { id: jobId, name: jobId });
    const updated: JobMetadata = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const validated = JobMetadataSchema.parse(updated);
    const jobDir = this.getJobDir(skillId, jobId);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }

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
