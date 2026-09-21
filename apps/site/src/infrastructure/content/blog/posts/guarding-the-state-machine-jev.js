/** @type {import('@/contracts/types').BlogPost} */
export const postGuardingTheStateMachineJev = {
  slug: 'guarding-the-state-machine-jev',
  title: 'Guarding the State Machine: Hexagonal Judgment and Sub-Second Micro-Decisions with TypeSafe Jev',
  subtitle: 'How Reactive Skills Combines Ports-and-Adapters with TypeSafe’s System One Decision Engine for Fast, Resilient Semantic Guarding',
  summary: 'Deterministic boolean checks verify exit codes, but state transitions often require semantic nuance. Learn how Reactive Skills integrates a decoupled Hexagonal Judgment Engine with TypeSafe Jev for ~400ms micro-decisions and production circuit breaking.',
  publishedAt: '2026-03-22',
  readTime: '8 min read',
  category: 'Deep Dive',
  tags: ['Judgment Engine', 'TypeSafe Jev', 'Ports and Adapters', 'Circuit Breakers', 'Semantic Guards'],
  featured: false,
  author: {
    name: 'Reactive Skills Core Team',
    role: 'Runtime Architecture',
    handle: '@reactiveskills',
    avatar: '⚡',
  },
  series: {
    id: 'reactive-agentic-runtime',
    title: 'The Reactive Agentic Runtime',
    part: 2,
    total: 2,
    prevSlug: 'introducing-reactive-skills',
  },
  sections: [
    {
      id: 'the-semantic-boundary',
      heading: 'The Semantic Guard Problem',
      blocks: [
        {
          type: 'text',
          text: 'In Part 1 of this series, we explored how Hierarchical State Machines and deterministic guards (`exit_code === 0`, schema checks) eliminate the vibe-based progression that plagues monolithic agent prompts.',
        },
        {
          type: 'text',
          text: 'However, software engineering frequently confronts questions that cannot be collapsed into a binary regex or exit code check:',
        },
        {
          type: 'list',
          items: [
            '"Did the security scan identify zero critical CVEs and zero unredacted secrets?"',
            '"Does this refactoring proposal satisfy architectural invariants without introducing circular dependencies?"',
            '"Is this pull request description accurate with respect to the staged git diff?"',
          ],
        },
        {
          type: 'text',
          text: 'The naive solution is to invoke a flagship frontier model (Claude Opus, GPT-4o) at every transition. But doing so introduces severe friction: 3 to 6 seconds of latency per check, costly API token billing, non-deterministic outputs, and hard vendor coupling.',
        },
      ],
    },
    {
      id: 'hexagonal-judgment-engine',
      heading: 'Hexagonal Architecture: Ports & Adapters for Judgment',
      blocks: [
        {
          type: 'text',
          text: 'To preserve deterministic execution while supporting semantic judgments, Reactive Skills implements a decoupled **Ports-and-Adapters Judgment Engine** (`packages/runtime/src/core/judgment-engine.ts`). The runtime includes the TypeSafe SDK but makes network calls only when `TYPESAFE_API_KEY` is configured.',
        },
        {
          type: 'text',
          text: 'Transitions define high-level semantic contracts across three standardized judgment types:',
        },
        {
          type: 'list',
          items: [
            'predicate: A binary query evaluating to true or false with a calibrated confidence score (p_yes).',
            'categorical: Structured classification that routes execution to one of several discrete declared transition paths.',
            'evaluation: Rubric-based numerical scoring for multi-criteria quality gates.',
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'The JudgmentAdapter Interface',
          text: 'Any evaluation mechanism can implement the JudgmentAdapter port: from local V8 sandbox scripts, to internal fine-tuned classifiers, to external decision APIs.',
        },
      ],
    },
    {
      id: 'snap-on-jev',
      heading: 'TypeSafe Jev: Sub-Second System One Intelligence',
      blocks: [
        {
          type: 'text',
          text: 'For semantic evaluation, RSA includes the built-in **`JevJudgmentAdapter`**, which connects to **TypeSafe AI’s System One decision model** (Jev).',
        },
        {
          type: 'text',
          text: 'Unlike general-purpose conversational LLMs that spend seconds generating chain-of-thought tokens, Jev is trained specifically for calibrated, structured micro-decisions. It returns typed judgments and probabilities in ~300–500ms.',
        },
        {
          type: 'text',
          text: 'The integration is direct: configure `TYPESAFE_API_KEY`, and `JevJudgmentAdapter` calls TypeSafe AI System One without invoking `jev-axi`, a shell, or a temporary state file. The runtime package includes the SDK, and it preserves its deterministic Script fallback when credentials are unavailable or a request fails.',
        },
      ],
    },
    {
      id: 'circuit-breaking-and-cascades',
      heading: 'Production Resilience: Circuit Breakers & Cascades',
      blocks: [
        {
          type: 'text',
          text: 'In production agent swarms, relying on external APIs for transition guards can risk cascading timeouts if the network drops or third-party rate limits hit. RSA builds an industrial safety net directly into the Judgment Engine:',
        },
        {
          type: 'steps',
          steps: [
            {
              title: 'Circuit Breaker Isolation',
              text: 'Each adapter is wrapped in a stateful CircuitBreaker (CLOSED -> OPEN -> HALF_OPEN). If an external decision provider records consecutive failures, the breaker trips to OPEN, immediately bypassing subsequent calls without blocking the agent.',
            },
            {
              title: 'Calibrated Confidence Gates',
              text: 'Transitions specify a `min_confidence` threshold (e.g. 0.85). If Jev returns a verdict with confidence below the threshold, the runtime treats it as unverified.',
            },
            {
              title: 'Dynamic Fallback Cascade',
              text: 'If the primary adapter trips, times out, or fails the confidence threshold, the engine cascades to a fallback adapter (such as ScriptJudgmentAdapter) or safely diverts the FSM directly to a declared `fallback_target` (e.g. MANUAL_REVIEW or BLOCKED).',
            },
            {
              title: 'Immutable Audit Logging',
              text: 'Every fallback or breaker trip automatically appends a GUARD_FALLBACK_TRIGGERED event into the append-only SQLite ledger, guaranteeing 100% post-incident forensic replayability.',
            },
          ],
        },
      ],
    },
    {
      id: 'skill-yaml-example',
      heading: 'Guarded Transition in Action',
      blocks: [
        {
          type: 'text',
          text: 'Here is what a complete guarded transition looks like in `skill.yaml`:',
        },
        {
          type: 'code',
          example: {
            language: 'yaml',
            command: `# skill.yaml transition contract
transitions:
  SECURITY_CLEAN:
    target: "SPEC_ALIGNMENT"
    judgment:
      type: "predicate"
      criterion: "Did the security audit confirm zero leaked API keys and no high-severity vulnerabilities?"
      min_confidence: 0.85
      adapter_hint: "jev"
      fallback_adapter: "script"
      fallback_target: "SECURITY_BLOCKED"
      timeout_ms: 2500`,
            explanation: 'The transition delegates to Jev with a 2.5s timeout. If Jev trips or returns <85% confidence, it cascades safely to script evaluation or directs the state machine to SECURITY_BLOCKED.',
          },
        },
      ],
    },
    {
      id: 'benchmarks',
      heading: 'Performance & Latency Comparison',
      blocks: [
        {
          type: 'text',
          text: 'When executing multi-agent workflows with dozens of transitions, guard latency compounds rapidly:',
        },
        {
          type: 'table',
          caption: 'Transition Guard Latency & Characteristic Comparison',
          columns: ['Approach', 'Avg Latency', 'Determinism', 'Semantic Understanding', 'Failure Mode'],
          rows: [
            ['Script / VM Sandbox', '< 1 ms', '100% Deterministic', 'Heuristic / Syntactic only', 'Script error / Syntax failure'],
            ['TypeSafe Jev (System 1)', '~400 ms', 'Calibrated Probability', 'High Semantic Fidelity', 'Circuit breaker -> Fallback target'],
            ['Frontier LLM (Claude/GPT)', '3,500 - 6,000 ms', 'Variable / Stochastic', 'General reasoning', 'Cascading agent timeouts'],
          ],
        },
      ],
    },
    {
      id: 'conclusion',
      heading: 'Conclusion: Building Predictable Agent Swarms',
      blocks: [
        {
          type: 'text',
          text: 'Autonomous coding agents cannot scale if their execution boundaries are based on conversational vibes or sluggish, monolithic prompts. By pairing **Hierarchical State Machines** with a **Hexagonal Judgment Engine**, Reactive Skills delivers the best of both worlds:',
        },
        {
          type: 'list',
          items: [
            'Deterministic, zero-overhead execution for programmatic tools and exit codes.',
            'Sub-second, calibrated semantic guard gates via TypeSafe Jev for high-level quality criteria.',
            'Production-grade circuit breaking, fallback cascades, and append-only event sourcing.',
          ],
        },
        {
          type: 'callout',
          variant: 'signal',
          title: 'Try It Today',
          text: 'Explore the documentation at /docs/concepts or test the runtime in your terminal with `npx -y @reactive-skills/axi state <skill>`.',
        },
      ],
    },
  ],
};
