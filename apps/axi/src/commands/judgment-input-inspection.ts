import fs from 'node:fs';
import yaml from 'js-yaml';
import { inspectJudgmentInput, SkillManifestSchema, type JudgmentDefinition } from '@reactive-skills/runtime';
import { collectTransitionJudgments } from './judgment-contracts.js';

/**
 * Inspects candidate input without opening a run, writing events, importing guards or contacting adapters.
 * Tier: P2 (< 100ms local); Complexity: O(s + p² + p*d + b) manifest states, paths/depth and selected bytes.
 * CRAP target <= 25 (CC <= 15, branch coverage >= 70%).
 */
export function inspectJudgmentInputs(manifestPath: string, argument?: string): string {
  if (!argument) throw new Error('Usage: inspect <path> --judgment-input <JSON|@file>; JSON is {"context":{},"payload":{}}');
  const json = argument.startsWith('@') ? fs.readFileSync(argument.slice(1), 'utf8') : argument;
  let candidate: unknown;
  try { candidate = JSON.parse(json); }
  catch { throw new Error('Judgment input must be valid JSON'); }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Judgment input must be an object');
  const { context = {}, payload = {} } = candidate as Record<string, unknown>;
  for (const value of [context, payload]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Judgment context and payload must be objects');
  }
  const manifest = SkillManifestSchema.parse(yaml.load(fs.readFileSync(manifestPath, 'utf8')));
  const judgments = collectTransitionJudgments(manifest.states);
  return JSON.stringify({ judgment_inputs: judgments.map(({ location, judgment }) => ({
    transition: location,
    ...inspectJudgmentInput(judgment as JudgmentDefinition, {
      context: context as Record<string, unknown>,
      event: { id: 'inspection', seq: 0, timestamp: '', type: 'inspection', payload: payload as Record<string, unknown> },
      currentState: location.match(/^State "([^"]+)"/)?.[1] ?? manifest.initial_state,
    }),
  })) });
}
