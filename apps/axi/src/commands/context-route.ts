import fs from 'node:fs';
import { ContextRouter, discoverContextCandidates, type ContextRouteCandidate } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderDetail, renderError, renderOutput } from '../toon.js';

const CONTEXT_ROUTE_USAGE = 'Usage: reactive-skills-axi context-route --message "..." [--candidates <JSON|@file>] [--token-budget <number>] [--json]';
const CONTEXT_CANDIDATES_GUIDANCE = 'Candidates must be a JSON array of skill metadata records shaped like {"id":"...","skill":"...","summary":"...","keywords":["..."]}, not arbitrary task labels or data. Each record describes one skill available to the agent.';
const CONTEXT_ROUTE_HELP = `${CONTEXT_ROUTE_USAGE}

Route the current task to one relevant skill and context slice.

--message <text>              Current user task or message.
--candidates <JSON|@file>     Optional skill choices. Omit to discover workspace and agent skill metadata.
                              Pass a JSON array of skill metadata records, not arbitrary task labels.
                              Each record requires id, skill, and summary; keywords are optional.
                              Pass [] to route with no candidates. All supplied skills are considered.
                              Large lists may require multiple Jev decisions.
--token-budget <number>       Maximum context tokens for selected route.
--json                        Print machine-readable JSON.

Example with automatic discovery:
  reactive-skills-axi context-route --message "Review this policy decision" --json

Example with an explicit skill list:
  reactive-skills-axi context-route --message "Review this policy decision" --candidates '[{"id":"policy-review","skill":"policy-review","summary":"Review decisions against policy","keywords":["policy"]}]' --json`;

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseJson(value: string | undefined, label: string): unknown {
  if (value === undefined) return undefined;
  let source = value;
  try {
    if (value.startsWith('@')) source = fs.readFileSync(value.slice(1), 'utf8');
    return JSON.parse(source);
  } catch {
    throw new AxiError(`Invalid JSON ${label}`, 'VALIDATION_ERROR', [
      CONTEXT_ROUTE_USAGE,
      CONTEXT_CANDIDATES_GUIDANCE,
    ]);
  }
}

function isSkillCandidate(value: unknown): value is ContextRouteCandidate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && candidate.id.trim().length > 0
    && typeof candidate.skill === 'string'
    && candidate.skill.trim().length > 0
    && typeof candidate.summary === 'string'
    && candidate.summary.trim().length > 0
    && (candidate.keywords === undefined
      || (Array.isArray(candidate.keywords) && candidate.keywords.every((keyword) => typeof keyword === 'string')));
}

export async function contextRouteCommand(args: string[] = []): Promise<string> {
  if (args.includes('--help') || args.includes('-h')) return CONTEXT_ROUTE_HELP;

  const message = flagValue(args, '--message');
  if (!message) {
    return renderOutput([renderError('Missing message', 'VALIDATION_ERROR', [CONTEXT_ROUTE_USAGE])]);
  }

  const candidatesWereProvided = args.includes('--candidates');
  const candidatesValue = flagValue(args, '--candidates');
  let candidates: ContextRouteCandidate[];
  let stateHints: Record<string, string | number | boolean> | undefined;
  try {
    if (candidatesWereProvided) {
      if (!candidatesValue || candidatesValue.startsWith('--')) {
        return renderOutput([renderError('Missing --candidates value', 'VALIDATION_ERROR', [
          CONTEXT_ROUTE_USAGE,
          CONTEXT_CANDIDATES_GUIDANCE,
        ])]);
      }
      const parsedCandidates = parseJson(candidatesValue, 'candidates');
      if (!Array.isArray(parsedCandidates)) {
        return renderOutput([renderError('Candidates must be a JSON array of skill metadata records', 'VALIDATION_ERROR', [
          CONTEXT_CANDIDATES_GUIDANCE,
        ])]);
      }
      const skillCandidates = parsedCandidates.filter(isSkillCandidate);
      if (skillCandidates.length !== parsedCandidates.length) {
        return renderOutput([renderError('Each candidate must describe one skill and include id, skill, and summary', 'VALIDATION_ERROR', [
          CONTEXT_CANDIDATES_GUIDANCE,
        ])]);
      }
      candidates = skillCandidates;
    } else {
      candidates = discoverContextCandidates(message, process.cwd());
    }
    stateHints = parseJson(flagValue(args, '--state-hints'), 'state hints') as Record<string, string | number | boolean> | undefined;
  } catch (err) {
    const error = err instanceof AxiError
      ? err
      : new AxiError(err instanceof Error ? err.message : 'Context routing input is invalid', 'VALIDATION_ERROR');
    return renderOutput([renderError(error.message, error.code, error.suggestions)]);
  }

  const tokenBudgetRaw = flagValue(args, '--token-budget');
  const tokenBudget = tokenBudgetRaw ? Number(tokenBudgetRaw) : undefined;

  try {
    const decision = await new ContextRouter().route({
      userMessage: message,
      candidates,
      tokenBudget,
      stateHints,
    });

    if (args.includes('--json')) return JSON.stringify(decision, null, 2);
    return renderOutput([
      renderDetail('context_route', decision, [
        { type: 'field', key: 'route' },
        { type: 'field', key: 'skill' },
        { type: 'field', key: 'context_mode' },
        { type: 'field', key: 'context_budget_tokens' },
        { type: 'field', key: 'risk' },
        { type: 'field', key: 'confidence' },
        { type: 'field', key: 'adapter' },
      ]),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Context routing failed';
    const invalidCandidateMetadata = message.startsWith('Each context route candidate needs')
      || message.startsWith('Duplicate context route candidate id:');
    const error = err instanceof AxiError
      ? err
      : new AxiError(
          message,
          invalidCandidateMetadata ? 'VALIDATION_ERROR' : 'RUNTIME_ERROR',
          invalidCandidateMetadata
            ? [CONTEXT_CANDIDATES_GUIDANCE]
            : ['Provide a non-empty message and bounded skill candidate metadata']
        );
    return renderOutput([renderError(error.message, error.code, error.suggestions)]);
  }
}
