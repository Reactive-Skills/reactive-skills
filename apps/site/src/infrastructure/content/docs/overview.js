/** @type {import('@/contracts/types').DocPage} */
export const overview = {
  slug: 'overview',
  title: 'Documentation',
  summary: 'Reactive Skills turns passive agent skills into an observable, stateful, recoverable runtime. Start here, then pick a path.',
  category: 'Introduction',
  href: '/docs',
  sections: [
    {
      id: 'what',
      heading: 'What Reactive Skills is',
      blocks: [
        { type: 'text', text: 'A traditional agent skill is a document — usually a SKILL.md — that the model reads and hopefully follows. There is no state, no record of what happened, and no way to recover cleanly when something goes wrong.' },
        { type: 'text', text: 'Reactive Skills runs that same intent as an event-driven Hierarchical State Machine. The agent receives a focused prompt slice for the current state, reacts to typed signals, passes deterministic guard gates, and appends an immutable event for every change. The result is agent work you can watch, reason about, and replay.' },
        { type: 'callout', variant: 'signal', title: 'Mental model', text: 'skill → state → signal → guard → event → deliverable. Keep that chain in mind and the rest of the docs will read easily.' },
      ],
    },
    {
      id: 'paths',
      heading: 'Choose a path',
      blocks: [
        { type: 'list', items: [
          'Quickstart — install and run your first skill in about five minutes.',
          'Concepts — understand states, signals, guards, and event sourcing in plain language.',
          'MCP — connect Reactive Skills to Cursor, Claude Desktop, or VS Code.',
          'AXI — learn the agent-facing CLI contract and output conventions.',
        ] },
      ],
    },
  ],
  relatedPages: [
    { title: 'Quickstart', href: '/docs/quickstart' },
    { title: 'Concepts', href: '/docs/concepts' },
  ],
};
