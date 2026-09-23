import fs from 'node:fs';
import { ContextRouter, type ContextRouteCandidate } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderDetail, renderError, renderOutput } from '../toon.js';

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseJson(value: string | undefined, label: string): unknown {
  if (!value) return undefined;
  const source = value.startsWith('@') ? fs.readFileSync(value.slice(1), 'utf8') : value;
  try {
    return JSON.parse(source);
  } catch {
    throw new AxiError(`Invalid JSON ${label}`, 'VALIDATION_ERROR', [
      `Usage: reactive-skills-axi context-route --message "..." --candidates '[{"id":"skill","skill":"skill","summary":"..."}]' --json`,
    ]);
  }
}

export async function contextRouteCommand(args: string[] = []): Promise<string> {
  const message = flagValue(args, '--message');
  const candidates = parseJson(flagValue(args, '--candidates'), 'candidates') as ContextRouteCandidate[] | undefined;
  const stateHints = parseJson(flagValue(args, '--state-hints'), 'state hints') as Record<string, string | number | boolean> | undefined;
  const tokenBudgetRaw = flagValue(args, '--token-budget');
  const tokenBudget = tokenBudgetRaw ? Number(tokenBudgetRaw) : undefined;

  if (!message || !Array.isArray(candidates)) {
    return renderOutput([
      renderError(
        'Missing message or candidates',
        'VALIDATION_ERROR',
        ['Usage: reactive-skills-axi context-route --message "..." --candidates <JSON|@file> [--token-budget <number>] [--json]']
      ),
    ]);
  }

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
    const error = err instanceof AxiError
      ? err
      : new AxiError(err instanceof Error ? err.message : 'Context routing failed', 'RUNTIME_ERROR', [
          'Provide bounded candidate metadata and a non-empty message',
        ]);
    return renderOutput([renderError(error.message, error.code, error.suggestions)]);
  }
}

