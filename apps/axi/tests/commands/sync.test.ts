import { describe, it, expect, vi } from 'vitest';
import { syncCommand } from '../../src/commands/sync.js';
import { executeSyncEngineCommand } from '@reactive-skills/runtime';

vi.mock('@reactive-skills/runtime', () => ({
  executeSyncEngineCommand: vi.fn(async (args: string[]) => ({
    output: `SYNCED: ${args.join(' ')}`,
    exitCode: 0,
  })),
}));

describe('syncCommand', () => {
  it('maps positional skill name to --skill and defaults to --link', async () => {
    const { output, exitCode } = await syncCommand(['my-skill']);
    expect(exitCode).toBe(0);
    expect(output).toContain('SYNCED:');
    expect(output).toContain('--skill my-skill');
    expect(output).toContain('--link');
  });

  it('respects --copy flag instead of --link', async () => {
    const { output } = await syncCommand(['my-skill', '--copy']);
    expect(output).toContain('SYNCED:');
    expect(output).toContain('--skill my-skill');
    expect(output).toContain('--copy');
    expect(output).not.toContain('--link');
  });

  it('handles dry-run flag without positional skill', async () => {
    const { output } = await syncCommand(['--dry-run']);
    expect(output).toContain('SYNCED:');
    expect(output).toContain('--dry-run');
    expect(output).toContain('--link');
  });

  it('passes repeated --skill flags through to the runtime', async () => {
    const { output } = await syncCommand(['--skill', 'alpha', '--skill', 'beta']);
    expect(output).toContain('SYNCED: --skill alpha --skill beta --link');
  });

  it('preserves output and nonzero status for rejected selections', async () => {
    vi.mocked(executeSyncEngineCommand).mockResolvedValueOnce({
      output: '{"errors":["Unknown skill: missing"]}',
      exitCode: 1,
    });

    const result = await syncCommand(['--skill', 'missing', '--json']);

    expect(result).toEqual({
      output: '{"errors":["Unknown skill: missing"]}',
      exitCode: 1,
    });
  });

  it('rejects a positional skill selector mixed with --skill flags', async () => {
    vi.mocked(executeSyncEngineCommand).mockClear();

    const command = syncCommand(['legacy-skill', '--skill', 'new-skill']);

    await expect(command).rejects.toMatchObject({
      message: expect.stringContaining('Cannot combine a positional skill name with --skill'),
      code: 'VALIDATION_ERROR',
    });
    expect(executeSyncEngineCommand).not.toHaveBeenCalled();
  });
});
