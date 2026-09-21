/** @type {import('@/contracts/types').BlogPost} */
export const postIntroducingReactiveSkills = {
  slug: 'introducing-reactive-skills',
  title: 'Introducing Reactive Skills: The Death of the Monolithic Prompt',
  subtitle: 'Why Agent Skills Must Become Hierarchical State Machines with Scoped Prompt Slices and Deterministic Guards',
  summary: 'Conventional agent skills dump thousands of lines of instructions into an LLM context and pray for adherence. Reactive Skills transforms passive markdown into event-driven Hierarchical State Machines with append-only event sourcing and deterministic guards.',
  publishedAt: '2026-03-20',
  readTime: '6 min read',
  category: 'Architecture',
  tags: ['Runtime', 'Architecture', 'HSM', 'State Machines', 'Event Sourcing'],
  featured: true,
  author: {
    name: 'Reactive Skills Core Team',
    role: 'Runtime Architecture',
    handle: '@reactiveskills',
    avatar: '⚡',
  },
  series: {
    id: 'reactive-agentic-runtime',
    title: 'The Reactive Agentic Runtime',
    part: 1,
    total: 2,
    nextSlug: 'guarding-the-state-machine-jev',
  },
  sections: [
    {
      id: 'the-passive-skill-trap',
      heading: 'The Passive Skill Trap',
      blocks: [
        {
          type: 'text',
          text: 'Over the past two years, the AI engineering ecosystem standardized on markdown instruction files (`SKILL.md`) to guide autonomous agents. You write down the objectives, list the tools, enumerate edge cases, and hand the file to an LLM.',
        },
        {
          type: 'text',
          text: 'For single-turn queries or brief scripts, this works well enough. But as agent tasks grow into multi-phase engineering workflows—scaffolding features, migrating database schemas, executing surgical refactors, running integration test suites—the monolithic prompt model breaks down catastrophically.',
        },
        {
          type: 'callout',
          variant: 'danger',
          title: 'The Failure Modes of Monolithic Prompts',
          text: 'Attention drift from bloated context windows, token consumption wasted on dormant phases, and hallucinated completion claims where the model claims tests passed without ever verifying execution.',
        },
        {
          type: 'list',
          items: [
            'Context Window Bloat: Dumping instructions for Explore, Plan, Execute, and Verify simultaneously burns 70%+ of the token budget on phases that are completely irrelevant to the current turn.',
            'Attention Drift: As conversation turns accumulate, instructions in the middle of a 1,500-line markdown file get suppressed or forgotten.',
            'Vibe-Based Progression: Without a runtime boundary, the agent decides when a task is "done" based purely on its own generated prose ("Everything looks great, all tests pass!") rather than verified system state.',
          ],
        },
      ],
    },
    {
      id: 'the-reactive-shift',
      heading: 'The Reactive Shift: From Documents to Statecharts',
      blocks: [
        {
          type: 'text',
          text: 'Reactive Skills Architecture (RSA) fundamentally inverts this paradigm. Instead of treating a skill as a passive document for the agent to memorize, RSA treats the skill as a formal **Hierarchical State Machine (HSM)** executed by a strict TypeScript runtime.',
        },
        {
          type: 'text',
          text: 'At any point in time, the agent is in exactly one state (e.g. `PLAN`, `EXECUTE`, or `VERIFY`). Rather than receiving the entire repository handbook, the agent is presented with a **Just-In-Time Prompt Slice** containing only:',
        },
        {
          type: 'list',
          items: [
            'The prompt slice for the active state (`states/<state>.md`).',
            'The explicit tool whitelist enabled for that state.',
            'The current context variables bound to that state (`context_keys`).',
            'The declared transitions and acceptable runtime signals.',
          ],
        },
        {
          type: 'code',
          example: {
            language: 'bash',
            command: 'npx -y @reactive-skills/axi state refactor-workflow',
            explanation: 'The AXI CLI inspects the active state slice, injecting only what is relevant right now.',
            expectedOutput: `state:
  skill_id: refactor-workflow
  current_state: PLAN
prompt:
  raw_prompt: "# State: PLAN\\nAnalyze target files and generate an implementation plan..."
  allowed_tools: "view_file,grep_search"
transitions[2]:
  - signal: PLAN_APPROVED -> EXECUTE
  - signal: ABORT -> CANCELLED`,
          },
        },
      ],
    },
    {
      id: 'ancestor-bubbling',
      heading: 'Hierarchical State Machines & Ancestor Bubbling',
      blocks: [
        {
          type: 'text',
          text: 'Real-world workflows are rarely flat sequences. A refactoring session might comprise substates like `ANALYZE_AST` → `TRANSFORM_CODE` → `VALIDATE_TYPES`. If every substate had to implement handlers for global timeouts, security aborts, or human interventions, skills would drown in boilerplate.',
        },
        {
          type: 'text',
          text: 'RSA implements formal **Hierarchical State Machine (HSM) Ancestor Bubbling**. When an incoming signal has no matching transition in a leaf substate, the event bubbles up the ancestor tree until an ancestor handles it.',
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Cross-Cutting Resilience',
          text: 'Global recovery policies—such as EMERGENCY_ABORT, TIMEOUT, or ROLLBACK—are declared once on composite parent states, protecting all nested substates automatically.',
        },
      ],
    },
    {
      id: 'deterministic-guards',
      heading: 'Deterministic Guard Gates: No More Vibe Checks',
      blocks: [
        {
          type: 'text',
          text: 'In Reactive Skills, an agent cannot simply declare that a phase is complete. Transitions are defended by **deterministic guard expressions** evaluated in a sandboxed runtime environment.',
        },
        {
          type: 'text',
          text: 'A guard inspects concrete context facts: exit codes, payload properties, schema validations, or file existence. If a guard evaluates to `false`, the state machine refuses to transition, forcing the agent to remediate the underlying issue.',
        },
        {
          type: 'code',
          example: {
            language: 'yaml',
            command: `# skill.yaml transition specification
transitions:
  TESTS_PASSED:
    target: "DELIVER"
    guard: "event.payload.exit_code === 0 && context.coverage >= 85"`,
            explanation: 'Transition to DELIVER is mechanically impossible unless exit_code is 0 and coverage meets the threshold.',
          },
        },
      ],
    },
    {
      id: 'event-sourcing-and-projections',
      heading: 'Append-Only Event Sourcing & Live Deliverables',
      blocks: [
        {
          type: 'text',
          text: 'Every signal received, guard evaluated, and state entered is appended to an immutable event ledger (`events.jsonl` + SQLite `events.db`). The active state and system deliverables are never stored as mutable blobs—they are **read-model projections** folded from the event stream.',
        },
        {
          type: 'text',
          text: 'Whenever an event occurs, RSA automatically re-evaluates projection templates (using Handlebars), generating live PR summaries, verification reports, and architecture decision records directly into the workspace.',
        },
      ],
    },
    {
      id: 'whats-next',
      heading: "What's Next: Bridging into Semantic Judgment",
      blocks: [
        {
          type: 'text',
          text: 'Deterministic guards (`exit_code === 0`, schema checks) cover most programmatic operations. But modern software engineering also demands **semantic judgment**: *"Did the security scan report zero critical vulnerabilities?", "Is the PR description aligned with the original specification?"*',
        },
        {
          type: 'text',
          text: 'How do we evaluate nuanced semantic criteria at transition boundaries without introducing 5-second frontier LLM latency or hard SDK dependencies? In **Part 2 of this series**, we examine the **Decoupled Hexagonal Judgment Engine** and its zero-dependency snap-on integration with **TypeSafe Jev**.',
        },
        {
          type: 'callout',
          variant: 'signal',
          title: 'Coming in Part 2',
          text: 'Guarding the State Machine: Hexagonal Judgment and Sub-Second Micro-Decisions with TypeSafe Jev. Exploring circuit breakers, calibrated confidence thresholds, and graceful fallback cascades.',
        },
      ],
    },
  ],
};
