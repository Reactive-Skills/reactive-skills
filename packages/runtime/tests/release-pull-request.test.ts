import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const verifierPath = path.join(repositoryRoot, 'scripts', 'verify-merged-release-pr.js');
const targetSha = '0123456789abcdef0123456789abcdef01234567';

function verifyPullRequests(pages: unknown, sha = targetSha) {
  return spawnSync(process.execPath, [verifierPath, sha], {
    input: JSON.stringify(pages),
    encoding: 'utf8',
  });
}

describe('merged release pull request gate', () => {
  it('accepts the tagged merge commit of a merged pull request into main', () => {
    const result = verifyPullRequests([[
      {
        number: 42,
        merged_at: '2026-09-27T12:00:00Z',
        merge_commit_sha: targetSha,
        base: { ref: 'main' },
      },
    ]]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Verified merged pull request #42 into main.');
  });

  it.each([
    { number: 42, merged_at: null, merge_commit_sha: targetSha, base: { ref: 'main' } },
    { number: 42, merged_at: '2026-09-27T12:00:00Z', merge_commit_sha: targetSha, base: { ref: 'release' } },
    { number: 42, merged_at: '2026-09-27T12:00:00Z', merge_commit_sha: 'fedcba9876543210fedcba9876543210fedcba98', base: { ref: 'main' } },
  ])('rejects a pull request that does not match every publish condition', (pullRequest) => {
    const result = verifyPullRequests([[pullRequest]]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('not the merge commit of a merged pull request into main');
    expect(result.stdout).not.toContain('Verified');
  });

  it('rejects empty or malformed API data and invalid commit SHAs', () => {
    expect(verifyPullRequests([[]]).status).not.toBe(0);
    expect(verifyPullRequests({}).stderr).toContain('unexpected shape');
    expect(verifyPullRequests([[]], 'not-a-sha').stderr).toContain('expected the full tagged commit SHA');
  });
});
