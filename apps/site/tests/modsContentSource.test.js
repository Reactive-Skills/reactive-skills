import { describe, expect, it } from 'vitest';
import { InMemoryModsContentSource } from '@/infrastructure/InMemoryModsContentSource';
import { mods } from '@/infrastructure/content/mods';

describe('InMemoryModsContentSource', () => {
  const source = new InMemoryModsContentSource();

  it('lists every mod', () => {
    expect(source.listMods().map((m) => m.slug)).toEqual(mods.map((m) => m.slug));
  });

  it('finds a mod by slug and returns null for an unknown one', () => {
    expect(source.getMod('bq-vitals')?.name).toBe('bq-vitals');
    expect(source.getMod('nope')).toBeNull();
  });

  it('gives every mod an install command for the Reactive-Skills marketplace', () => {
    for (const mod of source.listMods()) {
      expect(mod.installCmd).toBe(`/plugin install ${mod.slug} --marketplace Reactive-Skills/reactive-skills`);
      expect(mod.features.length).toBeGreaterThan(0);
    }
  });

  it('does not hand out the stored object', () => {
    const first = source.getMod('bq-vitals');
    first.name = 'changed';
    expect(source.getMod('bq-vitals').name).toBe('bq-vitals');
  });
});
