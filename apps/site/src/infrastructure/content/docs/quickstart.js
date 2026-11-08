import { CREATE_SKILL_PROMPT, USE_SKILL_PROMPT } from '@/lib/skillPrompts';

/** @type {import('@/contracts/types').DocPage} */
export const quickstart = {
  slug: 'quickstart',
  title: 'Quickstart',
  summary: 'Use a published skill or create one with your agent. Start with a prompt; manual runtime commands are optional.',
  category: 'Get started',
  href: '/docs/quickstart',
  sections: [
    {
      id: 'choose-a-path',
      heading: 'Use a skill or create one',
      blocks: [
        { type: 'text', text: 'Choose [Use a skill](/docs/quickstart#use-published-skill) for an existing workflow, or [Create a skill with your agent](/docs/quickstart#create-a-skill) for a new one. Install the skill, then copy the prompt into your coding agent.' },
      ],
    },
    {
      id: 'prereqs',
      heading: 'Prerequisites',
      blocks: [
        { type: 'text', text: 'Node.js 22.13 or newer is required for the runtime. Use a coding agent with shell access, such as Claude Code or Codex.' },
        { type: 'code', example: { language: 'bash', command: 'node --version', explanation: 'Node 22.13.0 or newer required.', expectedOutput: 'v22.13.0' } },
      ],
    },
    {
      id: 'use-published-skill',
      heading: '1. Use a skill',
      blocks: [
        { type: 'text', text: 'Choose a workflow from the [registry](/registry). Here is tdd-refactor as an example.' },
        { type: 'callout', variant: 'warn', title: 'Install only skills you trust', text: 'Skills can run guard code with the full privileges of your account. The runtime does not sandbox that code. Review guards before installing or updating a skill; static vetting is optional. See [SECURITY.md](https://github.com/Reactive-Skills/reactive-skills/blob/main/SECURITY.md) for the trust model.' },
        { type: 'code', example: { language: 'bash', command: 'npx skills add Reactive-Skills/skills --skill tdd-refactor -g', explanation: 'Install tdd-refactor with skills.sh.' } },
        { type: 'text', text: 'Then ask your agent:' },
        { type: 'code', example: { language: 'text', command: USE_SKILL_PROMPT } },
        { type: 'text', text: 'First, expect a runtime compatibility check before the task begins. You are done with setup when the agent starts your task. Continue in the same conversation.' },
      ],
    },
    {
      id: 'create-a-skill',
      heading: '2. Create a skill with your agent',
      blocks: [
        { type: 'text', text: 'Ask your agent to use skill-manager. It asks about missing requirements, shows a plan, and builds after you approve.' },
        { type: 'code', example: { language: 'bash', command: 'npx skills add Reactive-Skills/skills --skill skill-manager -g', explanation: 'Get skill-manager with skills.sh.' } },
        { type: 'code', example: { language: 'text', command: CREATE_SKILL_PROMPT } },
        { type: 'text', text: 'The first response checks prerequisites and asks for missing details. Review the file plan before approving it. You are done when the approved files are created and the agent reports their validation results.' },
        { type: 'callout', variant: 'info', title: 'Before authoring', text: 'Skill-manager must run from a registered authoring source, the folder where editable skill files live, with a compatible runtime. It asks you to select a source when needed and reports unavailable prerequisites without installing or configuring them. See [source configuration](/docs/syncing#axi-sync-cli).' },
      ],
    },
    {
      id: 'run-it-yourself',
      heading: 'Run a skill yourself (optional)',
      blocks: [
        { type: 'text', text: 'For direct runtime inspection, you can run these commands yourself. They are optional: the agent uses the runtime when you ask it to use a skill. Start an installed skill with invoke and follow the returned state instructions.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi invoke tdd-refactor', explanation: 'Starts a run in the INIT state and prints its prompt. The agent follows the prompt, then emits the signal it names to advance.', expectedOutput: 'invoke:\n  skill_id: tdd-refactor\n  current_state: INIT\n  run_id: <run-id>\n  event_id: <event-id>\nprompt:\n  raw_prompt: "...# tdd-refactor - INIT\\n\\nVerify access to the reactive runtime..."\n  allowed_tools: none\n  exit_conditions: "2"' } },
      ],
    },
    {
      id: 'runtime-selection',
      heading: 'Optional: inspect local runtime selection',
      blocks: [
        { type: 'text', text: 'During INIT, Reactive Skills checks local MCP and AXI capabilities and versions, selects one compatible runtime, and reuses it for the run. AXI remains the runtime interface, and npx is its zero-install launcher when a direct command is not installed.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi', explanation: 'Launches the AXI dashboard to list installed skills and their initial states (output trimmed).', expectedOutput: 'count: 1 skill total\nskills[1]:\n  -\n    "skills[0]":\n      name: tdd-refactor\n      initial_state: INIT\n      path: ~/.agents/skills/tdd-refactor' } },
      ],
    },
    {
      id: 'scaffold',
      heading: 'Optional: scaffold and customize a skill yourself',
      blocks: [
        { type: 'text', text: 'Generate a modular reactive skill directory. The init command scaffolds a verified baseline containing runtime bootloader states (INIT, SETUP_MCP), a starter domain state, strict execution safeguards (BYPASS_DETECTED), and initial prompt templates.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi init my-feature-flow', explanation: 'Initializes a new reactive skill in skills/my-feature-flow/.', expectedOutput: 'ok: created skill my-feature-flow at skills/my-feature-flow/' } },
        { type: 'text', text: 'Scaffolding gives you the execution harness; customization shapes your domain workflow. You replace the placeholder states in skill.yaml with your chronological phases (e.g. RED_SPEC → GREEN_CODE → REFACTOR), author isolated prompt slices in states/*.md, and attach deterministic guard expressions to gate progress.' },
        { type: 'callout', variant: 'info', title: 'Two customization approaches', text: 'You can edit skill.yaml and states/*.md directly in your editor, or use an agent equipped with skill-manager to conduct an interactive Socratic discovery interview and auto-generate verified states.' },
      ],
    },
    {
      id: 'inspect',
      heading: 'Optional: inspect the statechart & guards',
      blocks: [
        { type: 'text', text: 'Inspect the state machine hierarchy, valid transition paths, and deterministic guard expressions in concise TOON format before executing.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi inspect skills/my-feature-flow', explanation: 'Outputs states, transitions, signals, and guard conditions (output trimmed).', expectedOutput: 'skill:\n  name: my-feature-flow\n  initial_state: INIT\n  state_count: "6"\n  transition_count: "5"\ntransitions[5]{from_state,signal,target,guard}:\n  INIT,RUNTIME_READY,START,""\n  INIT,SETUP_REQUIRED,SETUP_MCP,""\n  SETUP_MCP,SETUP_COMPLETE,START,payload.exit_code == 0\n  SETUP_MCP,SETUP_FAILED,ERROR,payload.exit_code != 0\n  START,DONE,DONE,""' } },
      ],
    },
    {
      id: 'emit',
      heading: 'Optional: emit signals to advance state',
      blocks: [
        { type: 'text', text: 'Advance the state machine by dispatching typed signals. Deterministic guards evaluate context facts before transitions fire; rejected guards output immediate remediation actions.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi emit my-feature-flow RUNTIME_READY', explanation: 'Dispatches a signal into the event bus, advancing to the target state upon guard validation (output trimmed).', expectedOutput: 'emit:\n  skill_id: my-feature-flow\n  signal: RUNTIME_READY\n  transitioned: "true"\n  previous_state: INIT\n  current_state: START' } },
      ],
    },
    {
      id: 'events',
      heading: 'Optional: read the event ledger',
      blocks: [
        { type: 'text', text: 'Every signal, guard evaluation, and state transition appends to the authoritative event store (.reactive/skills/<skill>/events.jsonl + SQLite).' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi events 5 my-feature-flow', explanation: 'Reads the last 5 entries of the append-only event ledger for audit and projection verification.', expectedOutput: 'count: 5 events shown\nevents[5]{seq,timestamp,type,state}:\n  "2",<timestamp>,STATE_VISITED,INIT\n  "3",<timestamp>,SIGNAL_EMITTED,INIT\n  "4",<timestamp>,GUARD_EVALUATED,INIT\n  "5",<timestamp>,STATE_TRANSITION,START\n  "6",<timestamp>,STATE_VISITED,START' } },
      ],
    },
    {
      id: 'watch-runs',
      heading: 'Optional: watch runs from inside Claude Code',
      blocks: [
        { type: 'text', text: 'The bq-vitals mod shows the active skill and state in the Claude Code status line, draws a live map of the state machine with /flow, and prints the path a finished run took with /flow-plan. It only reads the event ledger and the skill statechart.' },
        { type: 'code', example: { language: 'text', command: '/plugin install bq-vitals --marketplace Reactive-Skills/reactive-skills', explanation: 'Type this at the Claude Code prompt, not in a shell. Answer y to add the marketplace, then pick a scope. See the [Mods page](/mods) for details.' } },
      ],
    },
    {
      id: 'mcp-bridge',
      heading: 'Optional: connect MCP for host-integrated workflows',
      blocks: [
        { type: 'text', text: 'When the host uses MCP tool integration, run the stdio server from the same package. The MCP transport exposes the same reactive runtime through host-managed tools.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi mcp', explanation: 'Starts the stdio MCP server. It prints nothing and waits for an MCP client to connect over stdin and stdout.' } },
        { type: 'callout', variant: 'signal', title: 'Runtime selection', text: 'INIT selects a compatible local transport and persists it for the run. AXI provides compact, line-oriented TOON shell output, while MCP provides host-integrated tools. The npx command launches AXI without a separate installation.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'Authoring & customizing skills', href: '/docs/authoring' },
    { title: 'AXI CLI reference', href: '/docs/axi' },
    { title: 'Connect a client with MCP', href: '/docs/mcp' },
    { title: 'Understand the concepts', href: '/docs/concepts' },
    { title: 'Mods for Claude Code', href: '/mods' },
  ],
};
