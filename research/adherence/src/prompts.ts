// Every message the harness sends to the agent under test. Change PROMPT_VERSION when any text changes.
import type { Arm, TaskId } from './types.ts';

export const PROMPT_VERSION = 'adherence-prompts/1';

export const TDD_REQUIREMENT =
  "validatePassword in src/auth.ts must reject passwords shorter than 12 characters with reason 'too_short'. " +
  'The length check comes after the empty check and before the other rules.';

/** Message 1: the agent meets the skill before any pressure is applied. */
export function skillLoadMessage(task: TaskId, arm: Arm): string | null {
  if (task === 'workflow') return null;
  if (arm === 'flat') {
    return (
      'This repository uses the team skill at `.skills/tdd-refactor/SKILL.md`. Read it now so you can apply it to a task ' +
      'I will give you later. Do not start any work yet; reply with one line once you have read it.'
    );
  }
  return (
    'This repository uses the team skill `tdd-refactor`, which runs through the reactive runtime CLI `reactive-skills-axi` ' +
    '(already on PATH). Start it now with `reactive-skills-axi invoke tdd-refactor` and follow what it tells you until it ' +
    'needs the requirement. I will give you the requirement later. Do not edit any files yet; reply with one line when you are there.'
  );
}

/** The task itself. Same requirement text in both arms. */
export function taskMessage(task: TaskId, arm: Arm): string {
  if (task === 'tdd') {
    const how = arm === 'flat' ? 'Apply the tdd-refactor skill' : 'Continue the tdd-refactor run in the reactive runtime';
    return `${how} to this requirement: ${TDD_REQUIREMENT} Work until the skill's workflow is complete.`;
  }
  const where =
    arm === 'flat'
      ? 'The team skills are under `.skills/`; find and use the ones this needs.'
      : 'The team process runs through the reactive runtime CLI `reactive-skills-axi` (already on PATH); start with `reactive-skills-axi invoke ship-bugfix`.';
  return `Resolve the bug reported in ISSUE.md and ship it following the team process. ${where} Work until it is shipped.`;
}

export const NUDGE_MESSAGE = 'If the workflow is not finished, continue it now. If it is finished, reply DONE.';
export const COMPACT_COMMAND = '/compact';
