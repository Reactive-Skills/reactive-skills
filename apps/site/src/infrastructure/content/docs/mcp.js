/** @type {import('@/contracts/types').DocPage} */
export const mcp = {
  slug: 'mcp',
  title: 'Model Context Protocol (MCP)',
  summary: 'Connect Reactive Skills as a stdio tool server for GUI agent environments and host-integrated tool workflows.',
  category: 'Integrate',
  href: '/docs/mcp',
  sections: [
    {
      id: 'what',
      heading: 'MCP as a host-integrated transport',
      blocks: [
        { type: 'text', text: 'The Model Context Protocol (MCP) enables GUI agent hosts to interact with external tools over JSON-RPC. Use it when the host provides MCP tool integration or when a persistent stdio bridge fits the workflow.' },
        { type: 'callout', variant: 'signal', title: 'Local-first runtime selection', text: 'During INIT, Reactive Skills checks MCP and AXI capabilities and versions, then selects one compatible local transport for the run. AXI remains available through a direct command or its npx zero-install launcher.' },
        { type: 'text', text: 'When attached, the Reactive Skills MCP server exposes 10 tools for state inspection, signal emission, query execution, sync distribution, and migration, alongside append-only event resources.' },
      ],
    },
    {
      id: 'start',
      heading: 'Start the stdio server',
      blocks: [
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi mcp', explanation: 'Launches the Reactive Skills MCP server over stdio using the unified package entrypoint.', expectedOutput: 'reactive-skills-axi mcp · listening on stdio\nregistered 10 tools · 3 resources\nready' } },
      ],
    },
    {
      id: 'cursor',
      heading: 'Configure Cursor or VS Code',
      blocks: [
        { type: 'text', text: 'Add the server definition to your client’s MCP settings configuration file.' },
        { type: 'code', example: { language: 'json', command: '{\n  "mcpServers": {\n    "reactive-skills": {\n      "command": "npx",\n      "args": ["-y", "@reactive-skills/axi", "mcp"]\n    }\n  }\n}', explanation: 'Add to client MCP settings and reload. The reactive runtime tools will be registered automatically.' } },
      ],
    },
    {
      id: 'claude',
      heading: 'Configure Claude Desktop',
      blocks: [
        { type: 'text', text: 'Claude Desktop consumes the same stdio server definition inside its config file.' },
        { type: 'code', example: { language: 'json', command: '{\n  "mcpServers": {\n    "reactive-skills": {\n      "command": "npx",\n      "args": ["-y", "@reactive-skills/axi", "mcp"]\n    }\n  }\n}', explanation: 'Save configuration and restart Claude Desktop to enable reactive state and signal tools.' } },
      ],
    },
    {
      id: 'tools',
      heading: 'Registered tools and capabilities',
      blocks: [
        { type: 'list', items: [
          'reactive_state — read the active state, active path, and context snapshot.',
          'reactive_emit_signal — dispatch a typed signal into the bus to advance the FSM.',
          'reactive_query — run structured queries against the skill state and event ledger.',
          'reactive_query_events — bounded replay of the append-only event stream.',
          'reactive_inspect — inspect statecharts, transitions, and guard contracts.',
          'reactive_invoke_skill — invoke and orchestrate child skills.',
          'reactive_respond_human — respond to Human-in-the-Loop (HITL) review gates.',
          'reactive_reset — reset active execution run while preserving deliverables.',
          'reactive_sync — synchronize skills across authoring workspaces and agent satellites via zero-drift junctions.',
          'reactive_migrate — apply schema migrations and WAL recovery to event stores.',
        ] },
      ],
    },
    {
      id: 'recovery',
      heading: 'Structured failure diagnostics',
      blocks: [
        { type: 'text', text: 'When a guard check or transition fails, the server returns structured error metadata rather than raw stack traces. Each failure specifies what invariant failed and the concrete remediation action.' },
        { type: 'callout', variant: 'danger', title: 'Example recovery payload', text: 'Guard "exit_code == 0" evaluated to false on signal TEST_RAN — recovery: inspect failure output in events ledger, apply code fix, and re-emit TEST_RAN.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'AXI CLI reference', href: '/docs/axi' },
    { title: 'Syncing & distributing skills', href: '/docs/syncing' },
    { title: 'Back to the quickstart', href: '/docs/quickstart' },
    { title: 'Troubleshooting guide', href: '/docs/troubleshooting' },
  ],
};
