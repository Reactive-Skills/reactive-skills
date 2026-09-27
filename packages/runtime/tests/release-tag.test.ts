import { describe, expect, it } from 'vitest';
import { validateReleaseTag } from '../../../scripts/verify-release-tag.js';

const packages = [
  { path: 'package.json', version: '0.14.0' },
  { path: 'packages/runtime/package.json', version: '0.14.0' },
  { path: 'apps/axi/package.json', version: '0.14.0' },
  { path: 'apps/site/package.json', version: '0.14.0' },
];

describe('release tag validation', () => {
  it('accepts an exact stable SemVer tag matching every workspace package', () => {
    expect(validateReleaseTag('v0.14.0', packages)).toBe('0.14.0');
  });

  it.each([
    '0.14.0',
    'v0.14',
    'v01.14.0',
    'v0.14.00',
    'v0.14.0-rc.1',
    'v0.14.0$(whoami)',
    'v0.14.0;echo unsafe',
  ])('rejects malformed tag %s', (tag) => {
    expect(() => validateReleaseTag(tag, packages)).toThrow(/expected vMAJOR\.MINOR\.PATCH/);
  });

  it('rejects a valid tag that differs from any workspace package version', () => {
    const driftedPackages = packages.map((entry) =>
      entry.path === 'apps/site/package.json' ? { ...entry, version: '0.13.1' } : entry,
    );

    expect(() => validateReleaseTag('v0.14.0', driftedPackages)).toThrow(/apps\/site\/package\.json/);
  });

  it('requires all four workspace package manifests for validation', () => {
    expect(() => validateReleaseTag('v0.14.0', packages.slice(0, 3))).toThrow(/root, runtime, AXI, and site/);
  });
});
