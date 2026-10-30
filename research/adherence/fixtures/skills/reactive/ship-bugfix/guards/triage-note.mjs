import { NEXT_STEP, read } from './lib.mjs';

const SECTIONS = ['## Observed', '## Root cause', '## Affected file', '## Fix plan'];

export default function triageNote(ctx) {
  const note = read(ctx, '.work/triage.md');
  if (note === null) return { passed: false, reason: `.work/triage.md does not exist. Next: ${NEXT_STEP.TRIAGE}.` };
  const missing = SECTIONS.filter((section) => !note.includes(section));
  if (missing.length > 0) return { passed: false, reason: `.work/triage.md is missing ${missing.join(', ')}. Next: ${NEXT_STEP.TRIAGE}.` };
  return { passed: true };
}
