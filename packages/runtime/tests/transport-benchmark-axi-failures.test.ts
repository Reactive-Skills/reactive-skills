import { beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { measureAxi } from '../scripts/transport-benchmark/axi.js';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));
const spawn = vi.mocked(spawnSync);
const output = (status: number | null, stdout: string, error?: Error) =>
  ({ status, stdout, stderr: 'stderr', error, pid: 1, output: [], signal: null }) as unknown as ReturnType<typeof spawnSync>;

describe('transport benchmark AXI failure paths', () => {
  beforeEach(() => spawn.mockReset());

  it('rejects a spawn error and a non-zero exit', () => {
    spawn.mockReturnValueOnce(output(null, '', new Error('spawn ENOENT')));
    expect(() => measureAxi('/workspace')).toThrow('spawn ENOENT');
    spawn.mockReturnValueOnce(output(2, ''));
    expect(() => measureAxi('/workspace')).toThrow('AXI process failed: 2: stderr');
  });

  it('rejects an error reply on a success row', () => {
    spawn.mockReturnValueOnce(output(0, 'error: skill not found\n'));
    expect(() => measureAxi('/workspace')).toThrow('AXI command failed');
  });

  it('rejects a missing-skill row that does not report an error', () => {
    spawn.mockReturnValue(output(0, 'state: INIT\n'));
    expect(() => measureAxi('/workspace')).toThrow('AXI missing-skill path did not fail');
    expect(spawn).toHaveBeenCalledTimes(9);
  });
});
