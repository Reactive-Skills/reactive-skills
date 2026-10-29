import { EvidenceMediaTypeSchema, EvidenceReceiptSchema, FSMEngine, importEvidence, readEvidence } from '@reactive-skills/runtime';
import { AxiError } from '../errors.js';
import { extractJobFlag, resolveSkillPath, resolveWorkspaceDir } from '../args.js';

/**
 * Classify a malformed receipt before any engine or store is opened.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms target)
 * - Complexity: O(receipt bytes)
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=10
 */
function parseReceipt(input: string) {
  try {
    return EvidenceReceiptSchema.parse(JSON.parse(input));
  } catch {
    throw new AxiError('Invalid receipt JSON: pass the reference object returned by evidence import', 'VALIDATION_ERROR');
  }
}

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
      throw new AxiError('Usage: evidence <skill> import <workspace-relative-path> --media-type <type> [--job <run>] | evidence <skill> read <receipt-JSON> [--job <run>]', 'VALIDATION_ERROR');
    }
    const parsedType = action === 'import' && flags.length === 2 && flags[0] === '--media-type'
      ? EvidenceMediaTypeSchema.safeParse(flags[1]) : undefined;
    const mediaType = parsedType?.success ? parsedType.data : undefined;
    if (action === 'import' && !mediaType || action === 'read' && flags.length) {
      throw new AxiError('Import requires --media-type text/plain|text/markdown|application/json; read accepts no extra flags.', 'VALIDATION_ERROR');
    }
    const reference = action === 'read' ? parseReceipt(input) : undefined;
    const skillDir = resolveSkillPath(skill);
    if (!skillDir) throw new Error('Skill not found.');
    engine = new FSMEngine({ skillDir, workspaceDir: resolveWorkspaceDir(skillDir), jobId });
    const output = mediaType
      ? { reference: importEvidence(engine, input, mediaType) }
      : readEvidence(engine, reference);
    return JSON.stringify(output);
  } catch (error) {
    return JSON.stringify({ error: (error as Error).message, ...(error instanceof AxiError ? { code: error.code } : {}) });
  } finally { engine?.close(); }
}
