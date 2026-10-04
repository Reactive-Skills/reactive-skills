import { describe, expect, it } from 'vitest';
import { getAdjacentPosts } from '@/lib/blog/adjacentPosts';

const newestFirst = [
  { slug: 'part-2', publishedAt: '2026-03-22' },
  { slug: 'part-1', publishedAt: '2026-03-20' },
];

describe('getAdjacentPosts', () => {
  it('treats older posts as previous and newer posts as next', () => {
    expect(getAdjacentPosts(newestFirst, 'part-1')).toEqual({ prevPost: null, nextPost: newestFirst[0] });
    expect(getAdjacentPosts(newestFirst, 'part-2')).toEqual({ prevPost: newestFirst[1], nextPost: null });
  });

  it('orders same-date posts by slug', () => {
    const sameDay = [
      { slug: 'b', publishedAt: '2026-04-01' },
      { slug: 'a', publishedAt: '2026-04-01' },
    ];
    expect(getAdjacentPosts(sameDay, 'a').nextPost.slug).toBe('b');
    expect(getAdjacentPosts(sameDay, 'b').prevPost.slug).toBe('a');
  });

  it('returns nulls for an unknown slug', () => {
    expect(getAdjacentPosts(newestFirst, 'missing')).toEqual({ prevPost: null, nextPost: null });
  });
});
