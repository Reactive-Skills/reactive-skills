import { runtimeEvents } from '../runtimeEvents';

const eventRows = runtimeEvents.map((e) => [e.eventType, e.state, e.source, e.traceId, e.timestamp.replace('2025-06-12T', '').replace('Z', '')]);

/** @type {import('@/contracts/types').DocPage} */
export const conceptsDoc = {
  slug: 'concepts',
  title: 'Concepts',
  summary: 'Hierarchical State Machines, scoped prompt slices, typed signals, ancestor bubbling, deterministic guards, append-only event sourcing, and AXI integration.',
  category: 'Understand',
  href: '/docs/concepts',
  sections: [
    {
      id: 'reactive-vs-passive',
      heading: 'From passive prompts to reactive state machines',
      blocks: [
        { type: 'text', text: 'Traditional passive skills dump monolithic instructions into context. Agents attempt to remember prior turns and self-police progress without execution boundaries or verifiable checkpoints.' },
        { type: 'text', text: 'Reactive Skills structures execution as a formal Hierarchical State Machine (HSM). The agent receives an isolated prompt slice for the active state, evaluates deterministic guard expressions before transitions, and records all transitions to an append-only event ledger.' },
      ],
    },
    {
      id: 'states',
      heading: 'States & prompt isolation',
      blocks: [
        { type: 'text', text: 'Skills advance through named states such as PLAN, EXECUTE, and composite REFACTOR. Instead of loading the entire skill manual, agents receive only the prompt slice for the active state (states/*.md). This context isolation prevents attention drift and cuts token waste.' },
      ],
    },
    {
      id: 'signals-bubbling',
      heading: 'Signals and ancestor bubbling',
      blocks: [
        { type: 'text', text: 'Signals are typed payloads dispatched from the agent harness, AXI CLI, or MCP. If a leaf substate has no handler for an incoming signal, the event bubbles up the hierarchy to ancestor states. This eliminates boilerplate across substates for global policies like rollbacks, aborts, and timeouts.' },
        { type: 'callout', variant: 'info', title: 'Why bubbling matters', text: 'Cross-cutting policies — like rollbacks or global aborts — live on composite parent states instead of being duplicated into every child substate.' },
      ],
    },
    {
      id: 'guards',
      heading: 'Deterministic guard gates',
      blocks: [
        { type: 'text', text: 'Guards evaluate context facts (e.g. exit_code == 0, schema checks, artifact existence) deterministically. The runtime prevents transitions on subjective model claims, ensuring reproducible execution and verifiable progress.' },
        { type: 'code', example: { language: 'text', command: 'PLAN --[ guard: plan.approved ]--> EXECUTE', explanation: 'The skill enters EXECUTE only when the deterministic plan.approved guard condition is met.' } },
      ],
    },
    {
      id: 'judgment-engine',
      heading: 'Decoupled Judgment Engine & Snap-On Adapters',
      blocks: [
        { type: 'text', text: 'When deterministic boolean assertions are not enough (e.g. assessing semantic criteria like "Did the security scan identify zero critical CVEs?"), RSA provides a decoupled Judgment Engine adhering to SASH / Hexagonal Ports-and-Adapters principles.' },
        { type: 'text', text: 'The core runtime takes zero hard dependencies on external AI SDKs. Instead, transitions declare domain-level semantic contracts (predicate, categorical, or evaluation) which the runtime delegates to registered Judgment Adapters:' },
        { type: 'list', items: [
          'ScriptJudgmentAdapter: Built-in default (<1ms) providing deterministic sandboxed heuristic evaluation with zero configuration.',
          'JevJudgmentAdapter: Dynamic snap-on adapter that leverages TypeSafe AI\'s System One decision model via ambient CLI (npx -y jev-axi) or HTTP endpoints (~400ms decisions).',
          'Circuit Breaker & Fallbacks: Resilient evaluation wraps external calls in a circuit breaker. If an adapter times out or trips, the FSM transitions directly to a declared fallback_target (e.g. BLOCKED or MANUAL_REVIEW) and audits GUARD_FALLBACK_TRIGGERED into the event ledger.',
        ] },
        { type: 'code', example: {
          language: 'yaml',
          command: `# skill.yaml transition contract
transitions:
  SECURITY_CLEAN:
    target: "SPEC_ALIGNMENT"
    judgment:
      type: "predicate"
      criterion: "Did the security scan confirm zero leaked API keys and no high-severity vulnerabilities?"
      min_confidence: 0.85
      fallback_target: "BLOCKED"`,
          explanation: 'Transition advances only if the judgment confidence meets the threshold; otherwise diverts safely to BLOCKED.',
        } },
      ],
    },
    {
      id: 'model-tiers',
      heading: 'Semantic Model Capability Tiers',
      blocks: [
        { type: 'text', text: 'Not every state requires a flagship frontier model. RSA enables per-state cognitive tier declarations in skill.yaml so orchestrators and agents can dynamically allocate model budgets:' },
        { type: 'list', items: [
          'fast: Low latency, low cost for structured triage, lint parsing, and state setup (e.g. Claude Haiku, Gemini Flash).',
          'balanced: Standard coding, refactoring, and deterministic implementations (e.g. Claude Sonnet, GPT-4o).',
          'reasoning: Deep architectural decisions, invariant proofs, and root-cause analysis (e.g. Claude Opus, OpenAI o3, Gemini Pro).',
          'decision: Specialized micro-decision models trained for sub-second classification (e.g. TypeSafe Jev).',
        ] },
        { type: 'text', text: 'When an agent enters a state, the runtime injects a structured <model_contract> tag into the prompt slice, declaring the required tier, suggested models, and cost bounds.' },
      ],
    },
    {
      id: 'event-sourcing',
      heading: 'Event sourcing and projections',
      blocks: [
        { type: 'text', text: 'Every signal dispatch, guard evaluation, and state transition appends to an immutable ledger (.reactive/skills/<skill>/events.jsonl + SQLite). Current state, history, and workspace deliverables are computed read-model projections folded from the event ledger.' },
        { type: 'table', caption: 'Sample event ledger stream (times shown as HH:MM:SS)', columns: ['eventType', 'state', 'source', 'traceId', 'timestamp'], rows: eventRows },
      ],
    },
    {
      id: 'isolation',
      heading: 'Isolated skill storage',
      blocks: [
        { type: 'text', text: 'Each skill maintains dedicated state and event storage. Skill executions never cross-contaminate. SQLite provides ACID durability and indexed replay, while JSONL logs ensure human-readable auditability.' },
      ],
    },
    {
      id: 'parent-child',
      heading: 'Parent runs summarize child failures',
      blocks: [
        { type: 'text', text: 'Skills can invoke child skills hierarchically. When a child skill encounters a guard rejection or unhandled signal, the parent run folds the child’s events into a structured summary and surfaces the exact recovery action inline.' },
      ],
    },
    {
      id: 'interfaces',
      heading: 'Agent interfaces: AXI (Preferred) & MCP',
      blocks: [
        { type: 'text', text: 'Reactive skills expose two host interfaces: the AXI CLI (preferred for token efficiency and direct shell execution) and the MCP stdio server (for GUI client panels like Cursor and Claude Desktop).' },
        { type: 'callout', variant: 'signal', title: 'Interface selection', text: 'Use AXI whenever the host has terminal/shell access: ~40% fewer tokens, zero daemon process management, and instant recovery diagnostics. Use MCP when connecting to GUI client panels.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'Authoring & customizing skills', href: '/docs/authoring' },
    { title: 'AXI CLI reference (Preferred)', href: '/docs/axi' },
    { title: 'Quickstart', href: '/docs/quickstart' },
    { title: 'Model Context Protocol (MCP)', href: '/docs/mcp' },
  ],
};
