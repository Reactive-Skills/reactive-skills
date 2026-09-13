import { describe, it, expect } from 'vitest';
import { renderList, renderDetail, renderHelp, renderError, renderOutput, formatRelativeTime, truncate } from '../src/toon.js';

describe('renderList', () => {
  it('produces tabular TOON output', () => {
    const result = renderList('items', [{ name: 'a', count: 1 }, { name: 'b', count: 2 }], [
      { type: 'field', key: 'name' },
      { type: 'field', key: 'count' },
    ]);
    expect(result).toContain('items[2]{name,count}:');
    expect(result).toContain('name,count');
    expect(result).toContain('a');
    expect(result).toContain('b');
  });
});

describe('renderDetail', () => {
  it('produces detail TOON output', () => {
    const result = renderDetail('skill', { name: 'test', version: '1.0' }, [
      { type: 'field', key: 'name' },
      { type: 'field', key: 'version' },
    ]);
    expect(result).toContain('skill:');
    expect(result).toContain('name:');
    expect(result).toContain('test');
    expect(result).toContain('version:');
    expect(result).toContain('1.0');
  });
});

describe('renderHelp', () => {
  it('formats help suggestions correctly', () => {
    const result = renderHelp(['First suggestion', 'Second suggestion']);
    expect(result).toContain('help[2]:');
    expect(result).toContain('First suggestion');
    expect(result).toContain('  Second suggestion');
  });

  it('returns empty string for empty array', () => {
    expect(renderHelp([])).toBe('');
  });
});

describe('renderError', () => {
  it('formats error with code and suggestions', () => {
    const result = renderError('Something failed', 'FAIL_CODE', ['Fix this', 'Try that']);
    expect(result).toContain('error: Something failed');
    expect(result).toContain('code: FAIL_CODE');
    expect(result).toContain('help[2]:');
    expect(result).toContain('  Fix this');
  });
});

describe('renderOutput', () => {
  it('filters falsy blocks', () => {
    const result = renderOutput(['ok', undefined, null, false, 'more']);
    expect(result).toBe('ok\nmore');
  });
});

describe('formatRelativeTime', () => {
  it('returns just now for recent dates', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });
});

describe('truncate', () => {
  it('adds truncation notice when text exceeds maxLen', () => {
    const text = 'a'.repeat(100);
    const result = truncate(text, 50);
    expect(result).toContain('truncated, 100 chars total');
    expect(result).toContain('use --full to see complete text');
  });

  it('returns original text when under maxLen', () => {
    expect(truncate('hello', 50)).toBe('hello');
  });
});
