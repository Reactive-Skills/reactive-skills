/** @type {import('@/contracts/types').DocPage} */
export const quickstart = {
  slug: 'quickstart',
  title: 'Quickstart',
  summary: 'Scaffold, inspect, and advance a reactive skill in five minutes with local-first AXI or MCP runtime selection.',
  category: 'Get started',
  href: '/docs/quickstart',
  sections: [
    {
      id: 'prereqs',
      heading: 'Prerequisites',
      blocks: [
        { type: 'text', text: 'Node.js 22 or newer required. Commands execute directly without global installation via npx, or install globally with npm i -g @reactive-skills/axi.' },
        { type: 'code', example: { language: 'bash', command: 'node --version', explanation: 'Node 22.x or newer recommended.', expectedOutput: 'v22.13.0' } },
      ],
    },
    {
      id: 'runtime-selection',
      heading: '1. Select a compatible local runtime',
      blocks: [
        { type: 'text', text: 'During INIT, Reactive Skills checks local MCP and AXI capabilities and versions, selects one compatible runtime, and reuses it for the run. AXI remains the runtime interface, and npx is its zero-install launcher when a direct command is not installed.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi', explanation: 'Launches the AXI dashboard to inspect registered skills, active states, and recommended actions.', expectedOutput: 'bin: reactive-skills-axi\ndescription: AXI-compliant CLI for Reactive Skills Architecture\ncount: 1 skill total\nskills:\n  tdd-refactor: state RED_SPEC (path: [RED_SPEC])\nsuggestions:\n  emit: npx -y @reactive-skills/axi emit tdd-refactor TEST_RAN' } },
      ],
    },
    {
      id: 'scaffold',
      heading: '2. Scaffold and customize a reactive skill',
      blocks: [
        { type: 'text', text: 'Generate a modular reactive skill directory. The init command scaffolds a verified baseline containing runtime bootloader states (INIT, SETUP_MCP), a starter domain state, strict execution safeguards (BYPASS_DETECTED), and initial prompt templates.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi init my-feature-flow', explanation: 'Initializes a new reactive skill in skills/my-feature-flow/.', expectedOutput: 'created skills/my-feature-flow\n  manifest: skills/my-feature-flow/skill.yaml\n  statechart: skills/my-feature-flow/STATECHART.md\n  initial state: INIT' } },
        { type: 'text', text: 'Scaffolding gives you the execution harness; customization shapes your domain workflow. You replace the placeholder states in skill.yaml with your chronological phases (e.g. RED_SPEC → GREEN_CODE → REFACTOR), author isolated prompt slices in states/*.md, and attach deterministic guard expressions to gate progress.' },
        { type: 'callout', variant: 'info', title: 'Two customization approaches', text: 'You can edit skill.yaml and states/*.md directly in your editor, or use an agent equipped with skill-manager to conduct an interactive Socratic discovery interview and auto-generate verified states.' },
      ],
    },
    {
      id: 'inspect',
      heading: '3. Inspect the statechart & guards',
      blocks: [
        { type: 'text', text: 'Inspect the state machine hierarchy, valid transition paths, and deterministic guard expressions in concise TOON format before executing.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi inspect skills/my-feature-flow', explanation: 'Outputs states, transitions, signals, and guard conditions.', expectedOutput: 'skill: my-feature-flow\ninitial: INTAKE\nstates:\n  INTAKE → [RUNTIME_READY] → RED_SPEC\n  RED_SPEC → [TEST_RAN (exit_code != 0)] → GREEN_CODE\n  GREEN_CODE → [TEST_RAN (exit_code == 0)] → REFACTOR' } },
      ],
    },
    {
      id: 'emit',
      heading: '4. Emit signals to advance state',
      blocks: [
        { type: 'text', text: 'Advance the state machine by dispatching typed signals. Deterministic guards evaluate context facts before transitions fire; rejected guards output immediate remediation actions.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi emit my-feature-flow RUNTIME_READY', explanation: 'Dispatches a signal into the event bus, advancing to the target state upon guard validation.', expectedOutput: 'state: RED_SPEC\ntransition: INTAKE → RED_SPEC via RUNTIME_READY\nguard: passed' } },
      ],
    },
    {
      id: 'events',
      heading: '5. Tail the immutable event ledger',
      blocks: [
        { type: 'text', text: 'Every signal, guard evaluation, and state transition appends to the authoritative event store (.reactive/skills/<skill>/events.jsonl + SQLite).' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi events my-feature-flow --last 5', explanation: 'Reads the append-only event ledger for audit and projection verification.', expectedOutput: '#1  SKILL_INITIALIZED   state: INTAKE\n#2  SIGNAL_EMITTED      signal: RUNTIME_READY\n#3  GUARD_EVALUATED     guard: true (passed)\n#4  STATE_TRANSITION    INTAKE → RED_SPEC\n#5  STATE_ENTRY_HOOK    state: RED_SPEC' } },
      ],
    },
    {
      id: 'mcp-bridge',
      heading: '2. Connect MCP for host-integrated workflows',
      blocks: [
        { type: 'text', text: 'When the host uses MCP tool integration, run the stdio server from the same package. The MCP transport exposes the same reactive runtime through host-managed tools.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi mcp', explanation: 'Starts the stdio MCP server, exposing 9 tools and 3 resources to MCP clients.', expectedOutput: 'reactive-skills-axi mcp · listening on stdio\nregistered 9 tools · 3 resources\nready' } },
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
