import { NEXT_STEP, baseline, digest, runCheck } from './lib.mjs';

export default function reproFailing(ctx) {
  const base = baseline(ctx);
  if (digest(ctx, 'src/cart.ts') !== base['src/cart.ts']) {
    return { passed: false, reason: `src/cart.ts changed before a failing regression test was seen. Undo the source change first. Next: ${NEXT_STEP.REPRO}.` };
  }
  if (digest(ctx, 'tests/cart.test.ts') === base['tests/cart.test.ts']) {
    return { passed: false, reason: `tests/cart.test.ts has no new test. Next: ${NEXT_STEP.REPRO}.` };
  }
  const { exitCode } = runCheck(ctx, 'test');
  if (exitCode === 0) {
    return { passed: false, reason: `npm test passes, so the new test does not reproduce the issue. Next: ${NEXT_STEP.REPRO}.` };
  }
  return { passed: true };
}
