import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  DEFAULT_MIN_CONFIDENCE,
  PROBABILITY_THRESHOLDS_CAPABILITY,
  isExecutableCriterion,
  predicateProbabilityForConfidence,
  resolveJudgmentThreshold,
  type JudgmentDefinition,
} from '@reactive-skills/runtime';

export interface JudgmentLintResult {
  errors: string[];
  warnings: string[];
}

interface LocatedJudgment {
  location: string;
  judgment: Record<string, any>;
}

interface Band {
  op: '>=' | '>' | '<=' | '<';
  value: number;
}

interface Range {
  low: number;
  high: number;
}

const TOLERANCE = 1e-9;

function round(value: number): number {
  return Number(value.toFixed(4));
}

function approxEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < TOLERANCE;
}

function describeValue(value: unknown): string {
  return value === undefined ? 'unset' : JSON.stringify(value);
}

export function collectTransitionJudgments(states: unknown, prefix = ''): LocatedJudgment[] {
  if (!states || typeof states !== 'object') return [];
  const found: LocatedJudgment[] = [];

  for (const [stateName, stateDef] of Object.entries(states as Record<string, any>)) {
    const fullName = prefix ? `${prefix}.${stateName}` : stateName;
    if (stateDef?.transitions && typeof stateDef.transitions === 'object') {
      for (const [signal, transition] of Object.entries(stateDef.transitions as Record<string, any>)) {
        const judgment = transition && typeof transition === 'object' ? transition.judgment : undefined;
        if (judgment && typeof judgment === 'object') {
          found.push({ location: `State "${fullName}" transition on "${signal}"`, judgment });
        }
      }
    }
    found.push(...collectTransitionJudgments(stateDef?.substates, fullName));
  }

  return found;
}

/**
 * Effective P(yes) or P(picked label) a judgment needs to accept, when it is a probability.
 */
function effectiveAcceptProbability(judgment: Record<string, any>): number | undefined {
  if (typeof judgment.min_probability === 'number') return judgment.min_probability;
  if (judgment.type !== 'predicate') return undefined;
  const minConfidence = typeof judgment.min_confidence === 'number' ? judgment.min_confidence : DEFAULT_MIN_CONFIDENCE;
  return predicateProbabilityForConfidence(minConfidence);
}

/** Adapters the runtime registers itself; skills can only use others that the host registers. */
const BUILT_IN_ADAPTERS = ['script', 'jev'];

/**
 * True when text reads like code rather than a question: it starts with a sandbox reference or uses
 * JavaScript-only operators. Questions that mention fields such as `context.plans` stay natural language.
 */
