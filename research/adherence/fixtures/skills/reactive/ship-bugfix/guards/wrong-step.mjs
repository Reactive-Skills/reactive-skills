import { NEXT_STEP, leaf } from './lib.mjs';

/** Refuses a signal that belongs to another step and names the step that comes next. */
export default function wrongStep(ctx) {
  const state = leaf(ctx.currentState);
  return {
    passed: false,
    reason: `${ctx.event.payload?.signal ?? 'This signal'} is out of order: the run is in ${state}. Next: ${NEXT_STEP[state]}.`,
  };
}
