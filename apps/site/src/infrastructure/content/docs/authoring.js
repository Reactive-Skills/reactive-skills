/** @type {import('@/contracts/types').DocPage} */
export const authoring = {
  slug: 'authoring',
  title: 'Authoring & Customizing Skills',
  summary: 'How to design, customize, and verify reactive skills — moving from starter scaffold templates to domain states, isolated prompt slices, deterministic guards, and event-sourced deliverables.',
  category: 'Get started',
  href: '/docs/authoring',
  sections: [
    {
      id: 'beyond-scaffold',
      heading: 'Beyond the basic scaffold',
      blocks: [
        { type: 'text', text: 'Running axi init generates a runnable skeleton containing runtime verification (INIT, SETUP_MCP), a generic START state, and execution boundaries (BYPASS_DETECTED). However, production skills represent domain workflows with custom macro-phases, deterministic gating, and scoped prompt slices.' },
        { type: 'callout', variant: 'info', title: 'Scaffold as foundation', text: 'The scaffold establishes the directory layout and runtime contract. Customization is the process of mapping your domain tasks into an explicit state machine, replacing the default placeholder states with verified execution gates.' },
      ],
    },
    {
      id: 'package-structure',
      heading: 'Anatomy of a reactive skill',
      blocks: [
        { type: 'text', text: 'A customized reactive skill is organized into isolated, single-responsibility files under skills/<skill-name>/:' },
        { type: 'table', caption: 'Reactive skill package components', columns: ['File / Directory', 'Role & Responsibility', 'Customization Purpose'], rows: [
          ['skill.yaml', 'State machine manifest (v2.1.0)', 'Defines states, valid transition paths, deterministic guard rules, and allowed tools.'],
          ['SKILL.md', 'Host entry point & bootloader', 'Contains the strict execution preamble instructing agents to operate via AXI or MCP.'],
          ['STATECHART.md', 'Mermaid state diagram', 'Provides a visual stateDiagram-v2 representation matching skill.yaml topology.'],
          ['states/*.md', 'Scoped prompt slices', 'Isolated instructions for each state. Agents receive only the active slice.'],
          ['guards/', 'Custom guard functions (optional)', 'JavaScript modules evaluating complex boolean criteria and invariants.'],
          ['templates/*.hbs', 'Read-model templates (optional)', 'Handlebars templates that project deliverable summaries from the event ledger.'],
          ['skill-release.json', 'Package metadata', 'Tracks schema version and distribution channel.'],
        ] },
      ],
    },
    {
      id: 'two-paths',
      heading: 'Two customization workflows',
      blocks: [
        { type: 'text', text: 'You can customize reactive skills either through an interactive agent session or by editing the manifest and state slices directly.' },
        { type: 'steps', steps: [
          {
            title: 'Agent-Guided Discovery (Recommended)',
            text: 'Invoke an agent with the skill-manager or reactive-skill-creator skill. The agent conducts a Socratic interview to extract domain phases, guard conditions, and projections, then synthesizes and tests the complete statechart.',
          },
          {
            title: 'Direct CLI & File Customization',
            text: 'Run npx -y @reactive-skills/axi init <name>, then edit skill.yaml to define domain states, author corresponding prompt files under states/, wire guard expressions, and inspect with axi inspect.',
          },
        ] },
      ],
    },
    {
      id: 'agent-guided',
      heading: '1. The Agent-Guided workflow (Recommended)',
      blocks: [
        { type: 'text', text: 'When designing a skill with an agent, the agent runs a five-dimension discovery interview to prevent underspecified states or brittle transitions:' },
        { type: 'list', items: [
          'Workflow Identity & Context: Defines the single objective and required initial variables (e.g. repo_path, branch, pr_id).',
          'State Taxonomy: Identifies chronological macro-phases (e.g. INTAKE → PLAN → EXECUTE → VERIFY → COMPLETE).',
          'Transition Signals & Guards: Names the signals that trigger progress and the exact facts required to advance.',
          'Failure Modes & Rollbacks: Maps where execution returns if tests fail, builds break, or invariants reject.',
          'Deliverable Sinks: Specifies the Handlebars templates folded from event history into .docs/ reports.',
        ] },
        { type: 'callout', variant: 'signal', title: 'Why use agent authoring', text: 'Agents ensure that states remain strictly isolated, guard expressions follow JavaScript syntax, and STATECHART.md stays synchronized with skill.yaml.' },
      ],
    },
    {
      id: 'manifest-customization',
      heading: '2. Customizing skill.yaml (Topology & Guards)',
      blocks: [
        { type: 'text', text: 'Replace the default START state in skill.yaml with your domain workflow phases. Each state declares its prompt template, tool restrictions, and valid transition paths.' },
        { type: 'code', example: {
          language: 'yaml',
          command: `# skills/tdd-flow/skill.yaml
schema_version: "2.1.0"
name: "tdd-flow"
description: "Red-Green-Refactor test-driven development workflow"
initial_state: "INIT"
strict_execution: true
runtime_requirements:
  required_capabilities: ["judgment.probability_thresholds"]
context_keys: ["target_module", "test_file"]

states:
  INIT:
    prompt_template: "states/init.md"
    transitions:
      RUNTIME_READY: { target: "RED_SPEC" }

  RED_SPEC:
    description: "Write failing test specification"
    prompt_template: "states/red_spec.md"
    model:
      tier: "fast"
      suggested: "gemini-2.5-flash / haiku"
    tools: ["view_file", "write_to_file", "run_command"]
    transitions:
      TEST_RAN:
        target: "GREEN_CODE"
        guard: "payload.exit_code != 0"

  GREEN_CODE:
    description: "Implement minimal code to pass test"
    prompt_template: "states/green_code.md"
    model:
      tier: "balanced"
      suggested: "claude-3-7-sonnet"
    tools: ["view_file", "replace_file_content", "run_command"]
    transitions:
      TEST_RAN:
        target: "REFACTOR"
        guard: "payload.exit_code == 0"

  REFACTOR:
    description: "Clean implementation while tests stay green"
    prompt_template: "states/refactor.md"
    model:
      tier: "reasoning"
      suggested: "claude-3-7-sonnet / o3-mini"
    tools: ["view_file", "replace_file_content", "run_command"]
    transitions:
      TEST_RAN:
        target: "COMPLETE"
        guard: "payload.exit_code == 0"
        judgment:
          type: "predicate"
          criterion: "Did the refactoring maintain public APIs without introducing regressions?"
          min_probability: 0.85
          fallback_target: "GREEN_CODE"
      REGRESSION:
        target: "GREEN_CODE"
        guard: "payload.exit_code != 0"

  COMPLETE:
    description: "TDD cycle verified and closed"
    prompt_template: "states/complete.md"`,
          explanation: 'Replaces placeholder states with explicit domain phases, cognitive model tiers, tool constraints, and deterministic or semantic transition guards.',
        } },
      ],
    },
    {
      id: 'prompt-slices',
      heading: '3. Authoring scoped state prompt slices (states/*.md)',
      blocks: [
        { type: 'text', text: 'Each state prompt file contains instructions strictly relevant to that state. Do not include instructions for previous or future phases. The agent receives only the active slice when entering the state.' },
        { type: 'code', example: {
          language: 'markdown',
          command: `<!-- skills/tdd-flow/states/red_spec.md -->
# TDD Flow — RED_SPEC

Write a failing test specification for \`{{context.target_module}}\`.

## Current Objective
1. Inspect \`{{context.target_module}}\` using \`view_file\`.
2. Author unit test cases in \`{{context.test_file}}\`.
3. Run test runner using \`run_command\`.

## Stop Criteria & Signal Contract
When the test suite runs and fails as expected (failing assertion, not compilation crash):
- Emit signal: \`TEST_RAN\`
- Payload facts: \`{"exit_code": 1, "failing_tests": 1}\`

Do NOT attempt to write application logic or make the test pass in this state.`,
          explanation: 'State prompts define strict boundaries: objectives, tool usage, stop criteria, and the exact signal required to advance.',
        } },
        { type: 'callout', variant: 'warn', title: 'Prompt isolation invariant', text: 'Never assume context from earlier turns unless declared in context_keys or passed in signal payloads. Isolated prompts prevent attention drift.' },
      ],
    },
    {
      id: 'guards-and-deliverables',
      heading: '4. Deterministic guards, semantic judgments & deliverables',
      blocks: [
        { type: 'text', text: 'Guards prevent subjective completion claims. Transitions require verified facts, code assertions, or semantic verification:' },
        { type: 'list', items: [
          'Inline expressions: Written in standard JavaScript (e.g. payload.exit_code == 0 && payload.coverage >= 80).',
          'Semantic judgments: Declared via judgment: { type, criterion, min_probability, escalate, fallback_target }. Evaluated via the decoupled Judgment Engine (built-in sandbox or optional @typesafe-ai/sdk-backed Jev System One decisions).',
          'Adapter selection: adapter_hint picks the primary adapter. Without it, Jev is primary whenever it is available. Write exact checks as JavaScript expressions with adapter_hint: script, so the script adapter evaluates them and model probability never decides them. fallback_adapter runs only when the primary adapter fails or its circuit is open; it does not run when the primary returns a low-probability answer. reactive-skills-axi validate warns on an executable predicate without adapter_hint: script.',
          'Fallback routing: When a judgment rejects a result, the FSM transitions to its declared fallback_target state and logs GUARD_FALLBACK_TRIGGERED.',
          'Model outages: When the selected model adapter (Jev or another registered model) is configured but fails, times out, or has an open circuit breaker, a criterion written as a JavaScript expression is still evaluated by the built-in script adapter. A natural-language criterion cannot be judged that way, so the signal is refused, the run stays in its current state without a fallback transition, and the emit result returns refusal_reason. Retry the signal once the model is reachable.',
          'Decisions without a model: When Jev is not configured, the script adapter decides a natural-language criterion from the agent\'s own payload (exit_code or success for predicates, choice for categorical judgments, score for evaluations). The emit result labels these transitions judgment_basis: self_reported, and GUARD_EVALUATED records selfReported: true.',
          'Model capability tiers: Declared via model: { tier: fast | balanced | reasoning | decision } to guide multi-model routing across states.',
          'Custom guard scripts: Placed in guards/<guard_name>.js for complex validation like AST checks or git status verifications.',
          'Guard contracts: guards/*.yaml judgment contracts are design documents. The runtime enforces only the skill.yaml judgment, and reactive-skills-axi validate reports drift between the two.',
          'Deliverable projections: Configured via deliverable_projections in skill.yaml. Handlebars templates (templates/*.hbs) automatically fold the event log into deliverables (.docs/*.md) without requiring manual agent summarization.',
        ] },
      ],
    },
    {
      id: 'judgment-thresholds',
      heading: '5. Judgment probability thresholds',
      blocks: [
        { type: 'text', text: 'Write the probability you mean with min_probability. For a predicate it is compared directly with P(yes). For a categorical judgment it is compared with the probability of the picked label, which must also be one of the options. min_probability is not available on evaluation judgments, and a predicate min_probability must be at least 0.5.' },
        { type: 'text', text: 'An optional escalate band routes grey-zone results to a review state instead of the fallback. A result at or above escalate.min_probability and below min_probability moves to escalate.target. Anything lower moves to fallback_target, or refuses the transition when no fallback_target is declared.' },
        { type: 'code', example: {
          language: 'yaml',
          command: `runtime_requirements:
  required_capabilities: ["judgment.probability_thresholds"]

states:
  REVIEW:
    transitions:
      REVIEW_SUBMITTED:
        target: "MERGE"
        judgment:
          type: "predicate"
          criterion: "Does the diff satisfy every approved acceptance criterion?"
          min_probability: 0.85
          escalate:
            min_probability: 0.3
            target: "HUMAN_REVIEW"
          fallback_target: "REVISE"`,
          explanation: 'P(yes) of 0.85 or more merges, 0.3 up to 0.85 asks a human, and below 0.3 returns to REVISE.',
        } },
        { type: 'text', text: 'The older min_confidence field keeps its meaning. For predicates the runtime reports confidence as |P(yes) - 0.5| * 2, so min_confidence: m requires P(yes) >= 0.5 + m / 2. For categorical judgments min_confidence is compared with the adapter\'s own confidence score, not with the picked label\'s probability. A judgment may set min_probability or min_confidence, not both, and a judgment with neither uses min_confidence 0.75.' },
        { type: 'table', caption: 'Migrating predicate min_confidence to min_probability', columns: ['min_confidence', 'Required P(yes)', 'Equivalent min_probability'], rows: [
          ['0.6', '0.80', '0.8'],
          ['0.7', '0.85', '0.85'],
          ['0.75 (default)', '0.875', '0.875'],
          ['0.85', '0.925', '0.925'],
          ['0.9', '0.95', '0.95'],
        ] },
        { type: 'callout', variant: 'warn', title: 'Require the capability before migrating', text: 'Runtimes before judgment.probability_thresholds drop min_probability and escalate and apply min_confidence 0.75 instead. List judgment.probability_thresholds in runtime_requirements.required_capabilities so an older runtime refuses the skill rather than silently changing its gates. reactive-skills-axi validate warns when the requirement is missing.' },
      ],
    },
    {
      id: 'inspection-verification',
      heading: '6. Inspect and verify your customized skill',
      blocks: [
        { type: 'text', text: 'After updating your manifest and state prompt files, verify the skill topology and transition paths before executing:' },
        { type: 'code', example: {
          language: 'bash',
          command: 'npx -y @reactive-skills/axi inspect skills/tdd-flow',
          explanation: 'Validates statechart hierarchy, signal handlers, and guard syntax in concise TOON output.',
          expectedOutput: `skill: tdd-flow
initial: INIT
states:
  INIT → [RUNTIME_READY] → RED_SPEC
  RED_SPEC → [TEST_RAN (guard: payload.exit_code != 0)] → GREEN_CODE
  GREEN_CODE → [TEST_RAN (guard: payload.exit_code == 0)] → REFACTOR
  REFACTOR → [TEST_RAN (guard: payload.exit_code == 0)] → COMPLETE
  REFACTOR → [REGRESSION (guard: payload.exit_code != 0)] → GREEN_CODE`,
        } },
      ],
    },
    {
      id: 'distribute-sync',
      heading: '7. Distribute to agent satellites with axi sync',
      blocks: [
        { type: 'text', text: 'Once your skill validates cleanly, synchronize it across all local agent harnesses (Claude, Gemini, Codex, Devin, Cline, Copilot) using zero-drift directory junctions:' },
        { type: 'code', example: {
          language: 'bash',
          command: 'npx -y @reactive-skills/axi sync tdd-flow',
          explanation: 'Links the newly authored skill into ~/.agents/skills/ and all detected satellites without copying files.',
        } },
        { type: 'callout', variant: 'signal', title: 'Zero-drift linking', text: 'Directory junctions link ~/.agents/skills/ directly to the authoring repository, ensuring external tools access updated prompt slices without physical file copies.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'Quickstart walkthrough', href: '/docs/quickstart' },
    { title: 'Syncing & distributing skills', href: '/docs/syncing' },
    { title: 'State machine concepts', href: '/docs/concepts' },
    { title: 'AXI CLI reference', href: '/docs/axi' },
    { title: 'Troubleshooting guide', href: '/docs/troubleshooting' },
  ],
};
