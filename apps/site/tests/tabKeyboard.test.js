import { describe, expect, it } from 'vitest';
import { getTabIndexForKey } from '@/lib/a11y/tabKeyboard';

describe('getTabIndexForKey', () => {
  it('moves right and left with wraparound', () => {
    expect(getTabIndexForKey('ArrowRight', 0, 2)).toBe(1);
    expect(getTabIndexForKey('ArrowRight', 1, 2)).toBe(0);
    expect(getTabIndexForKey('ArrowLeft', 0, 2)).toBe(1);
    expect(getTabIndexForKey('ArrowLeft', 1, 2)).toBe(0);
  });

  it('jumps to the first and last tab with Home and End', () => {
    expect(getTabIndexForKey('Home', 2, 3)).toBe(0);
    expect(getTabIndexForKey('End', 0, 3)).toBe(2);
  });

  it('ignores other keys and empty tab lists', () => {
    expect(getTabIndexForKey('Tab', 0, 2)).toBeNull();
    expect(getTabIndexForKey('ArrowDown', 0, 2)).toBeNull();
    expect(getTabIndexForKey('ArrowRight', 0, 0)).toBeNull();
  });
});
