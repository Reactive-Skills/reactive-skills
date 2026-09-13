import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { homeCommand } from '../../src/commands/home.js';

describe('homeCommand', () => {
  let originalCwd: string;
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalCwd = process.cwd();
    originalArgv = process.argv;
    originalEnv = { ...process.env };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.argv = originalArgv;
    process.env = originalEnv as NodeJS.ProcessEnv;
  });

  it('returns a string', async () => {
    const result = await homeCommand();
    expect(typeof result).toBe('string');
  });

  it('contains bin: line', async () => {
    const result = await homeCommand();
    expect(result).toContain('bin:');
  });

  it('contains description: line', async () => {
    const result = await homeCommand();
    expect(result).toContain('description:');
  });

  it('contains count: line', async () => {
    const result = await homeCommand();
    expect(result).toContain('count:');
  });

  it('contains help[] suggestions', async () => {
    const result = await homeCommand();
    expect(result).toContain('help[');
  });
});