function looksLikeExpression(criterion: string): boolean {
  if (/\?\s*$/.test(criterion)) return false;
  return /^\s*[!(]*\s*(payload|context|event|state)\s*\??[.[]/.test(criterion) || /===|!==|&&|\|\||=>/.test(criterion);
}

/**
 * Warns on semantic judgments that rely on min_confidence and on new fields used without the capability requirement.
 */
export function lintJudgmentThresholds(manifest: Record<string, any>): JudgmentLintResult {
  const warnings: string[] = [];
  const judgments = collectTransitionJudgments(manifest.states);

  for (const { location, judgment } of judgments) {
    for (const field of ['adapter_hint', 'fallback_adapter'] as const) {
      const name = judgment[field];
      if (typeof name === 'string' && !BUILT_IN_ADAPTERS.includes(name)) {
        warnings.push(
          `${location} ${field} '${name}' is not a built-in adapter (${BUILT_IN_ADAPTERS.join(', ')}); unless it is registered at runtime, the judgment cannot use it`
        );
      }
    }

    // A typo in an exact check silently turns it into natural language that the payload can decide.
    if (typeof judgment.criterion === 'string' && looksLikeExpression(judgment.criterion) && !isExecutableCriterion(judgment.criterion)) {
      warnings.push(
        `${location} criterion looks like a JavaScript expression but does not compile, so the runtime treats it as natural language and, without Jev, decides it from the payload; fix the expression or rephrase it as a question`
      );
    }

    // An exact check needs the script adapter as primary; a fallback runs only when the primary fails (#15).
    if (
      judgment.type === 'predicate'
      && judgment.adapter_hint !== 'script'
      && typeof judgment.criterion === 'string'
      && isExecutableCriterion(judgment.criterion)
    ) {
      const hint = judgment.adapter_hint ? `'${judgment.adapter_hint}'` : 'not set';
      warnings.push(
        `${location} predicate criterion is an executable expression, but adapter_hint is ${hint}; when Jev is available the model judges this exact check instead of the script adapter evaluating it. Set adapter_hint: script (fallback_adapter: script runs only when the primary adapter fails)`
      );
      continue;
    }

    if (judgment.adapter_hint === 'script' || judgment.min_probability !== undefined) continue;

    if (judgment.type === 'predicate') {
      const declared = typeof judgment.min_confidence === 'number';
      const minConfidence = declared ? judgment.min_confidence : DEFAULT_MIN_CONFIDENCE;
      const probability = round(predicateProbabilityForConfidence(minConfidence));
      warnings.push(
        `${location} predicate judgment relies on ${declared ? '' : 'the default '}min_confidence ${minConfidence}, which requires P(yes) >= ${probability}; declare min_probability: ${probability} instead`
      );
    } else if (judgment.type === 'categorical') {
      warnings.push(
        `${location} categorical judgment compares min_confidence with the adapter's confidence score, not the picked label's probability; declare min_probability to threshold the picked label's probability`
      );
    }
  }

  const usesProbabilityFields = judgments.some(
    ({ judgment }) => judgment.min_probability !== undefined || judgment.escalate !== undefined
  );
  const requiredCapabilities = manifest.runtime_requirements?.required_capabilities;
  const requiresCapability = Array.isArray(requiredCapabilities)
    && requiredCapabilities.includes(PROBABILITY_THRESHOLDS_CAPABILITY);
  if (usesProbabilityFields && !requiresCapability) {
    warnings.push(
      `Judgments use min_probability or escalate, but runtime_requirements.required_capabilities does not include ${PROBABILITY_THRESHOLDS_CAPABILITY}; older runtimes drop these fields and fall back to min_confidence ${DEFAULT_MIN_CONFIDENCE}`
    );
  }

  return { errors: [], warnings };
}

function parseBand(raw: unknown): Band | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const match = /^\s*(>=|>|<=|<|≥|≤)\s*(\d*\.?\d+)\s*$/.exec(String(raw));
  if (!match) return undefined;
  const op = match[1] === '≥' ? '>=' : match[1] === '≤' ? '<=' : (match[1] as Band['op']);
  return { op, value: Number(match[2]) };
}

function parseRange(raw: unknown): Range | undefined {
  if (typeof raw !== 'string') return undefined;
  const match = /^\s*(\d*\.?\d+)\s*(?:-|–|—|to)\s*(\d*\.?\d+)\s*$/.exec(raw);
  if (!match) return undefined;
  return { low: Number(match[1]), high: Number(match[2]) };
}

function hasTodo(contract: Record<string, any>): boolean {
  return JSON.stringify(contract.thresholds ?? {}).includes('TODO')
    || String(contract.failure_behavior ?? '').includes('TODO');
}

function compareLinkedJudgment(
  file: string,
  contract: Record<string, any>,
  snapOn: Record<string, any>,
  linked: LocatedJudgment,
  result: JudgmentLintResult
): void {
  const { location, judgment } = linked;

  if (snapOn.type !== judgment.type) {
    result.errors.push(
      `Guard contract ${file} and ${location} disagree on type: guard ${describeValue(snapOn.type)}, skill.yaml ${describeValue(judgment.type)}`
    );
  }
  const guardThreshold = resolveJudgmentThreshold(snapOn as JudgmentDefinition);
  const enforcedThreshold = resolveJudgmentThreshold(judgment as JudgmentDefinition);
  if (guardThreshold.field !== enforcedThreshold.field || guardThreshold.value !== enforcedThreshold.value) {
    result.errors.push(
      `Guard contract ${file} and ${location} disagree on threshold: guard ${guardThreshold.field} ${guardThreshold.value}, skill.yaml ${enforcedThreshold.field} ${enforcedThreshold.value}`
    );
  }
  if (JSON.stringify(snapOn.escalate) !== JSON.stringify(judgment.escalate)) {
    result.errors.push(
      `Guard contract ${file} and ${location} disagree on escalate: guard ${describeValue(snapOn.escalate)}, skill.yaml ${describeValue(judgment.escalate)}`
    );
  }

  const thresholds = contract.thresholds && typeof contract.thresholds === 'object' ? contract.thresholds : {};
  const effective = effectiveAcceptProbability(judgment);
  if (effective === undefined) return;

  const accept = parseBand(thresholds.accept);
  const inverted = accept?.op === '<' || accept?.op === '<=';
  if (accept) {
    const mapped = inverted ? 1 - accept.value : accept.value;
    if (inverted) {
      result.warnings.push(
        `Guard contract ${file} accepts when its probability is below ${accept.value}, but ${location} accepts when the probability is high; the guard question and the enforced criterion have opposite polarity`
      );
    }
    if (!approxEqual(mapped, effective)) {
      result.errors.push(
        `Guard contract ${file} accept band ${accept.op} ${accept.value} requires P >= ${round(mapped)}, but ${location} accepts at P >= ${round(effective)}`
      );
    }
  }

  const escalate = parseRange(thresholds.escalate);
  if (!escalate) return;
  if (!judgment.escalate) {
    result.warnings.push(
      `Guard contract ${file} declares escalate band ${escalate.low} to ${escalate.high}, but ${location} has no escalate block, so grey-zone results are rejected`
    );
    return;
  }
  const expectedLow = inverted ? 1 - escalate.high : escalate.low;
  if (!approxEqual(expectedLow, judgment.escalate.min_probability)) {
    result.errors.push(
      `Guard contract ${file} escalate band starts at P >= ${round(expectedLow)}, but ${location} escalates from P >= ${judgment.escalate.min_probability}`
    );
  }
}

/**
 * Reports drift between `guards/*.yaml` judgment contracts and the `skill.yaml` judgments the runtime enforces.
 */
export function lintGuardContracts(skillDir: string, manifest: Record<string, any>): JudgmentLintResult {
  const result: JudgmentLintResult = { errors: [], warnings: [] };
  const guardsDir = path.join(skillDir, 'guards');
  if (!fs.existsSync(guardsDir) || !fs.statSync(guardsDir).isDirectory()) return result;

  const judgments = collectTransitionJudgments(manifest.states);
  const files = fs.readdirSync(guardsDir)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .sort();

  for (const name of files) {
    const file = `guards/${name}`;
    let contract: unknown;
    try {
      contract = yaml.load(fs.readFileSync(path.join(guardsDir, name), 'utf8'));
    } catch (err: any) {
      result.warnings.push(`Guard contract ${file} is not valid YAML: ${err.message}`);
      continue;
    }
    if (!contract || typeof contract !== 'object') continue;

    const record = contract as Record<string, any>;
    const snapOn = record.snap_on?.judgment;
    if (!snapOn && !record.thresholds) continue;

    if (hasTodo(record)) {
      result.warnings.push(`Guard contract ${file} has unresolved TODO thresholds or failure behavior`);
    }

    if (!snapOn || typeof snapOn !== 'object' || typeof snapOn.criterion !== 'string') {
      result.warnings.push(
        `Guard contract ${file} declares thresholds without snap_on.judgment, so no skill.yaml judgment enforces it`
      );
      continue;
    }

    const linked = judgments.filter(({ judgment }) => judgment.criterion === snapOn.criterion);
    if (linked.length === 0) {
      result.warnings.push(
        `Guard contract ${file} is not enforced: no skill.yaml judgment uses its snap_on.judgment criterion`
      );
      continue;
    }

    for (const entry of linked) {
      compareLinkedJudgment(file, record, snapOn, entry, result);
    }
  }

  return result;
}
