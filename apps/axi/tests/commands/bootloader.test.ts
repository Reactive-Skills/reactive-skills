import { describe, expect, it } from 'vitest';
import { bootloaderCommand } from '../../src/commands/bootloader.js';

describe('bootloader command', () => {
  it('returns the authoritative bootloader as JSON', async () => {
    const result = JSON.parse(await bootloaderCommand(['example-skill', '--json']));

    expect(result.skill).toBe('example-skill');
    expect(result.bootloader_version).toBe('1.0.0');
    expect(result.instructions).toContain('reactive_context_prepare');
  });

  it('returns a validation error when the skill name is missing', async () => {
    const result = await bootloaderCommand(['--json']);

    expect(result).toContain('Missing skill name');
  });
});
