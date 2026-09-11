import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { FSMEngine } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';

const HOME_DIR = os.homedir();

function resolveSkillPath(skillName: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'skills', skillName),
    path.resolve(HOME_DIR, '.agents', 'skills', skillName),
    path.resolve(HOME_DIR, '.gemini', 'config', 'skills', skillName),
  ];
  for (const candidate of candidates) {
    const yamlPath = path.join(candidate, 'skill.yaml');
    if (fs.existsSync(yamlPath)) {
      return candidate;
    }
  }
  return null;
}

export async function emitCommand(args: string[]): Promise<string> {
  const skillName = args[0];

  if (!skillName || args.length < 2) {
    const error = new AxiError(
      'Missing arguments',
      'VALIDATION_ERROR',
      [
        'Usage: reactive-skills-axi emit <skill-name> <signal-name> [--payload JSON]',
        'Or:    reactive-skills-axi emit <skill-name> <event-id> <signal-name> [--payload JSON]',
        'Example: reactive-skills-axi emit my-skill RUNTIME_READY',
        'Example: reactive-skills-axi emit my-skill TEST_RAN \'{"exit_code":0}\'',
      ]
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }

  let eventId: string | undefined;
  let signalName: string;
  let payloadArgStr = '';

  // Check if args[1] is an event UUID / sortable-id (20+ chars) or a signal name
  const looksLikeEventId = /^[0-9a-zA-Z_-]{20,}$/.test(args[1]);

  if (looksLikeEventId && args.length >= 3) {
    eventId = args[1];
    signalName = args[2];
    payloadArgStr = args.slice(3).join(' ').trim();
  } else {
    signalName = args[1];
    payloadArgStr = args.slice(2).join(' ').trim();
  }

  // Handle --payload flag if used
  if (payloadArgStr.startsWith('--payload')) {
    payloadArgStr = payloadArgStr.replace(/^--payload\s*/, '').trim();
  }

  try {
    const skillPath = resolveSkillPath(skillName);
    if (!skillPath) {
      const error = new AxiError(
        `Skill '${skillName}' not found in any known location`,
        'NOT_FOUND',
        ['Checked: ./skills/, ~/.agents/skills/, ~/.gemini/config/skills/']
      );
      return renderOutput([renderError(error.message, error.code, error.suggestions)]);
    }

    let payload: Record<string, any> = {};
    if (payloadArgStr) {
      if (payloadArgStr.startsWith('@')) {
        const filePath = payloadArgStr.slice(1);
        try {
          payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch {
          const error = new AxiError(
            'Invalid JSON payload file: ' + filePath,
            'VALIDATION_ERROR',
            ['Usage: reactive-skills-axi emit <skill> <signal> \'{"key":"value"}\' or \'@filepath.json\'']
          );
          return renderOutput([renderError(error.message, error.code, error.suggestions)]);
        }
      } else {
        try {
          payload = JSON.parse(payloadArgStr);
        } catch {
          const error = new AxiError(
            'Invalid JSON payload',
            'VALIDATION_ERROR',
            ['Usage: reactive-skills-axi emit <skill> <signal> \'{"key":"value"}\' or \'@filepath.json\'']
          );
          return renderOutput([renderError(error.message, error.code, error.suggestions)]);
        }
      }
    }

    // Load run_id from workspace to continue the same skill run
    let runId: string | undefined;
    const runIdPath = path.join(skillPath, '.reactive', 'run-id.txt');
    if (fs.existsSync(runIdPath)) {
      runId = fs.readFileSync(runIdPath, 'utf8').trim();
    }

    const engine = new FSMEngine({ 
      skillDir: skillPath, 
      workspaceDir: path.dirname(skillPath),
      eventContext: { run_id: runId }
    });

    // Auto-resolve causation eventId from event store if not explicitly supplied
    if (!eventId) {
      const events = engine.getEventStore().getAll();
      if (events.length > 0) {
        eventId = events[events.length - 1].id;
      }
    }

    const result = await engine.handleSignal(signalName, payload, { source: 'cli', causationId: eventId });

    const lines: string[] = [];
    lines.push(renderDetail('emit', {
      skill_id: skillName,
      signal: signalName,
      transitioned: result.transitioned,
      previous_state: result.previousState,
      current_state: result.newState,
      event_id: result.event.id,
      handled_at_depth: result.handledAtDepth,
      deliverables: result.deliverablesWritten,
    }, [
      { type: 'field', key: 'skill_id' },
      { type: 'field', key: 'signal' },
      { type: 'field', key: 'transitioned' },
      { type: 'field', key: 'previous_state' },
      { type: 'field', key: 'current_state' },
      { type: 'field', key: 'event_id' },
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

    const suggestions = getSuggestions({ domain: 'emit', action: 'signal', skillName });
    lines.push(renderHelp(suggestions));

    return renderOutput(lines);
  } catch (err) {
    const error = err instanceof AxiError
      ? err
      : new AxiError(
          err instanceof Error ? err.message : 'Failed to emit signal',
          'RUNTIME_ERROR',
          ['Check the skill name and signal name', 'Usage: reactive-skills-axi emit <skill> <event-id> <signal> \'{"key":"value"}\'']
        );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }
}

