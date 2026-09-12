/** @type {import('@/contracts/types').DocPage} */
export const troubleshooting = {
  slug: 'troubleshooting',
  title: 'Troubleshooting',
  summary: 'Actionable recovery guides for the most common Reactive Skills runtime, guard evaluation, and integration issues.',
  category: 'Reference',
  href: '/docs/troubleshooting',
  sections: [
    {
      id: 'guard-failures',
      heading: 'Guard expression evaluation failures',
      blocks: [
        { type: 'text', text: 'Symptom: A transition that should fire does not fire. The FSM holds in the current state and emits a GUARD_FAILED event. In MCP mode, reactive_emit_signal returns without updating the active state.' },
        { type: 'callout', variant: 'warn', title: 'Root cause', text: 'The guard expression in skill.yaml references a context key that is missing, mistyped, or of an unexpected type (e.g. comparing a string exit_code to a number).' },
        { type: 'steps', steps: [
          { title: 'Inspect the guard expression', text: 'Run `npx -y @reactive-skills/axi inspect skills/<skill>` to review the defined transition contract and guard expressions.' },
          { title: 'Check the failure context payload', text: 'Run `npx -y @reactive-skills/axi events skills/<skill> --last 5` to view the evaluated context snapshot at failure time.' },
          { title: 'Correct the guard or signal payload', text: 'Update the guard expression in skill.yaml or ensure upstream tools emit the expected typed payload.' },
        ] },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi emit my-skill RECOVER_STATE', explanation: 'Injects a manual recovery signal to resume workflow from a known checkpoint.' } },
      ],
    },
    {
      id: 'sqlite-lock',
      heading: 'Event store lock / SQLite busy errors',
      blocks: [
        { type: 'text', text: 'Symptom: The runtime throws SQLITE_BUSY or "database is locked". Events stop appending, and projections do not re-render.' },
        { type: 'callout', variant: 'danger', title: 'Concurrent access', text: 'Two processes (e.g. an active MCP server and an unclosed background test task) are writing concurrently to the same skill events.db file.' },
        { type: 'steps', steps: [
          { title: 'Terminate orphan processes', text: 'List and kill active node processes holding file handles on `.reactive/<skill>/events.db`.' },
          { title: 'Run schema recovery', text: 'Run `npx -y @reactive-skills/axi migrate skills/<skill>` to recover WAL checkpoints.' },
          { title: 'Isolate CI working directories', text: 'Set REACTIVE_SKILLS_DB_PATH to a per-job temporary path in automated CI pipelines.' },
        ] },
      ],
    },
    {
      id: 'rehydration',
      heading: 'State rehydration after process crash',
      blocks: [
        { type: 'text', text: 'Symptom: After an unexpected process exit, `inspect` reports the initial state instead of the last active state.' },
        { type: 'text', text: 'Because the event store is authoritative, rehydration replays from the append-only event ledger. If an uncommitted tail write was interrupted, replay halts at the last durable event.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi events my-skill --all', explanation: 'Audits the full event ledger to identify the last durable event and decide which signal to resume with.' } },
      ],
    },
  ],
  relatedPages: [
    { title: 'Understand concepts', href: '/docs/concepts' },
    { title: 'AXI CLI reference', href: '/docs/axi' },
    { title: 'Release changelog', href: '/docs/changelog' },
  ],
};
