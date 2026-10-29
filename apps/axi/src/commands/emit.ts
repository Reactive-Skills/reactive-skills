import fs from 'node:fs';
import { EvidenceBindingsSchema, FSMEngine, submitEvidenceSignal, type EvidenceBindings, type EvidenceReceipt } from '@reactive-skills/runtime';
import { AxiError, storeOpenError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { extractJobFlag, resolveWorkspaceDir, resolveSkillPath } from '../args.js';


const USAGE_SUGGESTION = 'Usage: reactive-skills-axi emit <skill> <signal> \'{"key":"value"}\' or \'@filepath.json\'';
const EVIDENCE_USAGE_SUGGESTION = 'Usage: --evidence \'{"/field":{"path":"file.txt","media_type":"text/plain"}}\' or \'{"/field":{"reference":<receipt>}}\'';

/**
 * Splits emit arguments so a flag is never read as the skill, event ID, or signal.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(arguments)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function parseEmitArgs(filteredArgs: string[]): { positionals: string[]; flagPayload?: string; evidence?: string; unknownFlags: string[] } {
  const positionals: string[] = [];
  const unknownFlags: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < filteredArgs.length; i++) {
    const arg = filteredArgs[i];
    const match = /^(--payload|--evidence)(?:=([\s\S]*))?$/.exec(arg);
    if (match) {
      flags[match[1]] = match[2] ?? filteredArgs[++i] ?? '';
    } else if (arg.startsWith('-')) {
      unknownFlags.push(arg);
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flagPayload: flags['--payload'], evidence: flags['--evidence'], unknownFlags };
}

/**
 * Preserve JSON payload-file behavior independently of evidence import descriptors.
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms target for bounded payload files)
 * - Complexity: O(payload bytes)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function parsePayload(input: string): Record<string, unknown> {
  if (!input) return {};
  const fromFile = input.startsWith('@');
  try {
    return JSON.parse(fromFile ? fs.readFileSync(input.slice(1), 'utf8') : input);
  } catch {
    throw new AxiError(
      fromFile ? 'Invalid JSON payload file: ' + input.slice(1) : 'Invalid JSON payload',
      'VALIDATION_ERROR', [USAGE_SUGGESTION]
    );
  }
}

/**
 * Classify malformed evidence bindings before any engine or store is opened.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(evidence argument bytes)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function parseEvidence(input: string): EvidenceBindings {
  try {
    return EvidenceBindingsSchema.parse(JSON.parse(input));
  } catch {
    throw new AxiError('Invalid --evidence JSON', 'VALIDATION_ERROR', [EVIDENCE_USAGE_SUGGESTION]);
  }
}

const looksLikePayload = (arg: string | undefined): boolean => /^[{[@]/.test(arg?.trimStart() ?? '');

/**
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(argument bytes)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function parseSignalArgs(positionals: string[], flagPayload?: string) {
  let eventId: string | undefined;
  let signalName: string;
  let payloadArgStr = '';

  // A long signal name can resemble an event UUID / sortable-id (20+ chars), so the
  // explicit form needs a signal after it rather than a payload.
  const looksLikeEventId = /^[0-9a-zA-Z_-]{20,}$/.test(positionals[1]);

  if (looksLikeEventId && positionals.length >= 3 && !looksLikePayload(positionals[2])) {
    eventId = positionals[1];
    signalName = positionals[2];
    payloadArgStr = positionals.slice(3).join(' ').trim();
  } else {
    signalName = positionals[1];
    payloadArgStr = positionals.slice(2).join(' ').trim();
  }

  if (flagPayload !== undefined) {
    if (payloadArgStr) {
      throw new AxiError(
        'Payload given both positionally and with --payload',
        'VALIDATION_ERROR',
        ['Pass the payload once', USAGE_SUGGESTION]
      );
    }
    payloadArgStr = flagPayload.trim();
  }

  return { eventId, signalName, payloadArgStr };
}

/**
 * Render signal results and compact evidence receipts with the existing continuation prompt.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms target including prompt rendering)
 * - Complexity: O(response bytes + active state template)
 * - Cyclomatic Complexity (CC): target <=15
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=25
 */
function renderEmitOutput(
  engine: FSMEngine, result: Awaited<ReturnType<FSMEngine['handleSignal']>>, skillName: string, signalName: string,
  jobId?: string, evidence?: Record<string, EvidenceReceipt>,
): string {
  const lines: string[] = [];
  if (evidence) lines.push(JSON.stringify({ evidence }));
  const effectiveJobId = (typeof engine.getJobId === 'function' ? engine.getJobId() : jobId) || 'default';
  const effectiveAlias = (typeof engine.getJobName === 'function' ? engine.getJobName() : undefined) || effectiveJobId;
  lines.push(renderDetail('emit', {
    skill_id: skillName,
    signal: signalName,
    transitioned: result.transitioned,
    previous_state: result.previousState,
    current_state: result.newState,
    run_id: effectiveJobId,
    event_id: result.event.id,
    handled_at_depth: result.handledAtDepth,
    deliverables: result.deliverablesWritten,
    refusal_reason: result.refusalReason,
    judgment_basis: result.judgmentBasis,
    warning: result.warning,
  }, [
    { type: 'field', key: 'skill_id' },
    { type: 'field', key: 'signal' },
    { type: 'field', key: 'transitioned' },
    { type: 'field', key: 'previous_state' },
    { type: 'field', key: 'current_state' },
    { type: 'field', key: 'run_id' },
    { type: 'field', key: 'event_id' },
    // Why a guard refused, and whether a person or the agent's own report decided the judgment (ADR 0011, 0012).
    ...(result.refusalReason ? [{ type: 'field' as const, key: 'refusal_reason' }] : []),
    ...(result.judgmentBasis ? [{ type: 'field' as const, key: 'judgment_basis' }] : []),
    ...(result.warning ? [{ type: 'field' as const, key: 'warning' }] : []),
  ]));

  if (result.transitioned) {
    const promptSlice = engine.generatePromptSlice();
    lines.push(renderDetail('prompt', {
      raw_prompt: promptSlice.rawPrompt,
      allowed_tools: promptSlice.allowedTools.join(',') || 'none',
      exit_conditions: promptSlice.exitConditions.length,
    }, [
      { type: 'field', key: 'raw_prompt' },
      { type: 'field', key: 'allowed_tools' },
      { type: 'field', key: 'exit_conditions' },
    ]));
  }

  const suggestions = getSuggestions({
    domain: 'emit',
    action: 'signal',
    skillName,
    jobId: effectiveAlias,
    currentState: result.newState,
  });
  lines.push(renderHelp(suggestions));

  return renderOutput(lines);
}

/**
 * # Performance & Risk Budget
 * - Tier: P2 cold engine (<100ms target); P1 evidence IO (<25ms per <=1MiB)
 * - Complexity: O(cold replay delta + payload/evidence bytes + existing causation lookup)
 * - Cyclomatic Complexity (CC): target <=15
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=25
 */
export async function emitCommand(args: string[]): Promise<string> {
  const { jobId, idempotencyKey, filteredArgs } = extractJobFlag(args);
  const { positionals, flagPayload, evidence, unknownFlags } = parseEmitArgs(filteredArgs);
  const skillName = positionals[0];

  if (unknownFlags.length > 0) {
    const error = new AxiError(
      `Unknown emit flag: ${unknownFlags.join(', ')}`,
      'VALIDATION_ERROR',
      ['Supported flags: --payload, --evidence, --job, --idempotency-key', USAGE_SUGGESTION]
    );
    return renderOutput([renderError(error.message, error.code, error.suggestions)]);
  }

  if (!skillName || positionals.length < 2) {
    const error = new AxiError(
      'Missing arguments',
      'VALIDATION_ERROR',
      [
        'Usage: reactive-skills-axi emit <skill-name> <signal-name> [--payload JSON] [--job <job-id>]',
        'Or:    reactive-skills-axi emit <skill-name> <event-id> <signal-name> [--payload JSON] [--job <job-id>]',
        'Example: reactive-skills-axi emit my-skill RUNTIME_READY',
        'Example: reactive-skills-axi emit my-skill TEST_RAN \'{"exit_code":0}\'',
      ]
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  try {
    let { eventId, signalName, payloadArgStr } = parseSignalArgs(positionals, flagPayload);
    const skillPath = resolveSkillPath(skillName);
    if (!skillPath) {
      const error = new AxiError(
        `Skill '${skillName}' not found in any known location`,
        'NOT_FOUND',
        ['Checked: ./skills/, ~/.agents/skills/, ~/.gemini/config/skills/']
      );
      return renderOutput([renderError(error.message, error.code, error.suggestions)]);
    }

    const payload = parsePayload(payloadArgStr);
    const bindings = evidence === undefined ? undefined : parseEvidence(evidence);

    const workspaceDir = resolveWorkspaceDir(skillPath);
    const engine = new FSMEngine({ 
      skillDir: skillPath, 
      workspaceDir,
      jobId,
      eventContext: { run_id: jobId }
    });

    try {
      // Auto-resolve causation eventId from event store if not explicitly supplied
      if (!eventId) {
        const events = engine.getEventStore().getAll();
        if (events.length > 0) {
          eventId = events[events.length - 1].id;
        }
      }

      const metadata = { source: 'cli', causationId: eventId, idempotencyKey };
      const submission = bindings === undefined ? undefined
        : await submitEvidenceSignal(engine, signalName, payload, bindings, metadata);
      const result = submission?.result ?? await engine.handleSignal(signalName, payload, metadata);

      return renderEmitOutput(engine, result, skillName, signalName, jobId, submission?.evidence);
    } finally {
      engine.close?.();
    }
  } catch (err) {
    const error = err instanceof AxiError
      ? err
      : storeOpenError(err) ?? new AxiError(
          err instanceof Error ? err.message : 'Failed to emit signal',
          'RUNTIME_ERROR',
          ['Check the skill name and signal name', 'Usage: reactive-skills-axi emit <skill> <event-id> <signal> \'{"key":"value"}\'']
        );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }
}

