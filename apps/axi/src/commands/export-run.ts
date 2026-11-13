import path from 'node:path';
import { FSMEngine, exportRunBundle, isTerminalSuccessState } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { renderDetail, renderHelp, renderOutput } from '../toon.js';
import { extractJobFlag, findSkillByManifestName, resolveSkillPath, resolveWorkspaceDir } from '../args.js';

const USAGE = 'Usage: reactive-skills-axi export-run <skill> [--job <run>]';

/**
 * Seal the governed files of a finished run and write its hash-chained bundle for the exit check.
 * # Performance & Risk Budget
 * - Tier: P3 (once per run; bounded by the ledger and the governed trees)
 * - Complexity: O(L + r + N + f + B), ledger bytes, replay, run events, governed files and their bytes
 * - Cyclomatic Complexity (CC): target <=5
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=6
 */
export async function exportRunCommand(args: string[]): Promise<string> {
  const { jobId, filteredArgs } = extractJobFlag(args);
  const skillName = filteredArgs.find(arg => !arg.startsWith('-'));
  if (!skillName) throw new AxiError('Missing skill name', 'VALIDATION_ERROR', [USAGE]);
  const skillPath = resolveSkillPath(skillName) ?? findSkillByManifestName(skillName);
  if (!skillPath) throw new AxiError(`Skill '${skillName}' not found in any known location`, 'NOT_FOUND', ['Checked: ./skills/, ~/.agents/skills/, ~/.gemini/config/skills/']);
  const workspaceDir = resolveWorkspaceDir(skillPath);
  const engine = new FSMEngine({ skillDir: skillPath, workspaceDir, jobId, eventContext: { run_id: jobId } });
  try {
    const state = engine.getCurrentState();
    const runId = engine.getJobId() || 'default';
    if (!isTerminalSuccessState(engine.getStateDefinition(engine.getActiveStatePath()), state)) {
      throw new AxiError(`Run ${runId} is at ${state}, which is not a terminal success state; only a finished run can be exported`, 'VALIDATION_ERROR', [
        `Continue it with \`reactive-skills-axi state ${skillName} --job ${runId}\``,
      ]);
    }
    const store = engine.getEventStore();
    const { dir, manifest } = exportRunBundle({
      workspaceDir,
      skillDir: skillPath,
      manifest: engine.getManifest(),
      runId,
      terminalState: state,
      append: (type, payload) => { store.append(type, payload, { state, source: 'cli' }); },
      events: () => store.getAll(),
    });
    return renderOutput([
      renderDetail('export', {
        skill_id: manifest.skill,
        run_id: runId,
        terminal_state: state,
        sealed_files: Object.keys(manifest.sealed).length,
        bundle: path.relative(workspaceDir, dir).split(path.sep).join('/'),
        head_hash: manifest.head_hash,
      }, ['skill_id', 'run_id', 'terminal_state', 'sealed_files', 'bundle', 'head_hash'].map(key => ({ type: 'field' as const, key }))),
      renderHelp(['Commit the bundle with the change; `reactive-skills-axi verify-change` checks it at the exit boundary.']),
    ]);
  } finally {
    engine.close?.();
  }
}
