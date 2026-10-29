import { extractStateOutput, renderCompleteState } from '../state-view-output.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { FSMEngine } from '@reactive-skills/runtime';
import { AxiError, storeOpenError } from '../errors.js';
import { renderError, renderHelp, renderOutput, renderDetail } from '../toon.js';
import { getSuggestions } from '../suggestions.js';
import { extractJobFlag, resolveWorkspaceDir, resolveSkillPath } from '../args.js';


/**
 * Deliver legacy output or a negotiated complete state view with a bounded event anchor.
 * # Performance & Risk Budget
 * - Tier: P2 cold command (<100ms target excluding process startup)
 * - Complexity: O(L + r + b + h² + a + log N), verified ledger bytes, replay delta, decoded/rendered bytes, hierarchy, approval results and indexed latest-event lookup
 * - Cyclomatic Complexity (CC): 19 (measured ESLint; existing command orchestration)
 * - Branch Coverage: 80.77% (measured V8, full AXI suite; target >=70%)
 * - CRAP Score: 21.57 (measured; target <=25, hard ceiling <=30)
 * - Latency: legacy/compact p50 1.719/2.727ms, p95 2.446/3.786ms; 30 warm-cache command calls per output, excluding process startup
 */
export async function stateCommand(args: string[]): Promise<string> {
  let selected;
  try {
    selected = extractStateOutput(args);
  } catch (error) {
    return renderOutput([renderError((error as Error).message, 'VALIDATION_ERROR', ['Use --output legacy or --output compact-v1'])]);
  }
  args = selected.args;
  const { jobId, filteredArgs } = extractJobFlag(args);
  let skillName = filteredArgs[0];

  // If no skillName provided, check if current directory is a skill
  if (!skillName && fs.existsSync(path.join(process.cwd(), 'skill.yaml'))) {
    skillName = path.basename(process.cwd());
  }

  if (!skillName) {
    const error = new AxiError(
      'Missing skill name',
      'VALIDATION_ERROR',
      ['Usage: reactive-skills-axi state <skill-name> [--job <job-id>]', 'Example: reactive-skills-axi state my-skill']
    );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
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

    const workspaceDir = resolveWorkspaceDir(skillPath);
    const engine = new FSMEngine({
      skillDir: skillPath,
      workspaceDir,
      jobId,
      autoRotateTerminal: true,
    });

    try {
      const currentState = engine.getCurrentState();
      const promptSlice = engine.generatePromptSlice();
      if (selected.output === 'compact-v1') return renderCompleteState(engine, promptSlice);
      const latestEvent = engine.getEventStore().getLatestEvent();
      const effectiveJobId = (typeof engine.getJobId === 'function' ? engine.getJobId() : jobId) || 'default';
      const effectiveAlias = (typeof engine.getJobName === 'function' ? engine.getJobName() : undefined) || effectiveJobId;

      const lines: string[] = [];
      lines.push(renderDetail('state', {
        skill_id: skillName,
        current_state: currentState,
        event_id: latestEvent?.id || 'none',
        run_id: effectiveJobId,
      }, [
        { type: 'field', key: 'skill_id' },
        { type: 'field', key: 'current_state' },
        { type: 'field', key: 'event_id' },
        { type: 'field', key: 'run_id' },
      ]));

      lines.push(renderDetail('prompt', {
        raw_prompt: promptSlice.rawPrompt,
        allowed_tools: promptSlice.allowedTools.join(',') || 'none',
        exit_conditions: promptSlice.exitConditions.length,
      }, [
        { type: 'field', key: 'raw_prompt' },
        { type: 'field', key: 'allowed_tools' },
        { type: 'field', key: 'exit_conditions' },
      ]));

      const suggestions = getSuggestions({
        domain: 'state',
        action: 'get',
        skillName,
        jobId: effectiveAlias,
        currentState,
      });
      lines.push(renderHelp(suggestions));

      return renderOutput(lines);
    } finally {
      engine.close?.();
    }
  } catch (err) {
    const error = err instanceof AxiError
      ? err
      : storeOpenError(err) ?? new AxiError(
          err instanceof Error ? err.message : 'Failed to retrieve skill state',
          'RUNTIME_ERROR',
          ['Check the skill name and ensure it exists in skills/ or global registry', 'Usage: reactive-skills-axi state <skill-name> [--job <job-id>]']
        );
    return renderOutput([
      renderError(error.message, error.code, error.suggestions),
    ]);
  }
}
