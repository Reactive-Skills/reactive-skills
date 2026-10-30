import { NEXT_STEP, runCheck } from './lib.mjs';

export default function checksGreen(ctx) {
  for (const kind of ['test', 'lint']) {
    const { exitCode } = runCheck(ctx, kind);
    if (exitCode !== 0) return { passed: false, reason: `npm ${kind === 'test' ? 'test' : 'run lint'} exits ${exitCode}. Next: ${NEXT_STEP.PATCH}.` };
  }
  return { passed: true };
}
