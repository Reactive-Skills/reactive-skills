import fs from 'node:fs';
import { FSMEngine } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { extractJobFlag, resolveWorkspaceDir, resolveSkillPath } from '../args.js';


export async function emitCommand(args: string[]): Promise<string> {
  const { jobId, filteredArgs } = extractJobFlag(args);
  const skillName = filteredArgs[0];

  if (!skillName || filteredArgs.length < 2) {
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

  let eventId: string | undefined;
  let signalName: string;
  let payloadArgStr = '';

  // Check if filteredArgs[1] is an event UUID / sortable-id (20+ chars) or a signal name
  const looksLikeEventId = /^[0-9a-zA-Z_-]{20,}$/.test(filteredArgs[1]);

  if (looksLikeEventId && filteredArgs.length >= 3) {
    eventId = filteredArgs[1];
    signalName = filteredArgs[2];
    payloadArgStr = filteredArgs.slice(3).join(' ').trim();
  } else {
    signalName = filteredArgs[1];
    payloadArgStr = filteredArgs.slice(2).join(' ').trim();
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

      const result = await engine.handleSignal(signalName, payload, { source: 'cli', causationId: eventId });

      const lines: string[] = [];
      const effectiveJobId = (typeof engine.getJobId === 'function' ? engine.getJobId() : jobId) || 'default';
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
      }, [
        { type: 'field', key: 'skill_id' },
        { type: 'field', key: 'signal' },
        { type: 'field', key: 'transitioned' },
        { type: 'field', key: 'previous_state' },
        { type: 'field', key: 'current_state' },
        { type: 'field', key: 'run_id' },
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

      const suggestions = getSuggestions({
        domain: 'emit',
        action: 'signal',
        skillName,
        jobId: effectiveJobId,
        currentState: result.newState,
      });
      lines.push(renderHelp(suggestions));

      return renderOutput(lines);
    } finally {
      engine.close?.();
    }
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

