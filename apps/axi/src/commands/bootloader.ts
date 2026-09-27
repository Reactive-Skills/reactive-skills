import { getReactiveBootloader } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderDetail, renderError, renderHelp, renderOutput } from '../toon.js';

export async function bootloaderCommand(args: string[] = []): Promise<string> {
  const skillName = args.find((arg) => !arg.startsWith('--'));

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi bootloader <skill-name> [--json]']
    );
    return renderOutput([renderError(error.message, error.code, error.suggestions)]);
  }

  try {
    const payload = getReactiveBootloader(skillName);
    if (args.includes('--json')) return JSON.stringify(payload, null, 2);

    return renderOutput([
      renderDetail('bootloader', payload, [
        { type: 'field', key: 'skill' },
        { type: 'field', key: 'runtime_version' },
        { type: 'field', key: 'bootloader_version' },
      ]),
      payload.instructions,
      renderHelp(['Use this authoritative runtime contract before loading full reactive skill context']),
    ]);
  } catch (err) {
    const error = err instanceof AxiError
      ? err
      : new AxiError(
          err instanceof Error ? err.message : 'Failed to retrieve bootloader',
          'VALIDATION_ERROR',
          ['Use a skill name containing only letters, numbers, dots, underscores, or hyphens']
        );
    return renderOutput([renderError(error.message, error.code, error.suggestions)]);
  }
}
