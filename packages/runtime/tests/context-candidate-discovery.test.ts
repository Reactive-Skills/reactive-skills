import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverContextCandidates } from '../src/core/context-candidate-discovery.js';

describe('discoverContextCandidates', () => {
  let workspaceDir: string | undefined;

  afterEach(() => {
    if (workspaceDir) fs.rmSync(workspaceDir, { recursive: true, force: true });
    workspaceDir = undefined;
  });

  it('discovers skill metadata and ignores folders without skill files', () => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-candidate-discovery-'));
    const skillDir = path.join(workspaceDir, 'skills', 'quasar-lattice');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: quasar-lattice',
      'description: Build quasar lattice release gates for package pipelines',
      '---',
      '# Quasar Lattice',
    ].join('\n'));
    fs.mkdirSync(path.join(workspaceDir, 'skills', 'arbitrary-folder'));

    const candidates = discoverContextCandidates(
      'Build quasar lattice release gates for package pipelines',
      workspaceDir,
    );

    expect(candidates).toContainEqual({
      id: 'quasar-lattice',
      skill: 'quasar-lattice',
      summary: 'Build quasar lattice release gates for package pipelines',
    });
    expect(candidates.some((candidate) => candidate.id === 'arbitrary-folder')).toBe(false);
    expect(candidates.length).toBeLessThanOrEqual(12);
  });
});
