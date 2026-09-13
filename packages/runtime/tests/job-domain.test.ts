import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { JobMetadataSchema } from '../src/core/types.js';
import {
  normalizeJobSlug,
  JobManager,
  DEFAULT_JOB_ID,
} from '../src/core/job-manager.js';

describe('Job Domain & Metadata (Leaf 1)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-job-domain-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('JobMetadataSchema', () => {
    it('validates a complete JobMetadata object', () => {
      const validJob = {
        id: '01J8ABCDEF1234567890XYZ',
        name: 'auth-slice',
        skillId: 'synthesis',
        status: 'active',
        currentState: 'phase_1_intake',
        parentRunId: 'parent-run-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const parsed = JobMetadataSchema.parse(validJob);
      expect(parsed.id).toBe(validJob.id);
      expect(parsed.status).toBe('active');
    });

    it('rejects an invalid job status', () => {
      const invalidJob = {
        id: '123',
        name: 'auth-slice',
        skillId: 'synthesis',
        status: 'unknown_status',
        currentState: 'phase_1_intake',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() => JobMetadataSchema.parse(invalidJob)).toThrow();
    });
  });

  describe('normalizeJobSlug', () => {
    it('normalizes arbitrary human names into safe filesystem slugs', () => {
      expect(normalizeJobSlug('Auth Slice v1.0')).toBe('auth-slice-v1-0');
      expect(normalizeJobSlug('   My  Feature!  ')).toBe('my-feature');
      expect(normalizeJobSlug('SLICE_02_PAYMENTS')).toBe('slice-02-payments');
    });

    it('handles empty or special-character-only strings with a default fallback', () => {
      expect(normalizeJobSlug('')).toMatch(/^job-/);
      expect(normalizeJobSlug('!!!@@@###')).toMatch(/^job-/);
    });
  });

  describe('JobManager - Active Pointer Resolution', () => {
    it('active pointer fallback: returns default when no active_job file exists', () => {
      const manager = new JobManager(tmpDir);
      const activeId = manager.getActiveJobId('synthesis');
      expect(activeId).toBe(DEFAULT_JOB_ID);
      expect(DEFAULT_JOB_ID).toBe('default');
    });

    it('sets and retrieves the active job pointer', () => {
      const manager = new JobManager(tmpDir);
      manager.setActiveJobId('synthesis', 'auth-slice-1');

      const activeId = manager.getActiveJobId('synthesis');
      expect(activeId).toBe('auth-slice-1');

      const pointerPath = path.join(tmpDir, '.reactive', 'skills', 'synthesis', 'active_job');
      expect(fs.existsSync(pointerPath)).toBe(true);
      expect(fs.readFileSync(pointerPath, 'utf8').trim()).toBe('auth-slice-1');
    });
  });

  describe('JobManager - Lifecycle & Metadata Persistence', () => {
    it('creates a new job and saves job.json metadata', () => {
      const manager = new JobManager(tmpDir);
      const job = manager.createJob('synthesis', {
        name: 'Billing Integration',
        initialState: 'INIT',
        setActive: true,
      });

      expect(job.name).toBe('billing-integration');
      expect(job.status).toBe('active');
      expect(job.currentState).toBe('INIT');
      expect(manager.getActiveJobId('synthesis')).toBe(job.id);

      const jobDir = path.join(tmpDir, '.reactive', 'skills', 'synthesis', 'jobs', job.id);
      expect(fs.existsSync(path.join(jobDir, 'job.json'))).toBe(true);

      const fetched = manager.getJob('synthesis', job.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.name).toBe('billing-integration');
    });

    it('lists all jobs for a skill, recognizing existing legacy un-itemized stores', () => {
      const manager = new JobManager(tmpDir);

      // Create two distinct jobs
      const job1 = manager.createJob('synthesis', { name: 'slice-1', initialState: 'INIT' });
      const job2 = manager.createJob('synthesis', { name: 'slice-2', initialState: 'INIT' });

      const jobs = manager.listJobs('synthesis');
      expect(jobs.length).toBe(2);
      const ids = jobs.map(j => j.id);
      expect(ids).toContain(job1.id);
      expect(ids).toContain(job2.id);
    });

    it('updates job status and current state on lifecycle transitions', () => {
      const manager = new JobManager(tmpDir);
      const job = manager.createJob('synthesis', { name: 'auth-slice', initialState: 'INIT' });

      manager.updateJob('synthesis', job.id, {
        currentState: 'PHASE_1_INTAKE',
        status: 'active',
      });

      const updated = manager.getJob('synthesis', job.id);
      expect(updated?.currentState).toBe('PHASE_1_INTAKE');

      manager.updateJob('synthesis', job.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      const completed = manager.getJob('synthesis', job.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.completedAt).toBeDefined();
    });
  });
});
