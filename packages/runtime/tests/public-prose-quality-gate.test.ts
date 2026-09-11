import { describe, expect, it } from 'vitest';
import { assessTextQuality } from '../scripts/prose-quality-gate.js';

describe('public prose quality gate', () => {
  it('accepts concise technical writing', () => {
    const result = assessTextQuality(
      'Reactive Skills turns passive instruction files into observable workflows. Each state owns a bounded prompt slice and an explicit transition path.'
    );

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects filler-heavy AI prose', () => {
    const result = assessTextQuality(
      'In today\'s fast-paced landscape, we are going to leverage this robust opportunity to ensure we deliver a best-in-class experience in a way that is definitely transparent and highly scalable.'
    );

    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
