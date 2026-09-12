/** @type {{ id: string, label: string, kind: string, description: string }[]} */
export const eventFlow = [
  { id: 'prompt', label: 'Prompt slice', kind: 'input', description: 'A focused instruction — not the whole skill at once.' },
  { id: 'signal', label: 'Signal', kind: 'signal', description: 'A typed message enters the runtime.' },
  { id: 'guard', label: 'Guard', kind: 'guard', description: 'A deterministic gate decides if the move is allowed.' },
  { id: 'state', label: 'State transition', kind: 'state', description: 'The skill advances to its next state.' },
  { id: 'event', label: 'Event', kind: 'event', description: 'An immutable record is appended to the log.' },
  { id: 'deliverable', label: 'Deliverable', kind: 'deliverable', description: 'A live artifact is written for the user.' },
];
