import { Buffer } from 'node:buffer';
import { JudgmentEngine } from './judgment-engine.js';

export type ContextRouteMode = 'metadata' | 'active_state' | 'targeted_reference';
export type ContextRouteRisk = 'standard' | 'deep_reasoning' | 'human_review';

export interface ContextRouteCandidate {
  id: string;
  skill: string;
  summary: string;
  keywords?: string[];
}

export interface ContextRouteRequest {
  userMessage: string;
  candidates: ContextRouteCandidate[];
  tokenBudget?: number;
  stateHints?: Record<string, string | number | boolean>;
}

export interface ContextRouteDecision {
  route: 'skill' | 'none';
  candidate_id?: string;
  skill?: string;
  context_mode: ContextRouteMode | 'none';
  context_budget_tokens: number;
  risk: ContextRouteRisk;
  needs_deep_reasoning: boolean;
  needs_human_review: boolean;
  confidence: number;
  adapter: string;
  adapter_selection_reason?: string;
  fallback_triggered?: boolean;
  usage?: unknown;
}

interface NormalizedCandidate extends ContextRouteCandidate {
  keywords: string[];
}

interface RouteOption {
  key: string;
  candidate: NormalizedCandidate;
  contextMode: ContextRouteMode;
  risk: ContextRouteRisk;
}

const NONE_OPTION = 'route_none';
const ROUTE_MODES: ContextRouteMode[] = ['metadata', 'active_state', 'targeted_reference'];
const ROUTE_RISKS: ContextRouteRisk[] = ['standard', 'deep_reasoning', 'human_review'];
// System One Choice supports 255 options and 64 KiB requests.
const MAX_CHOICE_OPTIONS = 255;
const MAX_ESTIMATED_REQUEST_BYTES = 48 * 1024;
const MAX_SINGLE_REQUEST_CANDIDATES = Math.floor(
  (MAX_CHOICE_OPTIONS - 1) / (ROUTE_MODES.length * ROUTE_RISKS.length)
);
const DEFAULT_TOKEN_BUDGET = 12_000;
const MAX_TOKEN_BUDGET = 32_768;
const CONTEXT_ROUTE_MIN_CONFIDENCE = 0.40;
const CONTEXT_ROUTE_CRITERION = [
  'Choose exactly one route key from route_descriptions.',
  'Choose route_none when no candidate directly helps answer the user message.',
  'Choose the smallest context_mode that can support the task.',
  'Choose deep_reasoning only for materially complex or ambiguous work.',
  'Choose human_review when approval, safety, or an irreversible decision needs a person.',
  'Return only one route key, never invent a key.',
].join(' ');
const CANDIDATE_SELECTION_CRITERION = [
  'Choose the one skill most relevant to the user message from candidate_options.',
  'Choose the narrowest useful skill when multiple skills fit.',
  'Return only one candidate key, never invent a key.',
].join(' ');
const CONTEXT_BUDGETS: Record<ContextRouteMode, number> = {
  metadata: 1_024,
  active_state: 4_096,
  targeted_reference: 8_192,
};

