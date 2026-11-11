import { describe, expect, it } from 'vitest';
import { workspaceLabels } from '@/features/telemetry/workspaceLabels';

describe('workspaceLabels', () => {
  it('uses the plain folder name when it is unique', () => {
    const labels = workspaceLabels(['/home/dev/alpha', '/home/dev/beta']);
    expect(labels.get('/home/dev/alpha')).toBe('alpha');
    expect(labels.get('/home/dev/beta')).toBe('beta');
  });

  it('adds parent folders only until two same-named workspaces differ', () => {
    const labels = workspaceLabels(['/home/dev/a/app', '/mnt/c/Users/x/app', '/home/dev/other']);
    expect(labels.get('/home/dev/a/app')).toBe('a/app');
    expect(labels.get('/mnt/c/Users/x/app')).toBe('x/app');
    expect(labels.get('/home/dev/other')).toBe('other');
  });

  it('keeps going past a shared parent and falls back to the full path when one root ends another', () => {
    const labels = workspaceLabels(['/work/client/app', '/archive/client/app', '/app', '/x/app']);
    expect(labels.get('/work/client/app')).toBe('work/client/app');
    expect(labels.get('/archive/client/app')).toBe('archive/client/app');
    expect(labels.get('/app')).toBe('/app');
    expect(labels.get('/x/app')).toBe('x/app');
  });

  it('handles Windows separators, trailing separators, repeats and missing roots', () => {
    const labels = workspaceLabels(['C:\\proj\\app\\', 'D:\\other\\app', 'D:\\other\\app', undefined, '']);
    expect(labels.get('C:\\proj\\app\\')).toBe('proj/app');
    expect(labels.get('D:\\other\\app')).toBe('other/app');
    expect(labels.size).toBe(2);
  });

  it('falls back to the full root when every suffix is shared', () => {
    const labels = workspaceLabels(['C:\\Users\\a\\app', 'D:\\Users\\a\\app']);
    expect(labels.get('C:\\Users\\a\\app')).toBe('C:\\Users\\a\\app');
  });
});
