import { describe, expect, it } from 'vitest';
import {
  createReactiveBootloaderReference,
  ensureReactiveBootloaderReference,
  getReactiveBootloader,
} from '../src/core/bootloader.js';

describe('central reactive bootloader', () => {
  it('returns versioned runtime instructions for a skill', () => {
    const payload = getReactiveBootloader('example-skill');

    expect(payload.skill).toBe('example-skill');
    expect(payload.bootloader_version).toBe('1.0.0');
    expect(payload.instructions).toContain('reactive_context_prepare');
    expect(payload.instructions).toContain('[{"id":"...","skill":"...","summary":"..."}]');
  });

  it('replaces copied bootloader blocks with the stable runtime reference', () => {
    const legacy = `---\nname: example-skill\n---\n\n<!-- REACTIVE BOOTLOADER -->\nold instructions\n<!-- END REACTIVE BOOTLOADER -->\n\n# Skill`;
    const updated = ensureReactiveBootloaderReference(legacy, 'example-skill');

    expect(updated).toContain(createReactiveBootloaderReference('example-skill'));
    expect(updated).not.toContain('old instructions');
    expect(updated).toContain('# Skill');
  });
});