function boundedText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function normalizeCandidates(candidates: ContextRouteCandidate[]): NormalizedCandidate[] {
  const seenIds = new Set<string>();
  return candidates.map((candidate) => {
    const id = boundedText(String(candidate.id || ''), 120);
    const skill = boundedText(String(candidate.skill || ''), 120);
    const summary = boundedText(String(candidate.summary || ''), 1_000);
    if (!id || !skill || !summary) {
      throw new Error('Each context route candidate needs id, skill, and summary');
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate context route candidate id: ${id}`);
    }
    seenIds.add(id);

    const keywords = Array.isArray(candidate.keywords)
      ? candidate.keywords
        .map((keyword) => boundedText(String(keyword || ''), 80))
        .filter(Boolean)
        .slice(0, 12)
      : [];

    return { id, skill, summary, keywords };
  });
}

function normalizeStateHints(stateHints: Record<string, string | number | boolean> | undefined): Record<string, string | number | boolean> {
  if (!stateHints) return {};
  return Object.fromEntries(
    Object.entries(stateHints)
      .slice(0, 20)
      .map(([key, value]) => [boundedText(key, 80), typeof value === 'string' ? boundedText(value, 240) : value])
      .filter(([key]) => Boolean(key))
  );
}

function contextBudget(mode: ContextRouteMode, tokenBudget: number): number {
  return Math.min(CONTEXT_BUDGETS[mode], tokenBudget);
}

function emptyDecision(adapter = 'none', reason?: string): ContextRouteDecision {
  return {
    route: 'none',
    context_mode: 'none',
    context_budget_tokens: 0,
    risk: 'standard',
    needs_deep_reasoning: false,
    needs_human_review: false,
    confidence: 1,
    adapter,
    adapter_selection_reason: reason,
  };
}

type ContextJudgmentResult = Awaited<ReturnType<typeof JudgmentEngine.evaluate>>;

interface CandidateSelectionOutcome {
  candidate?: NormalizedCandidate;
  judgments: ContextJudgmentResult[];
}

function buildRouteOptions(candidates: NormalizedCandidate[]): RouteOption[] {
  const options: RouteOption[] = [];
  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const candidate = candidates[candidateIndex];
    for (const contextMode of ROUTE_MODES) {
      for (const risk of ROUTE_RISKS) {
        options.push({
          key: `route_${candidateIndex}_${contextMode}_${risk}`,
          candidate,
          contextMode,
          risk,
        });
      }
    }
  }
  return options;
}

function buildRouteDescriptions(options: RouteOption[]): Record<string, {
  candidate_id: string;
  skill: string;
  context_mode: ContextRouteMode;
  risk: ContextRouteRisk;
}> {
  return Object.fromEntries(options.map((option) => [option.key, {
    candidate_id: option.candidate.id,
    skill: option.candidate.skill,
    context_mode: option.contextMode,
    risk: option.risk,
  }]));
}

function estimatedRequestBytes(
  options: string[],
  criterion: string,
  context: Record<string, unknown>
): number {
  const request = {
    state: {
      event: { choice: NONE_OPTION },
      context,
      currentState: 'CONTEXT_ROUTING',
    },
    question: {
      type: 'categorical',
      criterion,
      options,
    },
  };
  return Buffer.byteLength(JSON.stringify(request), 'utf8');
}

function routeRequestFits(
  userMessage: string,
  candidates: NormalizedCandidate[],
  stateHints: Record<string, string | number | boolean>,
  options: RouteOption[]
): boolean {
  if (candidates.length > MAX_SINGLE_REQUEST_CANDIDATES) return false;
  const routeDescriptions = buildRouteDescriptions(options);
  const context = {
    user_message: userMessage,
    candidates,
    route_descriptions: routeDescriptions,
    state_hints: stateHints,
    fallbackChoice: NONE_OPTION,
  };
  return options.length + 1 <= MAX_CHOICE_OPTIONS
    && estimatedRequestBytes(
      [NONE_OPTION, ...options.map((option) => option.key)],
      CONTEXT_ROUTE_CRITERION,
      context
    ) <= MAX_ESTIMATED_REQUEST_BYTES;
}

function candidateSelectionRequest(
  userMessage: string,
  candidates: NormalizedCandidate[],
  stateHints: Record<string, string | number | boolean>
): { options: string[]; context: Record<string, unknown> } {
  const options = candidates.map((_, index) => `candidate_${index}`);
  return {
    options,
    context: {
      user_message: userMessage,
      candidate_options: Object.fromEntries(options.map((key, index) => [key, candidates[index]])),
      state_hints: stateHints,
      fallbackChoice: NONE_OPTION,
    },
  };
}

function candidateSelectionRequestFits(
  userMessage: string,
  candidates: NormalizedCandidate[],
  stateHints: Record<string, string | number | boolean>
): boolean {
  if (candidates.length > MAX_CHOICE_OPTIONS) return false;
  const request = candidateSelectionRequest(userMessage, candidates, stateHints);
  return estimatedRequestBytes(
    request.options,
    CANDIDATE_SELECTION_CRITERION,
    request.context
  ) <= MAX_ESTIMATED_REQUEST_BYTES;
}

function splitCandidateBatches(
  candidates: NormalizedCandidate[],
  userMessage: string,
  stateHints: Record<string, string | number | boolean>
): NormalizedCandidate[][] {
  const batches: NormalizedCandidate[][] = [];
  let batch: NormalizedCandidate[] = [];
  for (const candidate of candidates) {
    const nextBatch = [...batch, candidate];
    if (batch.length > 0 && !candidateSelectionRequestFits(userMessage, nextBatch, stateHints)) {
      batches.push(batch);
      batch = [candidate];
      continue;
    }
    batch = nextBatch;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

function judgmentUsage(result: ContextJudgmentResult): unknown {
  return result.raw && typeof result.raw === 'object'
    ? (result.raw as { usage?: unknown }).usage
    : undefined;
}

function combineUsage(
  selectionJudgments: ContextJudgmentResult[],
  routeJudgment?: ContextJudgmentResult
): unknown {
  if (selectionJudgments.length === 0) return routeJudgment ? judgmentUsage(routeJudgment) : undefined;
  const candidateSelection = selectionJudgments.map(judgmentUsage).filter((usage) => usage !== undefined);
  const route = routeJudgment ? judgmentUsage(routeJudgment) : undefined;
  if (candidateSelection.length === 0 && route === undefined) return undefined;
  return { candidate_selection: candidateSelection, route };
}

function combinedConfidence(judgments: ContextJudgmentResult[]): number {
  return Math.min(...judgments.map((judgment) => judgment.confidence));
}

function combinedFallback(judgments: ContextJudgmentResult[]): boolean {
  return judgments.some((judgment) => judgment.fallbackTriggered === true);
}

async function evaluateCandidateBatch(
  candidates: NormalizedCandidate[],
  userMessage: string,
  stateHints: Record<string, string | number | boolean>
): Promise<{ candidate?: NormalizedCandidate; judgment: ContextJudgmentResult }> {
  const { options, context } = candidateSelectionRequest(userMessage, candidates, stateHints);
  const judgment = await JudgmentEngine.evaluate(
    {
      type: 'categorical',
      criterion: CANDIDATE_SELECTION_CRITERION,
      options,
      min_confidence: CONTEXT_ROUTE_MIN_CONFIDENCE,
      timeout_ms: 3_000,
      fallback_adapter: 'script',
    },
    {
      event: {
        id: 'context-route-candidates',
        seq: 0,
        timestamp: new Date().toISOString(),
        type: 'CONTEXT_ROUTE_CANDIDATES',
        payload: { choice: NONE_OPTION },
      },
      context,
      currentState: 'CONTEXT_ROUTING',
    }
  );
  const selectedIndex = typeof judgment.verdict === 'string'
    ? /^candidate_(\d+)$/.exec(judgment.verdict)?.[1]
    : undefined;
  const index = selectedIndex === undefined ? -1 : Number(selectedIndex);
  return {
    candidate: judgment.passed && index >= 0 && index < candidates.length ? candidates[index] : undefined,
    judgment,
  };
}

async function selectCandidate(
  candidates: NormalizedCandidate[],
  userMessage: string,
  stateHints: Record<string, string | number | boolean>
): Promise<CandidateSelectionOutcome> {
  let currentCandidates = candidates;
  const judgments: ContextJudgmentResult[] = [];

  while (currentCandidates.length > 1) {
    const batches = splitCandidateBatches(currentCandidates, userMessage, stateHints);
    const outcomes: Array<{ candidate?: NormalizedCandidate; judgment: ContextJudgmentResult }> = [];
    for (let index = 0; index < batches.length; index += 4) {
      outcomes.push(...await Promise.all(
        batches.slice(index, index + 4).map((batch) => evaluateCandidateBatch(batch, userMessage, stateHints))
      ));
    }
    judgments.push(...outcomes.map((outcome) => outcome.judgment));
    if (outcomes.some((outcome) => !outcome.candidate)) return { judgments };
    currentCandidates = outcomes.map((outcome) => outcome.candidate!);
  }

  return { candidate: currentCandidates[0], judgments };
}

async function evaluateRoute(
  options: RouteOption[],
  candidates: NormalizedCandidate[],
  userMessage: string,
  stateHints: Record<string, string | number | boolean>
): Promise<ContextJudgmentResult> {
  const routeDescriptions = buildRouteDescriptions(options);
  return JudgmentEngine.evaluate(
    {
      type: 'categorical',
      criterion: CONTEXT_ROUTE_CRITERION,
      options: [NONE_OPTION, ...options.map((option) => option.key)],
      min_confidence: CONTEXT_ROUTE_MIN_CONFIDENCE,
      timeout_ms: 3_000,
      fallback_adapter: 'script',
    },
    {
      event: {
        id: 'context-route',
        seq: 0,
        timestamp: new Date().toISOString(),
        type: 'CONTEXT_ROUTE',
        payload: { choice: NONE_OPTION },
      },
      context: {
        user_message: userMessage,
        candidates,
        route_descriptions: routeDescriptions,
        state_hints: stateHints,
        fallbackChoice: NONE_OPTION,
      },
      currentState: 'CONTEXT_ROUTING',
    }
  );
}

/**
 * Selects the smallest useful skill/context slice before an agent assembles its prompt.
 * The router sends skill metadata to Jev and never sends skill file contents.
 */
export class ContextRouter {
  public async route(request: ContextRouteRequest): Promise<ContextRouteDecision> {
    const userMessage = boundedText(String(request.userMessage || ''), 12_000);
    if (!userMessage) throw new Error('Context routing needs a userMessage');

    const candidates = normalizeCandidates(request.candidates || []);
    if (candidates.length === 0) return emptyDecision('none', 'no_candidates');

    const tokenBudget = Math.max(
      128,
      Math.min(MAX_TOKEN_BUDGET, Math.floor(request.tokenBudget ?? DEFAULT_TOKEN_BUDGET))
    );
    const stateHints = normalizeStateHints(request.stateHints);
    const directOptions = candidates.length <= MAX_SINGLE_REQUEST_CANDIDATES
      ? buildRouteOptions(candidates)
      : [];
    const selection = routeRequestFits(userMessage, candidates, stateHints, directOptions)
      ? { candidate: candidates[0], judgments: [] as ContextJudgmentResult[] }
      : await selectCandidate(candidates, userMessage, stateHints);
    if (!selection.candidate) {
      const lastJudgment = selection.judgments[selection.judgments.length - 1];
      const decision = emptyDecision(
        lastJudgment?.adapterName || 'none',
        lastJudgment?.adapterSelectionReason || 'no_confident_candidate'
      );
      if (selection.judgments.length > 0) {
        decision.confidence = combinedConfidence(selection.judgments);
        decision.fallback_triggered = combinedFallback(selection.judgments);
        decision.usage = combineUsage(selection.judgments);
      }
      return decision;
    }

    const routeCandidates = selection.judgments.length > 0 ? [selection.candidate] : candidates;
    const options = selection.judgments.length > 0 ? buildRouteOptions(routeCandidates) : directOptions;
    const result = await evaluateRoute(options, routeCandidates, userMessage, stateHints);
    const selectedKey = typeof result.verdict === 'string' ? result.verdict : NONE_OPTION;
    const selected = options.find((option) => option.key === selectedKey);
    const judgments = [...selection.judgments, result];
    const confidence = combinedConfidence(judgments);
    const usage = combineUsage(selection.judgments, result);

    if (!selected || !result.passed) {
      return {
        ...emptyDecision(result.adapterName, result.adapterSelectionReason || 'no_confident_route'),
        confidence,
        fallback_triggered: combinedFallback(judgments),
        usage,
      };
    }

    return {
      route: 'skill',
      candidate_id: selected.candidate.id,
      skill: selected.candidate.skill,
      context_mode: selected.contextMode,
      context_budget_tokens: contextBudget(selected.contextMode, tokenBudget),
      risk: selected.risk,
      needs_deep_reasoning: selected.risk !== 'standard',
      needs_human_review: selected.risk === 'human_review',
      confidence,
      adapter: result.adapterName,
      adapter_selection_reason: result.adapterSelectionReason,
      fallback_triggered: combinedFallback(judgments),
      usage,
    };
  }
}
