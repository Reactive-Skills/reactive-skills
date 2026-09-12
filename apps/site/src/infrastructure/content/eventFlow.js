/** @type {{ id: string, label: string, kind: string, description: string }[]} */
export const eventFlow = [
  { id: 'prompt', label: 'Prompt slice', kind: 'input', description: 'Isolated instruction for the active state — prevents context bloat.' },
  { id: 'signal', label: 'Signal', kind: 'signal', description: 'Typed message dispatched via AXI or MCP to advance the machine.' },
  { id: 'guard', label: 'Guard', kind: 'guard', description: 'Deterministic condition evaluated against context facts before transition.' },
  { id: 'state', label: 'State transition', kind: 'state', description: 'Atomic advance to the verified target state or substate.' },
  { id: 'event', label: 'Event', kind: 'event', description: 'Immutable record appended to the SQLite and JSONL ledger.' },
  { id: 'deliverable', label: 'Deliverable', kind: 'deliverable', description: 'Read-model projection rendered deterministically from event history.' },
];
