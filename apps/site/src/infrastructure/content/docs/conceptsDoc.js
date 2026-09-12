import { runtimeEvents } from '../runtimeEvents';

const eventRows = runtimeEvents.map((e) => [e.eventType, e.state, e.source, e.traceId, e.timestamp.replace('2025-06-12T', '').replace('Z', '')]);

/** @type {import('@/contracts/types').DocPage} */
export const conceptsDoc = {
  slug: 'concepts',
  title: 'Concepts',
  summary: 'Reactive skills, states, signals, bubbling, guards, event sourcing, and projections — in plain language first, then the technical detail.',
  category: 'Understand',
  href: '/docs/concepts',
  sections: [
    {
      id: 'reactive-vs-passive',
      heading: 'From a passive document to a reactive skill',
      blocks: [
        { type: 'text', text: 'A passive skill is a SKILL.md file: prose the model reads and tries to follow. It has no memory of the current step, no record of what it did, and no reliable way to recover.' },
        { type: 'text', text: 'A reactive skill keeps the same intent but runs it as a small machine. It knows which state it is in, reacts to typed signals, and records every change. You get the readability of a document with the reliability of a program.' },
      ],
    },
    {
      id: 'states',
      heading: 'States (the HSM)',
      blocks: [
        { type: 'text', text: 'A skill moves through named states such as EXPLORE, PLAN, EXECUTE, VERIFY, and DONE. States are hierarchical: a parent state can hold behaviour shared by its children, so you write shared handling once.' },
        { type: 'text', text: 'For each state the agent receives only its focused prompt slice, not the entire skill. That keeps attention on the current job and makes behaviour predictable.' },
      ],
    },
    {
      id: 'signals-bubbling',
      heading: 'Signals and bubbling',
      blocks: [
        { type: 'text', text: 'A signal is a typed message — from a user, an MCP client, or another skill. A state reacts to the signals it cares about. If it does not handle a signal, the signal bubbles up to the parent state.' },
        { type: 'callout', variant: 'info', title: 'Why bubbling matters', text: 'Cross-cutting handling — like “cancel” or “timeout” — lives in one parent state instead of being copied into every child.' },
      ],
    },
    {
      id: 'guards',
      heading: 'Guards are deterministic gates',
      blocks: [
        { type: 'text', text: 'Before a transition happens, a guard decides whether it is allowed. Guards are deterministic: the same inputs always produce the same decision, so a run is reproducible and a failure is explainable.' },
        { type: 'code', example: { language: 'text', command: 'PLAN --[ guard: plan.approved ]--> EXECUTE', explanation: 'The skill only enters EXECUTE once the plan.approved guard is satisfied.' } },
      ],
    },
    {
      id: 'event-sourcing',
      heading: 'Event sourcing and projections',
      blocks: [
        { type: 'text', text: 'Every change is stored as an append-only event. The current state is a projection: a view built by folding those events. Because nothing is overwritten, any run can be replayed and audited exactly as it happened.' },
        { type: 'table', caption: 'A run’s event log (times shown as HH:MM:SS)', columns: ['eventType', 'state', 'source', 'traceId', 'timestamp'], rows: eventRows },
      ],
    },
    {
      id: 'isolation',
      heading: 'Each skill has its own storage',
      blocks: [
        { type: 'text', text: 'Every skill keeps independent state and event storage. One skill’s history never leaks into another’s, so runs stay isolated and easy to reason about.' },
        { type: 'text', text: 'Events are written as JSONL and backed by SQLite. JSONL files rotate as they grow so the log stays manageable, while SQLite keeps queries and replay fast.' },
      ],
    },
    {
      id: 'parent-child',
      heading: 'Parent runs summarize child failures',
      blocks: [
        { type: 'text', text: 'Skills can invoke other skills. When a child skill fails, the parent run folds the child’s events into a short summary and surfaces it inline.' },
        { type: 'callout', variant: 'signal', title: 'No archaeology required', text: 'You read the failure and its recovery action in the parent run — you do not need to open the child skill and dig through its log separately.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'See the AXI output contract', href: '/docs/axi' },
    { title: 'Try it in the quickstart', href: '/docs/quickstart' },
  ],
};
