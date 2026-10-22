import { describe, expect, it } from 'vitest';
import {
  buildRegistryLog,
  buildRunTape,
  describeChecks,
  sortRegistryLog,
} from '@/lib/landing/flightRecorder';
import { landingUseCases } from '@/infrastructure/content/landing/useCases';
import { registrySkills } from '@/infrastructure/content/registry/skills';

const skill = (slug, name, transitions, extra = {}) => ({
  slug,
  name,
  category: 'General',
  description: `${name} description`,
  stateCount: transitions.length,
  version: '1.0.0',
  states: [{ name: 'A', transitions }],
  ...extra,
});

describe('describeChecks', () => {
  it('labels exit-code, payload and signal-only skills', () => {
    expect(describeChecks(skill('a', 'A', [{ signal: 'X', target: 'B', guard: 'event.payload.exit_code === 0' }]))).toEqual({ kind: 'exit code', guardCount: 1 });
    expect(describeChecks(skill('b', 'B', [{ signal: 'X', target: 'B', guard: 'payload.ok' }]))).toEqual({ kind: 'payload guard', guardCount: 1 });
    expect(describeChecks(skill('c', 'C', [{ signal: 'X', target: 'B' }]))).toEqual({ kind: 'signal only', guardCount: 0 });
  });
});

describe('buildRegistryLog', () => {
  const skills = [skill('zeta', 'Zeta', []), skill('beta', 'Beta', []), skill('alpha', 'Alpha', [])];

  it('puts curated entries first with their outcome, then the rest alphabetically', () => {
    const rows = buildRegistryLog(skills, [{ slug: 'zeta', job: 'Releases', outcome: 'Ships notes.' }]);
    expect(rows.map((row) => row.slug)).toEqual(['zeta', 'alpha', 'beta']);
    expect(rows[0]).toMatchObject({ category: 'Releases', note: 'Ships notes.' });
    expect(rows[1]).toMatchObject({ category: 'General', note: 'Alpha description' });
  });

  it('fails loudly when a curated slug is missing', () => {
    expect(() => buildRegistryLog(skills, [{ slug: 'nope', job: 'X', outcome: 'Y' }])).toThrow(/nope/);
  });

  it('covers every published skill and every landing use case', () => {
    const rows = buildRegistryLog(registrySkills, landingUseCases);
    expect(rows).toHaveLength(registrySkills.length);
    expect(rows.slice(0, landingUseCases.length).map((row) => row.slug)).toEqual(landingUseCases.map((entry) => entry.slug));
  });
});

describe('sortRegistryLog', () => {
  const rows = [
    { name: 'B', order: 1, stateCount: 9, guardCount: 2 },
    { name: 'A', order: 0, stateCount: 9, guardCount: 0 },
    { name: 'C', order: 2, stateCount: 30, guardCount: 1 },
  ];

  it('sorts numbers and names in both directions with a name tiebreak', () => {
    expect(sortRegistryLog(rows, 'stateCount', 'desc').map((row) => row.name)).toEqual(['C', 'A', 'B']);
    expect(sortRegistryLog(rows, 'name', 'desc').map((row) => row.name)).toEqual(['C', 'B', 'A']);
    expect(sortRegistryLog(rows, 'order').map((row) => row.name)).toEqual(['A', 'B', 'C']);
  });

  it('rejects unknown keys', () => {
    expect(() => sortRegistryLog(rows, 'version')).toThrow(/version/);
  });
});

describe('buildRunTape', () => {
  it('reads the published tdd-refactor states and their exit checks', () => {
    const tdd = registrySkills.find((entry) => entry.slug === 'tdd-refactor');
    const tape = buildRunTape(tdd, ['RED_SPEC', 'GREEN_CODE', 'REFACTOR', 'AUDIT_VERIFY', 'COMPLETED']);
    expect(tape.map((step) => step.check)).toEqual([
      'exit_code != 0',
      'exit_code === 0',
      'signal AUDIT_PASSED',
      'exit_code === 0',
      'terminal',
    ]);
  });

  it('fails loudly when the states are not connected', () => {
    const tdd = registrySkills.find((entry) => entry.slug === 'tdd-refactor');
    expect(() => buildRunTape(tdd, ['RED_SPEC', 'COMPLETED'])).toThrow(/RED_SPEC to COMPLETED/);
  });
});
