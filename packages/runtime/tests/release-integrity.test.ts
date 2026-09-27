import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const publishWorkflowPath = path.join(repositoryRoot, '.github', 'workflows', 'publish.yml');

describe('Release integrity workflow', () => {
  it('validates the exact package version before publishing a tag from main', () => {
    const workflow = fs.readFileSync(publishWorkflowPath, 'utf8');

    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('GITHUB_REF_TYPE');
    expect(workflow).toContain('RELEASE_TAG: ${{ github.ref_name }}');
    expect(workflow).toContain('node scripts/verify-release-tag.js');
    expect(workflow).toContain('gh release create "$RELEASE_TAG"');
    expect(workflow).not.toContain('gh release create ${{ github.ref_name }}');
    expect(workflow).toContain('pull-requests: read');
    expect(workflow).toContain('GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}');
    expect(workflow).toContain('gh api --paginate --slurp');
    expect(workflow).toContain('node scripts/verify-merged-release-pr.js "${GITHUB_SHA}"');
    expect(workflow).toContain('git fetch --no-tags origin main');
    expect(workflow).toContain('git merge-base --is-ancestor "${GITHUB_SHA}" "origin/main"');
    expect(workflow).not.toMatch(/^\s*workflow_dispatch\s*:/m);
    expect(workflow.indexOf('- name: Run verification tests')).toBeLessThan(
      workflow.indexOf('NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}'),
    );
  });
});
