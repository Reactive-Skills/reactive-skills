import { describe, it, expect, vi } from 'vitest';
import { syncCommand } from '../../src/commands/sync.js';

vi.mock('@reactive-skills/runtime', () => ({
  syncEngineCommand: vi.fn(async (args: string[]) => `SYNCED: ${args.join(' ')}`),
}));

describe('syncCommand', () => {
  it('maps positional skill name to --skill and defaults to --link', async () => {
    const output = await syncCommand(['my-skill']);
    expect(output).toContain('SYNCED:');
    expect(output).toContain('--skill my-skill');
    expect(output).toContain('--link');
  });

  it('respects --copy flag instead of --link', async () => {
    const output = await syncCommand(['my-skill', '--copy']);
    expect(output).toContain('SYNCED:');
    expect(output).toContain('--skill my-skill');
    expect(output).toContain('--copy');
    expect(output).not.toContain('--link');
  });

  it('handles dry-run flag without positional skill', async () => {
    const output = await syncCommand(['--dry-run']);
    expect(output).toContain('SYNCED:');
    expect(output).toContain('--dry-run');
    expect(output).toContain('--link');
  });
});
