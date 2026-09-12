/** @type {import('@/contracts/types').DocPage} */
export const quickstart = {
  slug: 'quickstart',
  title: 'Quickstart',
  summary: 'Scaffold, inspect, connect, and drive a reactive skill in about five minutes. Everything runs through one zero-install path.',
  category: 'Get started',
  href: '/docs/quickstart',
  sections: [
    {
      id: 'prereqs',
      heading: 'Prerequisites',
      blocks: [
        { type: 'text', text: 'You need Node.js 22 or newer. You do not need to install anything globally — all commands below use the zero-install npx path, or you can install globally with npm i -g @reactive-skills/axi.' },
        { type: 'code', example: { language: 'bash', command: 'node --version', explanation: 'Node 22.x or newer recommended.', expectedOutput: 'v22.13.0' } },
      ],
    },
    {
      id: 'zero-install',
      heading: 'Start the MCP server',
      blocks: [
        { type: 'text', text: 'The canonical way to run Reactive Skills with agent hosts (Cursor, Claude Desktop, VS Code) is through the stdio MCP server.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi mcp', explanation: 'Starts the Reactive Skills MCP server over stdio for agent host connectivity.', expectedOutput: 'reactive-skills-axi mcp · listening on stdio\nregistered 6 tools · 3 resources\nready' } },
      ],
    },
    {
      id: 'scaffold',
      heading: 'Manage skills with skill-manager',
      blocks: [
        { type: 'text', text: 'Rather than crafting state files manually, rely on skill-manager to scaffold and govern modular skills. Each skill defines its workflow structure and transitions declaratively in STATECHART.md.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi init my-feature-flow', explanation: 'Scaffolds a modular reactive skill directory with skill.yaml, STATECHART.md, and state prompt slices.', expectedOutput: 'created skills/my-feature-flow\n  manifest: skills/my-feature-flow/skill.yaml\n  statechart: skills/my-feature-flow/STATECHART.md\n  initial state: INTAKE' } },
      ],
    },
    {
      id: 'inspect',
      heading: 'Inspect the statechart',
      blocks: [
        { type: 'text', text: 'Before running a skill, inspect its state hierarchy, transition rules, and deterministic guards in structured TOON format.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi inspect skills/my-feature-flow', explanation: 'Outputs the skill statechart, active transition paths, and guard expressions.', expectedOutput: 'skill: my-feature-flow\ninitial: INTAKE\nstates:\n  INTAKE → [RUNTIME_READY] → RED_SPEC\n  RED_SPEC → [TEST_RAN (exit_code != 0)] → GREEN_CODE\n  GREEN_CODE → [TEST_RAN (exit_code == 0)] → REFACTOR' } },
      ],
    },
    {
      id: 'emit',
      heading: 'Emit signals to drive progress',
      blocks: [
        { type: 'text', text: 'Reactive skills advance by receiving typed signals. Guards evaluate context facts deterministically before transitions occur.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi emit my-feature-flow RUNTIME_READY', explanation: 'Emits a signal into the event bus, advancing the skill machine to its next state.', expectedOutput: 'state: RED_SPEC\ntransition: INTAKE → RED_SPEC via RUNTIME_READY\nguard: passed' } },
      ],
    },
    {
      id: 'events',
      heading: 'Tail the immutable event ledger',
      blocks: [
        { type: 'text', text: 'Every transition, guard check, and signal is appended to an immutable event store. You can query the event stream at any time.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi events my-feature-flow --last 5', explanation: 'Reads the authoritative event log for audit and projection replay.', expectedOutput: '#1  SKILL_INITIALIZED   state: INTAKE\n#2  SIGNAL_EMITTED      signal: RUNTIME_READY\n#3  GUARD_EVALUATED     guard: true (passed)\n#4  STATE_TRANSITION    INTAKE → RED_SPEC\n#5  STATE_ENTRY_HOOK    state: RED_SPEC' } },
        { type: 'callout', variant: 'signal', title: 'Universal contract', text: 'All examples and agent integrations work through npx -y @reactive-skills/axi, ensuring identical execution locally and in CI.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'Connect a client with MCP', href: '/docs/mcp' },
    { title: 'Understand the concepts', href: '/docs/concepts' },
    { title: 'AXI CLI reference', href: '/docs/axi' },
  ],
};
