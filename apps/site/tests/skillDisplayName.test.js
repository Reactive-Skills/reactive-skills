import { describe, expect, it } from 'vitest';
import { skillDisplayName } from '@/lib/registry/skillDisplayName';

describe('skillDisplayName', () => {
  it.each([
    ['jsm-workflow', 'JSM Workflow'],
    ['api-contract', 'API Contract'],
    ['ci-cd-automation', 'CI/CD Automation'],
    ['pep8-review', 'PEP 8 Review'],
    ['pr-triage', 'PR Triage'],
    ['tdd-refactor', 'TDD Refactor'],
    ['skill-manager', 'Skill Manager'],
    ['research-design-planner', 'Research Design Planner'],
  ])('formats %s as %s', (slug, expected) => {
    expect(skillDisplayName(slug)).toBe(expected);
  });

  it('ignores empty segments', () => {
    expect(skillDisplayName('pr--triage')).toBe('PR Triage');
  });
});
