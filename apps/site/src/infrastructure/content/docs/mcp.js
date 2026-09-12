/** @type {import('@/contracts/types').DocPage} */
export const mcp = {
  slug: 'mcp',
  title: 'MCP',
  summary: 'Connect Reactive Skills to any MCP-compatible client — Cursor, Claude Desktop, VS Code, and others — with a single zero-install command.',
  category: 'Integrate',
  href: '/docs/mcp',
  sections: [
    {
      id: 'what',
      heading: 'What MCP gives you',
      blocks: [
        { type: 'text', text: 'The Model Context Protocol (MCP) lets an agent host communicate with external tool servers over a standard interface. Reactive Skills provides an MCP server so your agent client can inspect state, emit signals, evaluate guards, and read event projections without custom harness code.' },
        { type: 'text', text: 'The server exposes tools (state inspection, signal emission, child invocation), resources (event ledgers and projections), and structured error recovery actions.' },
      ],
    },
    {
      id: 'start',
      heading: 'Start the server',
      blocks: [
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi mcp', explanation: 'Launches the Reactive Skills MCP server over stdio using the canonical package entrypoint.', expectedOutput: 'reactive-skills-axi mcp · listening on stdio\nregistered 9 tools · 3 resources\nready' } },
      ],
    },
    {
      id: 'cursor',
      heading: 'Configure Cursor or VS Code',
      blocks: [
        { type: 'text', text: 'Add a server entry to your client’s MCP configuration file.' },
        { type: 'code', example: { language: 'json', command: '{\n  "mcpServers": {\n    "reactive-skills": {\n      "command": "npx",\n      "args": ["-y", "@reactive-skills/axi", "mcp"]\n    }\n  }\n}', explanation: 'Save this to your client’s MCP settings and reload. The reactive-skills MCP server tools will be registered.' } },
      ],
    },
    {
      id: 'claude',
      heading: 'Configure Claude Desktop',
      blocks: [
        { type: 'text', text: 'Claude Desktop uses the same stdio server definition inside its configuration file.' },
        { type: 'code', example: { language: 'json', command: '{\n  "mcpServers": {\n    "reactive-skills": {\n      "command": "npx",\n      "args": ["-y", "@reactive-skills/axi", "mcp"]\n    }\n  }\n}', explanation: 'Save the configuration and restart Claude Desktop to enable reactive state and signal tools.' } },
      ],
    },
    {
      id: 'tools',
      heading: 'Registered tools and capabilities',
      blocks: [
        { type: 'list', items: [
          'reactive_state — read the active state, active path, and context snapshot.',
          'reactive_emit_signal — send a typed signal into the bus to advance the FSM.',
          'reactive_query — run structured queries against the skill state and event ledger.',
          'reactive_query_events — bounded replay of the append-only event stream.',
          'reactive_inspect — inspect statecharts, transitions, and guard contracts.',
          'reactive_invoke_skill — invoke and orchestrate child skills.',
          'reactive_respond_human — respond to Human-in-the-Loop (HITL) review gates.',
          'reactive_migrate — apply schema migrations and WAL recovery to event stores.',
        ] },
      ],
    },
    {
      id: 'recovery',
      heading: 'Failure recovery & structured diagnostics',
      blocks: [
        { type: 'text', text: 'When a guard check or transition fails, the server returns structured error metadata rather than raw stack traces. Each failure specifies what invariant blocked the change and concrete remediation actions.' },
        { type: 'callout', variant: 'danger', title: 'Example recovery payload', text: 'Guard "exit_code == 0" evaluated to false for signal TEST_RAN — recovery: inspect failure output in events ledger, apply code fix, and re-emit TEST_RAN.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'AXI CLI reference', href: '/docs/axi' },
    { title: 'Back to the quickstart', href: '/docs/quickstart' },
    { title: 'Troubleshooting guide', href: '/docs/troubleshooting' },
  ],
};
