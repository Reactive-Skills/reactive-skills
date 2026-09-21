import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const publishWorkflowPath = path.join(repositoryRoot, '.github', 'workflows', 'publish.yml');

describe('Release integrity workflow', () => {
  it('requires version tags whose commits are reachable from main', () => {
    const workflow = fs.readFileSync(publishWorkflowPath, 'utf8');

    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('GITHUB_REF_TYPE');
    expect(workflow).toContain('GITHUB_REF_NAME');
    expect(workflow).toContain('git fetch --no-tags origin main');
    expect(workflow).toContain('git merge-base --is-ancestor "${GITHUB_SHA}" "origin/main"');
  });
});
