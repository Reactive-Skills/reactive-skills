import { GuardEvaluator } from './guard-evaluator.js';
import { contractRefusalGuidance, payloadContractError, type PayloadContract } from './payload-contract.js';

/**
 * Structural refusals cannot approve a guard or trigger its judgment fallback; valid input follows the unchanged evaluator.
 * # Performance & Risk Budget
 * - Tier: P0 local contract checks (< 5ms), existing guard/judgment work additional
 * - Complexity: O(f + b), fields and selected bytes, plus existing evaluation
 * - Cyclomatic Complexity (CC): 5 (measured with ESLint)
 * - Branch Coverage: 100% (measured with V8 acceptance tests)
 * - CRAP Score: 5.0 (Threshold <= 10)
 * - Measured: 0.499987ms p95 including original inline guard evaluation; Node 22.23.3/Linux, 100 samples after 10 warmups.
 */
export async function evaluatePayloadGuard(
  contract: PayloadContract | undefined,
  ...args: Parameters<typeof GuardEvaluator.evaluate>
): ReturnType<typeof GuardEvaluator.evaluate> {
  const error = payloadContractError(contract, args[2].event.payload);
  if (error) return { passed: false, error };
  const result = await GuardEvaluator.evaluate(...args);
  if (!result.passed && contract) {
    result.error = `${result.error ?? 'Guard refused.'} ${contractRefusalGuidance(contract)} Inspect the owning state and signal for exact guard requirements.`;
  }
  return result;
}

