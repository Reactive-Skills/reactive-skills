import type {
  JudgmentBand,
  JudgmentDefinition,
  JudgmentResult,
  JudgmentThreshold,
} from './types.js';

/** Confidence threshold applied when a judgment declares neither threshold field. */
export const DEFAULT_MIN_CONFIDENCE = 0.75;

/** Runtime capability advertised by runtimes that enforce `min_probability` and `escalate`. */
export const PROBABILITY_THRESHOLDS_CAPABILITY = 'judgment.probability_thresholds';

export interface JudgmentDecision {
  passed: boolean;
  band: JudgmentBand;
  threshold: JudgmentThreshold;
  /** Escalation or fallback target when the judgment is not accepted. */
  target?: string;
  error?: string;
}

/**
 * Converts a predicate `min_confidence` into the P(yes) it requires.
 * Predicate confidence is `|P(yes) - 0.5| * 2`, so the requirement is `P(yes) >= 0.5 + m / 2`.
 */
export function predicateProbabilityForConfidence(minConfidence: number): number {
  return 0.5 + minConfidence / 2;
}

export function resolveJudgmentThreshold(judgment: JudgmentDefinition): JudgmentThreshold {
  if (judgment.min_probability !== undefined) {
    return { field: 'min_probability', value: judgment.min_probability };
  }
  return { field: 'min_confidence', value: judgment.min_confidence ?? DEFAULT_MIN_CONFIDENCE };
}

/**
 * Decides whether an adapter result accepts, escalates, or rejects a judgment.
 * Pure: no I/O, no adapter calls.
 */
export function decideJudgment(judgment: JudgmentDefinition, result: JudgmentResult): JudgmentDecision {
  const threshold = resolveJudgmentThreshold(judgment);

  if (threshold.field === 'min_confidence') {
    const passed = Boolean(result.passed) && result.confidence >= threshold.value;
    return {
      passed,
      band: passed ? 'accept' : 'reject',
      threshold,
      target: passed ? undefined : judgment.fallback_target,
    };
  }

  const probability = result.probability;
  if (typeof probability !== 'number' || !Number.isFinite(probability)) {
    return {
      passed: false,
      band: 'reject',
      threshold,
      target: judgment.fallback_target,
      error: `Adapter '${result.adapterName}' returned no probability; min_probability requires one`,
    };
  }

  // A categorical answer must be one of the declared options before its probability counts.
  const validAnswer = judgment.type === 'predicate' || Boolean(result.passed);

  if (validAnswer && probability >= threshold.value) {
    return { passed: true, band: 'accept', threshold };
  }

  if (validAnswer && judgment.escalate && probability >= judgment.escalate.min_probability) {
    return { passed: false, band: 'escalate', threshold, target: judgment.escalate.target };
  }

  return { passed: false, band: 'reject', threshold, target: judgment.fallback_target };
}
