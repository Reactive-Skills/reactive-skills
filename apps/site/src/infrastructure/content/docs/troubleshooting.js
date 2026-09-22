/** @type {import('@/contracts/types').DocPage} */
export const troubleshooting = {
  slug: 'troubleshooting',
  title: 'Troubleshooting',
  summary: 'Deterministic recovery procedures for guard rejections, SQLite concurrency, and state rehydration using the AXI CLI.',
  category: 'Reference',
  href: '/docs/troubleshooting',
  sections: [
    {
      id: 'guard-failures',
      heading: 'Guard expression evaluation failures',
      blocks: [
        { type: 'text', text: 'Symptom: A transition fails to fire. The state machine holds deterministically in the current state and writes a GUARD_FAILED event to the ledger. In AXI CLI mode, exit code 2 is returned with inline recovery instructions.' },
        { type: 'callout', variant: 'warn', title: 'Root cause', text: 'The guard expression in skill.yaml evaluates a context key that is undefined, type-mismatched (e.g. comparing string "0" to numeric 0), or unsatisfied by current facts.' },
        { type: 'steps', steps: [
          { title: 'Inspect the guard contract', text: 'Run `npx -y @reactive-skills/axi inspect skills/<skill>` to review defined transitions and guard predicates.' },
          { title: 'Check evaluated context snapshot', text: 'Run `npx -y @reactive-skills/axi events <skill> 5` to inspect the exact context facts evaluated during the failure.' },
          { title: 'Correct assertions and re-emit', text: 'Resolve code assertions or supply missing context payload, then re-dispatch the signal.' },
        ] },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi emit my-skill RECOVER_STATE', explanation: 'Dispatches a recovery signal to resume workflow from a known checkpoint.' } },
      ],
    },
    {
      id: 'sqlite-lock',
      heading: 'Event store lock / SQLite busy errors',
      blocks: [
        { type: 'text', text: 'Symptom: The runtime returns SQLITE_BUSY or "database is locked". Event appends halt, and projections pause.' },
        { type: 'callout', variant: 'danger', title: 'Concurrent access', text: 'Multiple concurrent processes (e.g. an unclosed test task and an active MCP daemon) are writing to the same skill events.db database file.' },
        { type: 'steps', steps: [
          { title: 'Terminate orphan processes', text: 'Kill orphan node processes holding open file descriptors on `.reactive/skills/<skill>/events.db`.' },
          { title: 'Run database checkpoint recovery', text: 'Run `npx -y @reactive-skills/axi rebuild-sqlite <skill>` to reconcile SQLite from the durable JSONL log.' },
          { title: 'Isolate CI workers', text: 'Ensure parallel CI jobs run within isolated workspaces or set separate skill directory paths.' },
        ] },
      ],
    },
    {
      id: 'rehydration',
      heading: 'State rehydration after process termination',
      blocks: [
        { type: 'text', text: 'Symptom: After an abrupt process termination, inspecting the skill shows initial state instead of the last active state.' },
        { type: 'text', text: 'Because the event store is authoritative, the runtime rehydrates state by replaying all append-only events. If a process died before flushing, replay deterministically halts at the last committed event.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi events my-skill 50', explanation: 'Inspects the full event stream to identify the last durable event and decide which signal to resume with.' } },
      ],
    },
  ],
  relatedPages: [
    { title: 'AXI CLI reference', href: '/docs/axi' },
    { title: 'Quickstart', href: '/docs/quickstart' },
    { title: 'Concepts', href: '/docs/concepts' },
  ],
};
