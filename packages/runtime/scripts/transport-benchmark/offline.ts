import { JudgmentEngine } from '../../src/core/judgment-engine.js';

/** Installs a local, deterministic adapter only in this benchmark process.
 * # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <= 3
 * - Branch Coverage: target >= 60%
 * - CRAP Score: target <= 30.0
 */
export function installOfflineAdapter() {
  let attempts = 0;
  const previous = JudgmentEngine.getAdapter('jev');
  JudgmentEngine.registerAdapter({
    id: 'jev',
    supports: () => true,
    async isAvailable() { return true; },
    /** # Performance & Risk Budget
     * - Tier: P3 (offline fixture)
     * - Complexity: O(1)
     * - Cyclomatic Complexity (CC): 2
     * - Branch Coverage: target >= 60%
     * - CRAP Score: target <= 30.0
     */
    async evaluate(request) {
      attempts += 1;
      return {
        adapterName: 'benchmark-local',
        verdict: request.type === 'categorical' ? 'route_0_active_state_standard' : false,
        confidence: 1,
        passed: request.type === 'categorical',
        latencyMs: 0,
      };
    },
  });
  return {
    attempts: () => attempts,
    restore: () => { if (previous) JudgmentEngine.registerAdapter(previous); },
  };
}
