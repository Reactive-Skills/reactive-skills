import { syncEngineCommand } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderOutput } from '../toon.js';

export async function syncCommand(args: string[]): Promise<string> {
  const processedArgs: string[] = [];
  let skillSpecified = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--skill') {
      skillSpecified = true;
      processedArgs.push(arg);
      if (i + 1 < args.length) {
        processedArgs.push(args[++i]);
      }
    } else if (!arg.startsWith('-') && !skillSpecified && i === 0) {
      skillSpecified = true;
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
    const output = await syncEngineCommand(processedArgs);
    return output;
  } catch (err: any) {
    const error = new AxiError(
      err.message || 'Sync failed',
      'RUNTIME_ERROR',
      [
        'Usage: reactive-skills-axi sync [skill-name] [--link|--copy] [--dry-run]',
        'Example: reactive-skills-axi sync synthesis',
        'Example: reactive-skills-axi sync --dry-run',
      ]
    );
    return renderOutput([renderError(error.message, error.code, error.suggestions)]);
  }
}
