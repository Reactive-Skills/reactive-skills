import { describe, expect, it } from 'vitest';
import { docPageList } from '@/infrastructure/content/docs';

const numberedHeadings = (page) =>
  (page.sections || [])
    .map((section) => section.heading?.match(/^(\d+)\.\s/))
    .filter(Boolean)
    .map((match) => Number(match[1]));

describe('docs numbered headings', () => {
  it.each(docPageList.map((page) => [page.slug, page]))('%s numbers steps 1..n', (_slug, page) => {
    const numbers = numberedHeadings(page);
    expect(numbers).toEqual(numbers.map((_, index) => index + 1));
  });
});
