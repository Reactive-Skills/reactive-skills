/**
 * Utility to extract --job <id> or --job=<id> from CLI arguments
 */
export function extractJobFlag(args: string[]): { jobId?: string; filteredArgs: string[] } {
  const filteredArgs: string[] = [];
  let jobId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--job' || arg === '-j') {
      jobId = args[++i];
    } else if (arg.startsWith('--job=')) {
      jobId = arg.slice(6);
    } else {
      filteredArgs.push(arg);
    }
  }

  return { jobId, filteredArgs };
}

import path from 'node:path';

/**
 * Resolves project workspace root given a skill directory path.
 * If skill is inside a `skills/` subfolder, returns the parent of `skills/`.
 */
export function resolveWorkspaceDir(skillPath: string): string {
  const parent = path.dirname(skillPath);
  if (path.basename(parent) === 'skills') {
    return path.dirname(parent);
  }
  return parent;
}

