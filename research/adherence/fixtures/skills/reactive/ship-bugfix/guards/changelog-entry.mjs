import { NEXT_STEP, read } from './lib.mjs';

export default function changelogEntry(ctx) {
  const changelog = read(ctx, 'CHANGELOG.md') ?? '';
  const unreleased = changelog.split(/\n## (?!#)/)[1] ?? '';
  if (!unreleased.startsWith('Unreleased')) return { passed: false, reason: `CHANGELOG.md has no "## Unreleased" section. Next: ${NEXT_STEP.RELEASE_NOTE}.` };
  if (!/### Fixed/.test(unreleased) || !/#\d+/.test(unreleased)) {
    return { passed: false, reason: `No "### Fixed" bullet with an issue number under Unreleased. Next: ${NEXT_STEP.RELEASE_NOTE}.` };
  }
  return { passed: true };
}
