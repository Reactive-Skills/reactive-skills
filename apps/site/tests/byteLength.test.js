import { describe, expect, it } from 'vitest';
import { normalizedByteLength } from '@/lib/registry/byteLength';

describe('normalizedByteLength', () => {
  it('counts CRLF and LF text the same', () => {
    expect(normalizedByteLength('a\r\nb\r\n')).toBe(normalizedByteLength('a\nb\n'));
    expect(normalizedByteLength('a\nb\n')).toBe(4);
  });

  it('counts UTF-8 bytes, not characters', () => {
    expect(normalizedByteLength('✓')).toBe(3);
  });
});
