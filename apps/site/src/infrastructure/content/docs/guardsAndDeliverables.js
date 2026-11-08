/** @type {import('@/contracts/types').DocPage} */
export const guardsAndDeliverables = {
  slug: 'reference/guards-and-deliverables',
  title: 'Guards, judgments and deliverables reference',
  summary: 'Configure exact checks, semantic judgments, approval and generated files. Start with the authoring guide, then use these details when a workflow needs them.',
  category: 'Reference',
  href: '/docs/reference/guards-and-deliverables',
  sections: [
    {
      id: 'exact-expressions',
      heading: 'Exact expressions',
      blocks: [
        { type: 'text', text: 'Use guard for an exact condition written in standard JavaScript. It checks the supplied data; it does not independently prove that a test ran. A transition with no guard or judgment passes unconditionally.' },
        { type: 'code', example: { language: 'yaml', command: 'guard: "payload.exit_code == 0 && payload.coverage >= 80"' } },
      ],
    },
    {
      id: 'judgment-declaration-and-adapters',
      heading: 'Judgment declaration and adapters',
      blocks: [
        { type: 'text', text: 'Declare judgment: { type, criterion, min_probability, escalate, fallback_target } on a transition. Types are predicate (yes/no), categorical (an option) and evaluation (a score). The Judgment Engine provides a built-in script adapter and optional Jev decisions through @typesafe-ai/sdk.' },
        { type: 'text', text: 'adapter_hint selects the primary adapter. Without it, available Jev is preferred while its circuit allows execution; otherwise script is selected. Exact executable predicates should use adapter_hint: script so a model probability does not decide them. reactive-skills-axi validate warns when that selection is missing.' },
        { type: 'code', example: { language: 'yaml', command: `judgment:
  type: predicate
  criterion: "payload.exit_code == 0"
  adapter_hint: script` } },
        { type: 'text', text: 'fallback_adapter selects an adapter after primary failure or an open circuit. It is not a second opinion on a low-probability result: a returned result goes through the declared threshold bands.' },
      ],
    },
    {
      id: 'context-sent-to-a-model',
      heading: 'Context sent to a model',
      blocks: [
        { type: 'text', text: 'With no input selection declared, Jev sends the whole run context and event payload. context_paths selects dot paths relative to run context; numeric segments index arrays. Selected values arrive under their dot-path keys. Missing paths are omitted without failing the judgment. include_payload: false omits the payload.' },
        { type: 'code', example: { language: 'yaml', command: `runtime_requirements:
  required_capabilities: ["judgment.context_paths"]

# Fields inside judgment:
context_paths: [write_side.deciders, read_projections]
include_payload: false` } },
        { type: 'text', text: 'GUARD_EVALUATED records judgment.contextSent with paths sent, missing paths, includePayload and inputTokens when reported by the model. The script adapter ignores these two legacy scope fields when no newer input options are declared. reactive-skills-axi validate rejects invalid paths and warns when judgment.context_paths is not required. Older runtimes without that capability drop the fields and send the whole context and payload.' },
        { type: 'text', text: 'These legacy fields are not the complete input policy. Current judgments also support payload_paths, required_context_paths and precondition, which prepare input before adapter execution and can reject missing required evidence. See the [judgment input schema](https://github.com/Reactive-Skills/reactive-skills/blob/main/packages/runtime/src/core/judgment-input.ts) for those fields and the judgment.payload_selection capability.' },
      ],
    },
    {
      id: 'rejected-judgment-versus-unavailable-judge',
      heading: 'Rejected judgment versus unavailable judge',
      blocks: [
        { type: 'text', text: 'A rejected judgment can route to fallback_target and record GUARD_FALLBACK_TRIGGERED. A declared escalate band takes priority for results within that band. Without a routing target, the transition refuses.' },
        { type: 'text', text: 'For judgments without total_timeout_ms, the default script fallback evaluates executable criteria even when a configured model fails, times out or has an open circuit. Script cannot independently judge natural language: that gate refuses, stays in its current state without a repair fallback transition, and returns refusal_reason. Retry after model recovery, using a new idempotency key if one was set.' },
        { type: 'text', text: 'Jev counts as configured when a nonblank TYPESAFE_API_KEY is set, even if its SDK is missing or broken. HTTP 401/403 means the key was rejected: stop and ask the user to fix or replace it. Retrying the same key cannot repair it; do not unset TYPESAFE_API_KEY to bypass the gate.' },
        { type: 'text', text: 'An explicitly configured fallback_adapter may provide an independent model decision. total_timeout_ms bounds the adapter cascade; exhausted deadlines, credential rejection and authoring errors follow the [bounded execution policy](https://github.com/Reactive-Skills/reactive-skills/blob/main/packages/runtime/src/core/judgment-engine.ts). Do not treat an unavailable judge as evidence that the submitted work failed.' },
      ],
    },
    {
      id: 'a-person-decides-an-unevaluable-gate',
      heading: 'A person decides an unevaluable gate',
      blocks: [
        { type: 'text', text: 'When no model can judge a natural-language gate, including no configured model, an outage or a rejected key, the runtime can refuse with APPROVAL_REQUESTED. The agent must stop and ask the user to run the returned command in their own interactive terminal from the named workspace.' },
        { type: 'code', example: { language: 'bash', command: 'reactive-skills-axi approve <skill> --job <id>' } },
        { type: 'text', text: 'approve shows each waiting gate and submitted evidence, then requests a one-time code. The code approves; reject rejects. Other nonblank answers retry, up to five wrong answers. Blank lines do not count; ended input cancels without a decision. Use --full to show all evidence when the default display abbreviates it.' },
        { type: 'text', text: 'Approval re-sends the original signal and reports judgment_basis: human. Rejection uses fallback_target when declared, otherwise refuses. MCP has no tool for approving these pending judgment gates; reactive_respond_human handles ordinary authored human gates instead.' },
      ],
    },
    {
      id: 'explicit-self-report-permission',
      heading: 'Explicit self-report permission',
      blocks: [
        { type: 'text', text: 'Only when no model is configured, a user can allow the agent’s payload to decide a natural-language criterion. approve <skill> --allow-self-reported asks for a code and stores a workspace-path-keyed grant in the user’s home, outside workspace state. Copied, committed or restored workspace files cannot enable the grant or undo revocation. It covers the workspace until revoked and never acts as fallback during a configured model outage.' },
        { type: 'code', example: { language: 'bash', command: `reactive-skills-axi approve <skill> --allow-self-reported
reactive-skills-axi approve <skill> --revoke-self-reported` } },
        { type: 'text', text: 'Self-reported predicate decisions use exit_code or success; categorical decisions use choice; evaluations use score. They warn and report judgment_basis: self_reported. Decided judgments record judgment.decidedBy in GUARD_EVALUATED as model, expression, human or self_reported. An unevaluable judgment need not have decidedBy.' },
        { type: 'text', text: 'The script adapter always executes a criterion that is a JavaScript expression. If it throws, such as on a missing field, it rejects rather than consulting the agent’s reported verdict fields.' },
      ],
    },
    {
      id: 'model-capability-hints',
      heading: 'Model capability hints',
      blocks: [
        { type: 'text', text: 'A state can declare model: { tier: fast | balanced | reasoning | decision } to express routing intent. The runtime emits model_contract prompt metadata; it does not enforce a host model switch. See the [manifest model schema](https://github.com/Reactive-Skills/reactive-skills/blob/main/packages/runtime/src/core/types.ts#L486) for the accepted fields.' },
        { type: 'code', example: { language: 'yaml', command: 'model: { tier: reasoning }' } },
      ],
    },
    {
      id: 'custom-guard-modules',
      heading: 'Custom guard modules',
      blocks: [
        { type: 'text', text: 'Use guards/<guard_name>.js for complex checks such as AST analysis or git status. Reference it with guardFunction. Accepted extensions are .js, .mjs and .cjs: .mjs is ESM, .cjs is CommonJS, and .js follows the nearest package.json type, or Node syntax detection when type is absent. reactive-skills-axi validate fails missing files, unsupported extensions and wrong-format modules.' },
        { type: 'code', example: { language: 'yaml', command: 'guardFunction: "guards/check-status.mjs"' } },
      ],
    },
    {
      id: 'useful-refusal-messages',
      heading: 'Useful refusal messages',
      blocks: [
        { type: 'text', text: 'A custom guard can return a boolean or { passed, reason }. A falsy passed refuses with reason. An inline guard can declare guard_message. Without a message, the refusal names the expression or script path.' },
        { type: 'code', example: { language: 'yaml', command: `guard: "payload.exit_code == 0"
guard_message: "Tests must pass before completing."` } },
      ],
    },
    {
      id: 'contract-documents-versus-enforcement',
      heading: 'Contract documents versus enforcement',
      blocks: [
        { type: 'text', text: 'guards/*.yaml judgment contracts are design documents. Runtime judgment enforcement reads skill.yaml. Run reactive-skills-axi validate <path> to detect drift between the manifest judgment and its contract document.' },
      ],
    },
    {
      id: 'generated-deliverables',
      heading: 'Generated deliverables',
      blocks: [
        { type: 'text', text: 'deliverable_projections declares Handlebars templates under templates/*.hbs and workspace-relative outputs such as .docs/*.md. Templates receive recorded events, transitions and run context to generate files without requiring a manual agent summary.' },
        { type: 'code', example: { language: 'yaml', command: `deliverable_projections:
  - template: templates/report.hbs
    output: .docs/report.md
    trigger_on: [REVIEW_SUBMITTED]` } },
        { type: 'text', text: 'On successful transitions, the projection engine renders matching templates. trigger_on matches the triggering signal; omitted or empty trigger_on, * and STATE_TRANSITION match every projection call. It does not subscribe to arbitrary ledger appends. See the [projection schema](https://github.com/Reactive-Skills/reactive-skills/blob/main/packages/runtime/src/core/types.ts#L528) for configuration.' },
      ],
    },
    {
      id: 'judgment-thresholds',
      heading: 'Thresholds and migration',
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
  ],
  relatedPages: [
    { title: 'Authoring skills', href: '/docs/authoring#guards-and-deliverables' },
    { title: 'AXI CLI reference', href: '/docs/axi' },
  ],
};
