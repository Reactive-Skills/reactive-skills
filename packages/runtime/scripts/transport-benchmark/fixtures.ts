import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const fixtureDir = fileURLToPath(new URL('./fixtures/', import.meta.url));
export const repositoryRoot = path.resolve(fixtureDir, '../../../../..');

interface Provenance {
  repository: string;
  commit: string;
  skill: string;
  files: Array<{ path: string; git_blob: string; bytes: number }>;
}

/** Copies only pinned public files and creates small synthetic human/legacy cases.
 * # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(b) fixture bytes
 * - Cyclomatic Complexity (CC): 4 (measured; threshold <= 20)
 * - Branch Coverage: 83% (5/6 V8 branches measured; target >= 60%)
 * - CRAP Score: 4.1 (measured; threshold <= 30.0)
 */
export function prepareWorkspace(workspace: string) {
  const provenance = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'provenance.json'), 'utf8')) as Provenance;
  for (const file of provenance.files) {
    const content = fs.readFileSync(path.join(fixtureDir, 'tdd-refactor', file.path));
    const hash = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    if (hash !== file.git_blob || content.length !== file.bytes) throw new Error(`Fixture changed: ${file.path}`);
  }
  fs.cpSync(path.join(fixtureDir, 'tdd-refactor'), path.join(workspace, 'skills', 'tdd-refactor'), { recursive: true });
  const human = path.join(workspace, 'skills', 'benchmark-human');
  fs.mkdirSync(human, { recursive: true });
  fs.writeFileSync(path.join(human, 'skill.yaml'), `schema_version: "2.1.0"
name: benchmark-human
description: Synthetic human gate transport fixture
initial_state: DRAFT
states:
  DRAFT:
    prompt_template: prompt.md
    transitions:
      READY: { target: REVIEW }
  REVIEW:
    prompt_template: prompt.md
    human_gate: { type: choice, tool: ask_question, options: [Approve, Reject] }
    transitions:
      USER_APPROVED: { target: WORK }
      USER_REJECTED: { target: CANCELLED }
  WORK:
    prompt_template: prompt.md
  CANCELLED:
    prompt_template: prompt.md
`);
  fs.writeFileSync(path.join(human, 'prompt.md'), 'Review the recorded plan. Wait for the human choice.\n');
  const legacy = path.join(workspace, 'skills', 'benchmark-legacy');
  fs.mkdirSync(legacy, { recursive: true });
  fs.writeFileSync(path.join(legacy, 'SKILL.md'), '---\nname: benchmark-legacy\ndescription: Synthetic legacy transport fixture\n---\nInspect the target and report the result.\n');
  return {
    provenance,
    authored_markdown_bytes: provenance.files.filter((file) => file.path.endsWith('.md'))
      .reduce((sum, file) => sum + file.bytes, 0),
    clean_code_authored_bytes: provenance.files.find((file) => file.path === 'states/clean_code.md')!.bytes,
  };
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline fixture; per operation target < 2000ms, no suite latency assertion)
 * - Complexity: O(f) files
 * - Cyclomatic Complexity (CC): 3 (measured; threshold <= 20)
 * - Branch Coverage: 80% (4/5 V8 branches measured; target >= 60%)
 * - CRAP Score: 3.1 (measured; threshold <= 30.0) */
export function filesUnder(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  }).sort();
}
