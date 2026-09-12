/** @type {import('@/contracts/types').Concept[]} */
export const concepts = [
  { name: 'Reactive skill', summary: 'A skill that reacts to signals and advances through explicit states instead of running as one opaque prompt.', relatedConcepts: ['HSM state', 'Signal'] },
  { name: 'HSM state', summary: 'A named phase such as EXPLORE or EXECUTE. States can nest, so a parent state owns the behaviour shared by its children.', relatedConcepts: ['Reactive skill', 'Bubbling'] },
  { name: 'Signal', summary: 'A typed message — from a user, a client, or another skill — that a state may react to.', relatedConcepts: ['Bubbling', 'Guard'] },
  { name: 'Bubbling', summary: 'When a state does not handle a signal, it bubbles up to the parent state, so shared handling lives in one place.', relatedConcepts: ['HSM state', 'Signal'] },
  { name: 'Guard', summary: 'A deterministic condition that must be true before a transition is allowed. Same inputs always give the same decision.', relatedConcepts: ['Signal', 'Event sourcing'] },
  { name: 'Event sourcing', summary: 'Every change is stored as an append-only event, so any run can be replayed and audited exactly as it happened.', relatedConcepts: ['Projection', 'Guard'] },
  { name: 'Projection', summary: 'A read-friendly view built by folding events — for example the current state, or a summary of a child run’s failure.', relatedConcepts: ['Event sourcing'] },
];
