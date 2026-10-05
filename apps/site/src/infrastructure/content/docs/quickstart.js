/** @type {import('@/contracts/types').DocPage} */
export const quickstart = {
  slug: 'quickstart',
  title: 'Quickstart',
  summary: 'Run a published reactive skill, then scaffold, inspect, and advance your own in five minutes with local-first AXI or MCP runtime selection.',
  category: 'Get started',
  href: '/docs/quickstart',
  sections: [
    {
      id: 'prereqs',
      heading: 'Prerequisites',
      blocks: [
        { type: 'text', text: 'Node.js 22.13 or newer required, because the runtime uses the built-in node:sqlite module. Commands execute directly without global installation via npx, or install globally with npm i -g @reactive-skills/axi.' },
        { type: 'code', example: { language: 'bash', command: 'node --version', explanation: 'Node 22.13.0 or newer required.', expectedOutput: 'v22.13.0' } },
      ],
    },
    {
      id: 'use-published-skill',
      heading: '1. Install and run a published skill',
      blocks: [
        { type: 'text', text: 'The shortest path is a workflow someone already published. Install one skill from the Reactive-Skills/skills catalog with skills.sh. The -g flag installs it into ~/.agents/skills, where the runtime looks for installed skills.' },
        { type: 'code', example: { language: 'bash', command: 'npx skills add Reactive-Skills/skills --skill tdd-refactor -g', explanation: 'Installs the tdd-refactor skill for every detected agent.', expectedOutput: 'Installed 1 skill\n  ✓ ~/.agents/skills/tdd-refactor' } },
        { type: 'text', text: 'Then ask your agent to use the tdd-refactor skill. Its SKILL.md bootloader tells the agent to start a run through the runtime, so the agent reads one state prompt at a time instead of the whole workflow. You can start the same run from a terminal to see what the first state returns.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi invoke tdd-refactor', explanation: 'Starts a run in the INIT state and prints its prompt. The agent follows the prompt, then emits the signal it names to advance.', expectedOutput: 'invoke:\n  skill_id: tdd-refactor\n  current_state: INIT\n  run_id: <run-id>\n  event_id: <event-id>\nprompt:\n  raw_prompt: "...# tdd-refactor - INIT\\n\\nVerify access to the reactive runtime..."\n  allowed_tools: none\n  exit_conditions: "2"' } },
      ],
    },
    {
      id: 'runtime-selection',
      heading: '2. Select a compatible local runtime',
      blocks: [
        { type: 'text', text: 'During INIT, Reactive Skills checks local MCP and AXI capabilities and versions, selects one compatible runtime, and reuses it for the run. AXI remains the runtime interface, and npx is its zero-install launcher when a direct command is not installed.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi', explanation: 'Launches the AXI dashboard to list installed skills and their initial states (output trimmed).', expectedOutput: 'count: 1 skill total\nskills[1]:\n  -\n    "skills[0]":\n      name: tdd-refactor\n      initial_state: INIT\n      path: ~/.agents/skills/tdd-refactor' } },
      ],
    },
    {
      id: 'scaffold',
      heading: '3. Scaffold and customize a reactive skill',
      blocks: [
        { type: 'text', text: 'Generate a modular reactive skill directory. The init command scaffolds a verified baseline containing runtime bootloader states (INIT, SETUP_MCP), a starter domain state, strict execution safeguards (BYPASS_DETECTED), and initial prompt templates.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi init my-feature-flow', explanation: 'Initializes a new reactive skill in skills/my-feature-flow/.', expectedOutput: 'ok: created skill my-feature-flow at skills/my-feature-flow/' } },
        { type: 'text', text: 'Scaffolding gives you the execution harness; customization shapes your domain workflow. You replace the placeholder states in skill.yaml with your chronological phases (e.g. RED_SPEC → GREEN_CODE → REFACTOR), author isolated prompt slices in states/*.md, and attach deterministic guard expressions to gate progress.' },
        { type: 'callout', variant: 'info', title: 'Two customization approaches', text: 'You can edit skill.yaml and states/*.md directly in your editor, or use an agent equipped with skill-manager to conduct an interactive Socratic discovery interview and auto-generate verified states.' },
      ],
    },
    {
      id: 'inspect',
      heading: '4. Inspect the statechart & guards',
      blocks: [
        { type: 'text', text: 'Inspect the state machine hierarchy, valid transition paths, and deterministic guard expressions in concise TOON format before executing.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi inspect skills/my-feature-flow', explanation: 'Outputs states, transitions, signals, and guard conditions (output trimmed).', expectedOutput: 'skill:\n  name: my-feature-flow\n  initial_state: INIT\n  state_count: "6"\n  transition_count: "5"\ntransitions[5]{from_state,signal,target,guard}:\n  INIT,RUNTIME_READY,START,""\n  INIT,SETUP_REQUIRED,SETUP_MCP,""\n  SETUP_MCP,SETUP_COMPLETE,START,payload.exit_code == 0\n  SETUP_MCP,SETUP_FAILED,ERROR,payload.exit_code != 0\n  START,DONE,DONE,""' } },
      ],
    },
    {
      id: 'emit',
      heading: '5. Emit signals to advance state',
      blocks: [
        { type: 'text', text: 'Advance the state machine by dispatching typed signals. Deterministic guards evaluate context facts before transitions fire; rejected guards output immediate remediation actions.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi emit my-feature-flow RUNTIME_READY', explanation: 'Dispatches a signal into the event bus, advancing to the target state upon guard validation (output trimmed).', expectedOutput: 'emit:\n  skill_id: my-feature-flow\n  signal: RUNTIME_READY\n  transitioned: "true"\n  previous_state: INIT\n  current_state: START' } },
      ],
    },
    {
      id: 'events',
      heading: '6. Tail the immutable event ledger',
      blocks: [
        { type: 'text', text: 'Every signal, guard evaluation, and state transition appends to the authoritative event store (.reactive/skills/<skill>/events.jsonl + SQLite).' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi events 5 my-feature-flow', explanation: 'Reads the last 5 entries of the append-only event ledger for audit and projection verification.', expectedOutput: 'count: 5 events shown\nevents[5]{seq,timestamp,type,state}:\n  "2",<timestamp>,STATE_VISITED,INIT\n  "3",<timestamp>,SIGNAL_EMITTED,INIT\n  "4",<timestamp>,GUARD_EVALUATED,INIT\n  "5",<timestamp>,STATE_TRANSITION,START\n  "6",<timestamp>,STATE_VISITED,START' } },
      ],
    },
    {
      id: 'mcp-bridge',
      heading: 'Optional: connect MCP for host-integrated workflows',
      blocks: [
        { type: 'text', text: 'When the host uses MCP tool integration, run the stdio server from the same package. The MCP transport exposes the same reactive runtime through host-managed tools.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi mcp', explanation: 'Starts the stdio MCP server. It prints nothing and waits for an MCP client to connect over stdin and stdout.' } },
        { type: 'callout', variant: 'signal', title: 'Runtime selection', text: 'INIT selects a compatible local transport and persists it for the run. AXI provides token-lean shell output, while MCP provides host-integrated tools. The npx command launches AXI without a separate installation.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'Authoring & customizing skills', href: '/docs/authoring' },
    { title: 'AXI CLI reference', href: '/docs/axi' },
    { title: 'Connect a client with MCP', href: '/docs/mcp' },
    { title: 'Understand the concepts', href: '/docs/concepts' },
  ],
};
