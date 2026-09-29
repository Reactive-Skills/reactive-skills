import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverContextCandidates } from '../src/core/context-candidate-discovery.js';

describe('discoverContextCandidates', () => {
  let workspaceDir: string | undefined;

  afterEach(() => {
    vi.restoreAllMocks();
    if (workspaceDir) fs.rmSync(workspaceDir, { recursive: true, force: true });
    workspaceDir = undefined;
  });

  it('discovers all skill metadata and ignores folders without skill files', () => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-candidate-discovery-'));
    const isolatedHome = path.join(workspaceDir, 'home');
    fs.mkdirSync(isolatedHome, { recursive: true });
    vi.spyOn(os, 'homedir').mockReturnValue(isolatedHome);
    const skillNames = [
      'quasar-lattice',
      ...Array.from({ length: 12 }, (_, index) => `extra-skill-${index}`),
    ];
    for (const skillName of skillNames) {
      const skillDir = path.join(workspaceDir, 'skills', skillName);
      fs.mkdirSync(skillDir, { recursive: true });
      const description = skillName === 'quasar-lattice'
        ? 'Build quasar lattice release gates for package pipelines'
        : `Instructions for ${skillName}`;
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
        '---',
        `name: ${skillName}`,
        `description: ${description}`,
        '---',
        `# ${skillName}`,
      ].join('\n'));
    }
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
    expect(candidates).toHaveLength(13);
  });
});
