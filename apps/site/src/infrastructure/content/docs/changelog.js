/** @type {import('@/contracts/types').DocPage} */
export const changelog = {
  slug: 'changelog',
  title: 'Changelog',
  summary: 'Full release history and architectural evolution of the Reactive Skills Architecture (RSA).',
  category: 'Reference',
  href: '/docs/changelog',
  sections: [
    {
      id: 'v2-0-0',
      heading: '2.0.0 — Full event-sourced runtime & AXI CLI',
      blocks: [
        { type: 'text', text: 'The 2.0.0 release establishes the complete Reactive Skills Architecture (RSA) specification and public package delivery.' },
        { type: 'list', items: [
          'SQLite-backed event store with snapshot intervals and JSONL log rotation.',
          'AXI CLI standard (@reactive-skills/axi) with Token-Oriented Object Notation (TOON) output.',
          'Stdio Model Context Protocol (MCP) server supporting state inspection, signal dispatch, and bounded event queries.',
          'Deterministic sandbox guard evaluator supporting boolean logic and context fact checks.',
          'Automated Handlebars read-model projection engine for zero-overhead deliverable rendering.',
        ] },
      ],
    },
    {
      id: 'v1-0-3',
      heading: '1.0.3 — Stability, signal queue, and memory hardening',
      blocks: [
        { type: 'text', text: 'Hardened internal FSM reliability, eliminated sliding-buffer memory leaks, and added the reactive_migrate MCP tool.' },
        { type: 'list', items: [
          'Bounded sliding event buffer backed by SQLite storage driver.',
          'Deterministic state rehydration cycle resolving restart divergence.',
          'Dual-write durability ensuring SQLite persistence remains authoritative.',
          'Convention-over-configuration prompt slice location.',
        ] },
      ],
    },
    {
      id: 'v1-0-2',
      heading: '1.0.2 — Quality gates & documentation invariants',
      blocks: [
        { type: 'text', text: 'Introduced automated documentation invariant checks and prose quality gates.' },
        { type: 'list', items: [
          'Automated doc invariant checker enforcing README, AGENTS.md, and CLI command synchronization.',
          'Prose quality gate preventing ambiguous or low-fidelity documentation.',
          'Semver version bumping automation.',
        ] },
      ],
    },
  ],
  relatedPages: [
    { title: 'Quickstart', href: '/docs/quickstart' },
    { title: 'AXI CLI reference', href: '/docs/axi' },
    { title: 'Troubleshooting guide', href: '/docs/troubleshooting' },
  ],
};
