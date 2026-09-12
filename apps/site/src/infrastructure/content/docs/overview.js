/** @type {import('@/contracts/types').DocPage} */
export const overview = {
  slug: 'overview',
  title: 'Documentation',
  summary: 'Structured runtime transforming passive prompt markdown into deterministic, observable state machines. Choose direct AXI CLI execution (preferred for agents) or the MCP stdio daemon.',
  category: 'Introduction',
  href: '/docs',
  sections: [
    {
      id: 'what',
      heading: 'What Reactive Skills is',
      blocks: [
        { type: 'text', text: 'Traditional agent skills are passive markdown documents (SKILL.md) dumped entirely into model context. They rely on self-policing without execution memory, verifiable checkpoints, or reliable recovery paths.' },
        { type: 'text', text: 'Reactive Skills executes that operational intent as a Hierarchical State Machine (HSM). The agent receives a scoped prompt slice for only the active state, reacts to typed signals, validates through deterministic guards, and records every transition to an append-only event ledger. The system is driven natively via the token-efficient AXI CLI, with optional MCP bridging for GUI hosts.' },
        { type: 'callout', variant: 'signal', title: 'Execution pipeline', text: 'skill → state → signal → guard → event → deliverable. Every transition records to an append-only SQLite/JSONL ledger.' },
      ],
    },
    {
      id: 'paths',
      heading: 'Choose an integration path',
      blocks: [
        { type: 'list', items: [
          'AXI (Preferred) — Direct, token-lean CLI interface for autonomous agents with TOON output and zero daemon overhead.',
          'Quickstart — Scaffold, inspect, and advance a skill in under five minutes.',
          'Concepts — Understand states, signals, guards, bubbling, and event sourcing.',
          'MCP — Stdio server configuration for GUI hosts like Cursor, Claude Desktop, and VS Code.',
        ] },
      ],
    },
  ],
  relatedPages: [
    { title: 'AXI CLI (Preferred)', href: '/docs/axi' },
    { title: 'Quickstart', href: '/docs/quickstart' },
    { title: 'Concepts', href: '/docs/concepts' },
  ],
};
