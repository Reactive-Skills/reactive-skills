import { executeSyncEngineCommand } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderOutput } from '../toon.js';

export interface SyncCommandResponse {
  output: string;
  exitCode: number;
}

export async function syncCommand(args: string[]): Promise<SyncCommandResponse> {
  const hasPositionalSkill = Boolean(args[0] && !args[0].startsWith('-'));
  const hasSkillFlag = args.includes('--skill');

  if (hasPositionalSkill && hasSkillFlag) {
    throw new AxiError(
      'Cannot combine a positional skill name with --skill',
      'VALIDATION_ERROR',
      [
        'Usage: reactive-skills-axi sync [skill-name] [--link|--copy] [--dry-run]',
        'Usage: reactive-skills-axi sync --skill <name> [--skill <name> ...] [--link|--copy] [--dry-run]',
        'Example: reactive-skills-axi sync --skill synthesis --skill onboarding-map',
      ],
    );
  }

  const processedArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--skill') {
      processedArgs.push(arg);
      if (i + 1 < args.length) {
        processedArgs.push(args[++i]);
      }
    } else if (hasPositionalSkill && i === 0) {
      processedArgs.push('--skill', arg);
    } else {
      processedArgs.push(arg);
    }
  }

  // Zero-drift NTFS junctions / POSIX symlinks are the standard default unless --copy is requested
  if (!processedArgs.includes('--copy') && !processedArgs.includes('--link')) {
    processedArgs.push('--link');
  }

  try {
    return await executeSyncEngineCommand(processedArgs);
  } catch (err: any) {
    const error = new AxiError(
      err.message || 'Sync failed',
      'RUNTIME_ERROR',
      [
        'Usage: reactive-skills-axi sync [skill-name] [--link|--copy] [--dry-run]',
        'Usage: reactive-skills-axi sync --skill <name> [--skill <name> ...] [--link|--copy] [--dry-run]',
        'Example: reactive-skills-axi sync synthesis',
        'Example: reactive-skills-axi sync --skill synthesis --skill onboarding-map',
        'Example: reactive-skills-axi sync --dry-run',
      ]
    );
    return {
      output: renderOutput([renderError(error.message, error.code, error.suggestions)]),
      exitCode: 1,
    };
  }
}
