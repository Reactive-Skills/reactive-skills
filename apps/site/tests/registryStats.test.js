import { describe, expect, it } from 'vitest';
import { computeRegistryStats, formatStepShare } from '@/lib/registry/registryStats';

const skill = (stateCount, instructionBytes) => ({ stateCount, instructionBytes });

describe('computeRegistryStats', () => {
  it('takes the median of one state versus SKILL.md plus all states', () => {
    const stats = computeRegistryStats([
      skill(2, { skillDocBytes: 100, stateBytes: [50, 50] }),
      skill(2, { skillDocBytes: 0, stateBytes: [10, 30] }),
      skill(1, { skillDocBytes: 200, stateBytes: [100] }),
    ]);
    expect(stats.skillCount).toBe(3);
    expect(stats.stateCount).toBe(5);
    expect(stats.measuredSkillCount).toBe(3);
    expect(stats.medianStepShare).toBeCloseTo(1 / 3, 5);
  });

  it('averages the middle pair for an even count', () => {
    const stats = computeRegistryStats([
      skill(2, { skillDocBytes: 100, stateBytes: [50, 50] }),
      skill(2, { skillDocBytes: 0, stateBytes: [10, 30] }),
      skill(1, { skillDocBytes: 200, stateBytes: [100] }),
      skill(4, { skillDocBytes: 0, stateBytes: [25, 25, 25, 25] }),
    ]);
    expect(stats.medianStepShare).toBeCloseTo((0.25 + 1 / 3) / 2, 5);
  });

  it('returns null when no skill carries measurements', () => {
    const stats = computeRegistryStats([skill(3, undefined), skill(2, { skillDocBytes: 10, stateBytes: [] })]);
    expect(stats.stateCount).toBe(5);
    expect(stats.measuredSkillCount).toBe(0);
    expect(stats.medianStepShare).toBeNull();
  });
});

describe('formatStepShare', () => {
  it('rounds to a whole percent', () => {
    expect(formatStepShare(0.079)).toBe('~8%');
  });

  it('never renders zero', () => {
    expect(formatStepShare(0.001)).toBe('~1%');
  });
});
