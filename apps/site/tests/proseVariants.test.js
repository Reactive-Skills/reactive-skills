import { describe, expect, it } from 'vitest';
import { getProseVariant, PROSE_VARIANTS } from '@/lib/docs/proseVariants';

describe('getProseVariant', () => {
  it('keeps docs body text at 15px muted', () => {
    expect(getProseVariant('docs').text).toBe('text-[15px] leading-7 text-phino-text-muted');
    expect(getProseVariant('docs').bullet).toBe('mt-2.5');
    expect(getProseVariant(undefined)).toBe(PROSE_VARIANTS.docs);
  });

  it('gives the blog larger, higher-contrast body text', () => {
    const { text } = getProseVariant('blog');
    expect(text).toContain('sm:text-[17px]');
    expect(text).toContain('text-phino-text/85');
    expect(text).not.toContain('text-phino-text-muted');
  });
});
