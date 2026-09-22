/** @type {import('@/contracts/types').DocPage} */
export const overview = {
  slug: 'overview',
  title: 'Documentation',
  summary: 'Structured runtime transforming passive prompt markdown into deterministic, observable state machines. Select a compatible local AXI or MCP transport during INIT.',
  category: 'Introduction',
  href: '/docs',
  sections: [
    {
      id: 'what',
      heading: 'What Reactive Skills is',
      blocks: [
        { type: 'text', text: 'Traditional agent skills are passive markdown documents (SKILL.md) dumped entirely into model context. They rely on self-policing without execution memory, verifiable checkpoints, or reliable recovery paths.' },
        { type: 'text', text: 'Reactive Skills executes that operational intent as a Hierarchical State Machine (HSM). The agent receives a scoped prompt slice for only the active state, reacts to typed signals, validates through deterministic guards, and records every transition to an append-only event ledger. INIT checks local capabilities and versions, selects a compatible AXI or MCP transport, and persists that choice for the run.' },
        { type: 'callout', variant: 'signal', title: 'Execution pipeline', text: 'skill → state → signal → guard → event → deliverable. Every transition records to an append-only SQLite/JSONL ledger.' },
      ],
    },
    {
      id: 'paths',
      heading: 'Choose an integration path',
      blocks: [
        { type: 'list', items: [
          'AXI: Direct, token-lean CLI interface with TOON output and zero daemon overhead when selected by the runtime.',
          'Quickstart — Scaffold, inspect, and advance a skill in under five minutes.',
          'Authoring Skills — Design, customize, and verify domain states, guards, and projections.',
          'Syncing Skills — Distribute skills across agent runtimes with zero-drift junctions or physical mirroring.',
          'Concepts — Understand states, signals, guards, bubbling, and event sourcing.',
          'MCP: Stdio host integration for clients like Cursor, Claude Desktop, and VS Code when selected by the runtime.',
        ] },
      ],
    },
  ],
  relatedPages: [
    { title: 'AXI CLI', href: '/docs/axi' },
    { title: 'Quickstart', href: '/docs/quickstart' },
    { title: 'Authoring & customizing skills', href: '/docs/authoring' },
    { title: 'Syncing & distributing skills', href: '/docs/syncing' },
    { title: 'Concepts', href: '/docs/concepts' },
  ],
};
