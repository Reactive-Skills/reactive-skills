// Derives the skills under test from one source each, so the flat and reactive arms carry the same instructions.
// - Flat tdd-refactor SKILL.md: linearized from the pinned reactive manifest and state prompts.
// - Reactive ship-bugfix state prompts: copied from the flat library skills' step lists.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { HARNESS_ROOT, PINNED_TDD_DIR } from './paths.ts';

interface TransitionDef {
  target: string;
  guard?: string;
}
interface StateDef {
  description?: string;
  prompt_template?: string;
  transitions?: Record<string, TransitionDef>;
  substates?: Record<string, StateDef>;
}
interface Manifest {
  name: string;
  description: string;
  default_context: Record<string, unknown>;
  states: Record<string, StateDef>;
}

/** Workflow phases in statechart order. INIT and SETUP_RUNTIME only bootstrap the runtime and have no flat equivalent. */
export const TDD_PHASES = ['RED_SPEC', 'GREEN_CODE', 'REFACTOR.CLEAN_CODE', 'REFACTOR.PERF_AUDIT', 'AUDIT_VERIFY', 'COMPLETED'];

export const FLAT_TDD_PATH = path.join(HARNESS_ROOT, 'fixtures/skills/flat/tdd-refactor/SKILL.md');
export const SHIP_BUGFIX_DIR = path.join(HARNESS_ROOT, 'fixtures/skills/reactive/ship-bugfix');
export const LIBRARY_DIR = path.join(HARNESS_ROOT, 'fixtures/skills/library');

function lookupState(manifest: Manifest, dotted: string): StateDef {
  const [head, child] = dotted.split('.');
  const state = manifest.states[head];
  return child ? state.substates![child] : state;
}

function guardProse(guard: string | undefined): string {
  if (!guard) return '';
  if (/exit_code\s*!==?\s*0/.test(guard)) return 'the run exits non-zero';
  if (/exit_code\s*===?\s*0/.test(guard)) return 'every run exits 0';
  throw new Error(`No prose rule for guard: ${guard}`);
}

function phaseTitle(dotted: string): string {
  return dotted.split('.').pop()!;
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline generator; < 100ms)
 * - Complexity: O(b) prompt bytes
 * - Cyclomatic Complexity (CC): 6 (threshold <= 20) */
function rewritePrompt(source: string, context: Record<string, unknown>): string {
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');
  return body
    .replace(/\{\{context\.requirement\}\}/g, 'the requirement you were given')
    .replace(/\{\{context\.(\w+)\}\}/g, (_m, key: string) => String(context[key]))
    .replace(/`context\.requirement`/g, 'the requirement')
    .replace(/`run_command`/g, 'a shell command')
    .split('\n')
    .filter((line) => !/^You are in the \*\*/.test(line))
    .filter((line) => !/\bemit\b/i.test(line))
    .filter((line) => !/advances the run to/.test(line))
    .filter((line) => !/Deliverable projections have been generated/.test(line))
    .map((line) => (line.startsWith('#') ? `#${line}` : line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline generator; < 100ms)
 * - Complexity: O(s*b), s = phases, b = prompt bytes
 * - Cyclomatic Complexity (CC): 7 (threshold <= 20) */
export function buildFlatTdd(): string {
  const manifest = yaml.load(fs.readFileSync(path.join(PINNED_TDD_DIR, 'skill.yaml'), 'utf8')) as Manifest;
  const out: string[] = [
    '---',
    `name: ${manifest.name}`,
    `description: ${manifest.description}`,
    '---',
    '',
    `# ${manifest.name}`,
    '',
    'Work through these phases in order. Do not start a phase before the previous one has ended as described.',
    '',
  ];
  for (const dotted of TDD_PHASES) {
    const state = lookupState(manifest, dotted);
    const prompt = fs.readFileSync(path.join(PINNED_TDD_DIR, state.prompt_template!), 'utf8');
    out.push(rewritePrompt(prompt, manifest.default_context), '');
    // Backward moves on failure are stated once per phase below, in the same words for every phase.
    const moves = Object.entries(state.transitions ?? {})
      .filter(([signal, t]) => t.target !== dotted && signal !== 'REGRESSION_DETECTED')
      .map(([, t]) => t);
    for (const move of moves) {
      const condition = guardProse(move.guard);
      out.push(`Continue to **${phaseTitle(move.target)}**${condition ? ` when ${condition}` : ' when this phase is done'}.`);
    }
    if (dotted.startsWith('REFACTOR.')) {
      out.push('If a test fails at any point during refactoring, go back to **GREEN_CODE**.');
    }
    if (dotted === 'AUDIT_VERIFY') {
      out.push('If any check fails, go back to **GREEN_CODE**.');
    }
    if (dotted === 'COMPLETED') {
      out.push(
        'Write `.docs/tdd-refactor-summary.md` listing each phase you completed, in order, with the check result that ended it.'
      );
    }
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Ship-bugfix states, the library skill each one reuses, and the signal that leaves it. */
export const SHIP_STATES = [
  { state: 'TRIAGE', skill: 'triage-bug', signal: 'TRIAGE_DONE' },
  { state: 'REPRO', skill: 'regression-fix', steps: [1, 2], signal: 'REPRO_FAILING' },
  { state: 'PATCH', skill: 'regression-fix', steps: [3, 4], signal: 'FIX_VERIFIED' },
  { state: 'RELEASE_NOTE', skill: 'release-note', signal: 'NOTE_WRITTEN' },
] as const;

function librarySteps(skill: string): string[] {
  const text = fs.readFileSync(path.join(LIBRARY_DIR, skill, 'SKILL.md'), 'utf8');
  const steps = text.split('## Steps')[1].trim().split(/\n(?=\d+\. )/);
  return steps.filter((step) => !/Hand over to/.test(step)).map((step) => step.replace(/^\d+\. /, ''));
}

/** # Performance & Risk Budget
 * - Tier: P3 (offline generator; < 100ms)
 * - Complexity: O(s*b)
 * - Cyclomatic Complexity (CC): 3 (threshold <= 20) */
export function buildShipBugfixStates(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of SHIP_STATES) {
    let steps = librarySteps(entry.skill);
    if ('steps' in entry) steps = entry.steps.map((n) => steps[n - 1]);
    const lines = [
      `# ${entry.state} (from the \`${entry.skill}\` skill)`,
      '',
      ...steps.map((step, i) => `${i + 1}. ${step}`),
      '',
      `When this is done, emit \`${entry.signal}\`. The runtime checks the files and test results itself and refuses the signal if the step is not done.`,
      '',
    ];
    files[`states/${entry.state.toLowerCase()}.md`] = lines.join('\n');
  }
  files['states/done.md'] = '# DONE\n\nThe fix is triaged, tested, patched and recorded in the changelog. Report the result.\n';
  return files;
}

/** Every generated file and its expected content, for writing and for the up-to-date test. */
export function generatedFiles(): Record<string, string> {
  const files: Record<string, string> = { [FLAT_TDD_PATH]: buildFlatTdd() };
  for (const [rel, content] of Object.entries(buildShipBugfixStates())) {
    files[path.join(SHIP_BUGFIX_DIR, rel)] = content;
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [file, content] of Object.entries(generatedFiles())) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    console.log(`wrote ${path.relative(HARNESS_ROOT, file)} (${Buffer.byteLength(content)} bytes)`);
  }
}
