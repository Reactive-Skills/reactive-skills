import { createStateView, renderStateView } from '@reactive-skills/runtime';
import type { FSMEngine, PromptSlice, StateViewOutcome } from '@reactive-skills/runtime';

/**
 * Extract negotiated state output before command-specific payload parsing.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms)
 * - Complexity: O(a), command argument count
 * - Cyclomatic Complexity (CC): target <= 8
 * - Branch Coverage: target >= 90%
 * - CRAP Score: target <= 10.0
 */
export function extractStateOutput(args: string[]): { output: 'legacy' | 'compact-v1'; args: string[] } {
  const filtered: string[] = [];
  let output: 'legacy' | 'compact-v1' = 'legacy';
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg !== '--output' && !arg.startsWith('--output=')) {
      filtered.push(arg);
      continue;
    }
    const value = arg === '--output' ? args[++index] : arg.slice('--output='.length);
    if (value !== 'legacy' && value !== 'compact-v1') throw new Error('State output must be legacy or compact-v1');
    output = value;
  }
  return { output, args: filtered };
}

/**
 * Render one complete view for invoke, state and signal continuation.
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms excluding existing slice generation)
 * - Complexity: O(b + h² + a), view bytes, hierarchy depth and approval records
 * - Cyclomatic Complexity (CC): target <= 8
 * - Branch Coverage: target >= 90%
 * - CRAP Score: target <= 10.0
 */
export function renderCompleteState(engine: FSMEngine, slice?: PromptSlice, outcome?: StateViewOutcome): string {
  return renderStateView(createStateView(engine, slice, outcome));
}
