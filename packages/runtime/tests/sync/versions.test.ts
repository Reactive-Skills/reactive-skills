import { describe, expect, it } from 'vitest';
import { compareSemVer, compareSkillVersions, parseSemVer } from '../../src/sync/versions.js';

function order(a: string, b: string): number {
  return Math.sign(compareSemVer(parseSemVer(a)!, parseSemVer(b)!));
}

describe('SemVer comparison for skill versions', () => {
  it('accepts SemVer 2.0.0 strings and rejects everything else', () => {
    expect(parseSemVer('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
    expect(parseSemVer('1.2.3-rc.1+build.5')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: ['rc', '1'] });
    for (const bad of ['1.0', '1', 'v1.2.3', '01.2.3', '1.2.3-', '1.2.3-01', 'latest', '', 1.2, undefined, null]) {
      expect(parseSemVer(bad)).toBeUndefined();
    }
  });

  it('orders versions numerically, not lexically', () => {
    expect(order('1.10.0', '1.9.0')).toBe(1);
    expect(order('2.0.0', '10.0.0')).toBe(-1);
    expect(order('1.2.3', '1.2.3')).toBe(0);
    expect(order('1.2.3+a', '1.2.3+b')).toBe(0);
  });

  it('orders prereleases by the SemVer precedence rules', () => {
    const ascending = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0'];
    for (let i = 0; i < ascending.length - 1; i++) {
      expect(order(ascending[i], ascending[i + 1])).toBe(-1);
      expect(order(ascending[i + 1], ascending[i])).toBe(1);
    }
  });

  it('classifies a replacement as upgrade, same, downgrade or unknown', () => {
    expect(compareSkillVersions('1.0.0', '1.1.0')).toEqual({ kind: 'upgrade' });
    expect(compareSkillVersions('1.0.0', '1.0.0')).toEqual({ kind: 'same' });
    expect(compareSkillVersions('2.0.0', '1.9.9')).toEqual({ kind: 'downgrade', installed: '2.0.0', incoming: '1.9.9' });
    expect(compareSkillVersions(undefined, '1.0.0')).toEqual({ kind: 'unknown', installed: undefined, incoming: '1.0.0' });
    expect(compareSkillVersions('1.0.0', 'banana')).toEqual({ kind: 'unknown', installed: '1.0.0', incoming: 'banana' });
  });
});
