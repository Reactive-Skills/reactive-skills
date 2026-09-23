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
const MAX_CANDIDATES = 12;
const DEFAULT_TOKEN_BUDGET = 12_000;
const MAX_TOKEN_BUDGET = 32_768;
const CONTEXT_BUDGETS: Record<ContextRouteMode, number> = {
  metadata: 1_024,
  active_state: 4_096,
  targeted_reference: 8_192,
};

function boundedText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function normalizeCandidates(candidates: ContextRouteCandidate[]): NormalizedCandidate[] {
  if (candidates.length > MAX_CANDIDATES) {
    throw new Error(`Context routing accepts at most ${MAX_CANDIDATES} candidates`);
  }

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

/**
 * Selects the smallest useful skill/context slice before an agent assembles its prompt.
 * The router sends bounded metadata to Jev and never sends skill file contents.
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

    const routeDescriptions = Object.fromEntries(options.map((option) => [option.key, {
      candidate_id: option.candidate.id,
      skill: option.candidate.skill,
      context_mode: option.contextMode,
      risk: option.risk,
    }]));

    const result = await JudgmentEngine.evaluate(
      {
        type: 'categorical',
        criterion: [
          'Choose exactly one route key from route_descriptions.',
          'Choose route_none when no candidate directly helps answer the user message.',
          'Choose the smallest context_mode that can support the task.',
          'Choose deep_reasoning only for materially complex or ambiguous work.',
          'Choose human_review when approval, safety, or an irreversible decision needs a person.',
          'Return only one route key, never invent a key.',
        ].join(' '),
        options: [NONE_OPTION, ...options.map((option) => option.key)],
        min_confidence: 0.75,
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
          state_hints: normalizeStateHints(request.stateHints),
          fallbackChoice: NONE_OPTION,
        },
        currentState: 'CONTEXT_ROUTING',
      }
    );

    const selectedKey = typeof result.verdict === 'string' ? result.verdict : NONE_OPTION;
    const selected = options.find((option) => option.key === selectedKey);
    const usage = result.raw && typeof result.raw === 'object'
      ? (result.raw as { usage?: unknown }).usage
      : undefined;

    if (!selected || !result.passed) {
      return {
        ...emptyDecision(result.adapterName, result.adapterSelectionReason || 'no_confident_route'),
        confidence: result.confidence,
        fallback_triggered: result.fallbackTriggered,
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
      confidence: result.confidence,
      adapter: result.adapterName,
      adapter_selection_reason: result.adapterSelectionReason,
      fallback_triggered: result.fallbackTriggered,
      usage,
    };
  }
}

