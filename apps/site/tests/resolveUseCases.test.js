import { describe, expect, it } from 'vitest';
import { resolveUseCases } from '@/lib/landing/resolveUseCases';
import { landingUseCases } from '@/infrastructure/content/landing/useCases';
import { registrySkills } from '@/infrastructure/content/registry/skills';

const skills = [{ slug: 'tdd-refactor', name: 'TDD Refactor', stateCount: 11 }];

describe('resolveUseCases', () => {
  it('joins copy with registry name and state count', () => {
    expect(resolveUseCases([{ slug: 'tdd-refactor', job: 'Refactoring', outcome: 'Text.' }], skills)).toEqual([
      { slug: 'tdd-refactor', job: 'Refactoring', outcome: 'Text.', name: 'TDD Refactor', stateCount: 11 },
    ]);
  });

  it('fails loudly when a slug is missing', () => {
    expect(() => resolveUseCases([{ slug: 'missing', job: 'J', outcome: 'O' }], skills)).toThrow(
      'Landing use case "missing" is not in the skill registry',
    );
  });

  it('resolves every homepage use case against the generated registry', () => {
    expect(resolveUseCases(landingUseCases, registrySkills)).toHaveLength(landingUseCases.length);
  });
});
