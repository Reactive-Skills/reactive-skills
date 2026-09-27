import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('handlebars', () => ({}));
vi.mock('@reactive-skills/runtime', () => ({}));

vi.mock('../src/commands/home.js', () => ({
  homeCommand: vi.fn().mockResolvedValue('home output'),
}));
vi.mock('../src/commands/init.js', () => ({
  initCommand: vi.fn().mockResolvedValue('init output'),
}));
vi.mock('../src/commands/upgrade.js', () => ({
  upgradeCommand: vi.fn().mockResolvedValue('upgrade output'),
}));
vi.mock('../src/commands/inspect.js', () => ({
  inspectCommand: vi.fn().mockResolvedValue('inspect output'),
}));
vi.mock('../src/commands/events.js', () => ({
  eventsCommand: vi.fn().mockResolvedValue('events output'),
}));
vi.mock('../src/commands/setup.js', () => ({
  setupCommand: vi.fn().mockResolvedValue('setup output'),
}));
vi.mock('../src/commands/sync.js', () => ({
  syncCommand: vi.fn().mockResolvedValue({ output: 'sync output', exitCode: 0 }),
}));
vi.mock('../src/commands/dashboard.js', () => ({
  dashboardCommand: vi.fn().mockResolvedValue('dashboard output'),
}));

import { main } from '../src/cli/index.js';
import { syncCommand } from '../src/commands/sync.js';

describe('CLI entry point', () => {
  let originalArgv: string[];
  let exitSpy: ReturnType<typeof vi.spyOn<[number?], void>>;
  let stdoutSpy: ReturnType<typeof vi.spyOn<[string?], boolean>>;
  let stderrSpy: ReturnType<typeof vi.spyOn<[string?], boolean>>;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    originalArgv = process.argv;
    originalExitCode = process.exitCode;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    exitSpy.mockRestore();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('does not error with no args (dashboard)', async () => {
    process.argv = ['node', 'reactive-skills-axi'];
    await main();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('does not error with --help', async () => {
    process.argv = ['node', 'reactive-skills-axi', '--help'];
    await main();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('does not error with help', async () => {
    process.argv = ['node', 'reactive-skills-axi', 'help'];
    await main();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('prints the package version before command dispatch', async () => {
    process.argv = ['node', 'reactive-skills-axi', '--version'];
    await main();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d+\.\d+\.\d+\n$/));
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('dispatches setup command without error', async () => {
    process.argv = ['node', 'reactive-skills-axi', 'setup'];
    await main();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith('setup output\n');
  });

  it('dispatches dashboard command without error', async () => {
    process.argv = ['node', 'reactive-skills-axi', 'dashboard', '--port', '0'];
    await main();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalledWith('dashboard output\n');
  });

  it('exits nonzero when sync rejects a mixed selector', async () => {
    vi.mocked(syncCommand).mockRejectedValueOnce(new Error('Cannot combine a positional skill name with --skill'));
    process.argv = ['node', 'reactive-skills-axi', 'sync', 'legacy-skill', '--skill', 'new-skill'];

    await main();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot combine a positional skill name with --skill'));
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('prints a rejected sync report and sets a nonzero exit status', async () => {
    vi.mocked(syncCommand).mockResolvedValueOnce({
      output: '{"errors":["Unknown skill: missing"]}',
      exitCode: 1,
    });
    process.argv = ['node', 'reactive-skills-axi', 'sync', '--skill', 'missing', '--json'];

    await main();

    expect(process.exitCode).toBe(1);
    expect(stdoutSpy).toHaveBeenCalledWith('{"errors":["Unknown skill: missing"]}\n');
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('fails with exit code 2 on unknown command', async () => {
    process.argv = ['node', 'reactive-skills-axi', 'unknown'];
    await main();
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(stderrSpy).toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});

