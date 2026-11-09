export const CREATE_SKILL_PROMPT = 'Use skill-manager to create a reactive skill for [describe your task]. Ask about missing requirements, show me the plan, then build and validate it after I approve.';

/** Agent prompt offered for a published skill; P3 pure, O(1), CC 2, CRAP <=2. */
export const agentPromptFor = (slug) => (slug === 'skill-manager'
  ? CREATE_SKILL_PROMPT
  : `Use the ${slug} skill to [describe your task].`);

export const USE_SKILL_PROMPT = agentPromptFor('tdd-refactor');
