import { EvidenceMediaTypeSchema, FSMEngine, importEvidence, readEvidence } from '@reactive-skills/runtime';
import { extractJobFlag, resolveSkillPath, resolveWorkspaceDir } from '../args.js';

/**
 * Import bounded workspace-local files or explicitly read verified registered bytes.
 * # Performance & Risk Budget
 * - Tier: P2 cold engine (<100ms target), P1 evidence IO (<25ms per <=1MiB)
 * - Complexity: O(cold replay delta + evidence bytes + path depth)
 * - Cyclomatic Complexity (CC): target <=15
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=25
 */
export async function evidenceCommand(args: string[]): Promise<string> {
  let engine: FSMEngine | undefined;
  try {
    const { jobId, filteredArgs } = extractJobFlag(args);
    const [skill, action, input, ...flags] = filteredArgs;
    if (!skill || !input || !['import', 'read'].includes(action)) {
      throw new Error('Usage: evidence <skill> import <workspace-relative-path> --media-type <type> [--job <run>] | evidence <skill> read <receipt-JSON> [--job <run>]');
    }
    const mediaType = action === 'import' && flags.length === 2 && flags[0] === '--media-type'
      ? EvidenceMediaTypeSchema.parse(flags[1]) : undefined;
    if (action === 'import' && !mediaType || action === 'read' && flags.length) throw new Error('Import requires --media-type; read accepts no extra flags.');
    const reference = action === 'read' ? JSON.parse(input) : undefined;
    const skillDir = resolveSkillPath(skill);
    if (!skillDir) throw new Error('Skill not found.');
    engine = new FSMEngine({ skillDir, workspaceDir: resolveWorkspaceDir(skillDir), jobId });
    const output = mediaType
      ? { reference: importEvidence(engine, input, mediaType) }
      : readEvidence(engine, reference);
    return JSON.stringify(output);
  } catch (error) {
    return JSON.stringify({ error: (error as Error).message });
  } finally { engine?.close(); }
}
