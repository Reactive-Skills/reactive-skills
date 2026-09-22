/** @type {import('@/contracts/types').DocPage} */
export const axi = {
  slug: 'axi',
  title: 'Agent eXperience Interface (AXI)',
  summary: 'The Agent eXperience Interface for Reactive Skills: zero daemon overhead, compact TOON formatting (~40% fewer tokens than JSON), deterministic exit codes, and actionable recovery hints on every turn.',
  category: 'Integrate',
  href: '/docs/axi',
  sections: [
    {
      id: 'origin',
      heading: 'Origin & Specification',
      blocks: [
        { type: 'callout', variant: 'signal', title: 'Specification Attribution', text: 'The Agent eXperience Interface (AXI) standard was conceived and specified at [axi.md](http://axi.md). Reactive Skills implements the AXI specification to provide an agent-native, token-efficient command-line interface for reactive workflows.' },
        { type: 'text', text: 'AXI provides a direct, token-efficient interface for agent workflows, while MCP provides host-managed tool integration for clients that need it. Both can drive the same reactive runtime. Explore the full specification, tenets, and community standards at [http://axi.md](http://axi.md).' },
      ],
    },
    {
      id: 'axi-mcp-tradeoffs',
      heading: 'AXI and MCP trade-offs',
      blocks: [
        { type: 'text', text: 'AXI is engineered for direct shell workflows: no background daemon process, deterministic exit codes, and 40% to 80% lower token consumption through Token-Oriented Object Notation (TOON). MCP provides a host-managed tool bridge for clients that need a persistent stdio connection.' },
        { type: 'callout', variant: 'signal', title: 'Runtime interface selection', text: 'INIT checks local AXI and MCP capabilities and versions, then selects one compatible transport for the run. npx is AXI\'s zero-install launcher, not a separate runtime.' },
      ],
    },
    {
      id: 'contract',
      heading: 'The public CLI contract',
      blocks: [
        { type: 'text', text: 'The CLI entrypoint supports a read-only capabilities/version preflight, then can run zero-install via npx or be installed globally with npm i -g @reactive-skills/axi.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi <command> [options]', explanation: 'Available commands: invoke, state, emit, jobs, events, inspect, reset, upgrade, init, view, sync, mcp.' } },
        { type: 'list', items: [
          'axi (dashboard) — lists registered skills, current states, and suggested next actions.',
          'axi --version — prints the installed AXI package version and exits.',
          'axi capabilities --json: reports runtime versions and supported capabilities without creating a job.',
          'axi preflight <skill> --json: validates a skill against its declared runtime requirements without creating a job.',
          'axi invoke <skill> [--payload JSON] [--job <id>] — starts a fresh isolated execution run, auto-generating a unique job ID.',
          'axi state <skill> [--job <id>] — outputs active state, hierarchical path, and allowed transitions (auto-rotates if prior job completed).',
          'axi emit <skill> <signal> — dispatches a typed signal to evaluate guards and advance.',
          'axi jobs [list|switch|archive] <skill> — manages isolated execution runs, active pointer resolution, and deliverable mirroring.',
          'axi inspect <path> — displays complete statechart hierarchy and guard rules.',
          'axi events <skill> [limit] — tails the immutable append-only event ledger.',
          'axi view <skill> [--job <id>] [--port <number>]: launches a job-scoped real-time telemetry server and live visual viewer.',
          'axi dashboard [--host <host>] [--port <port>]: launches one read-only broker for multiple skills and jobs.',
          'axi init <name> — scaffolds a modular reactive skill directory.',
          'axi reset <skill> — resets active execution run while preserving deliverables.',
          'axi sync [skill] — synchronizes skills across authoring workspaces and agent satellites via zero-drift junctions.',
          'axi mcp — launches stdio MCP server for GUI IDE host connectivity.',
        ] },
      ],
    },
    {
      id: 'telemetry-viewer',
      heading: 'Telemetry viewer ports',
      blocks: [
        { type: 'text', text: 'When `--port` is omitted, AXI makes real bind attempts starting at `127.0.0.1:4242` and falls back through a bounded deterministic range if the preferred port is occupied. This applies to both `view` and `dashboard`.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi view my-skill\nnpx -y @reactive-skills/axi dashboard\nnpx -y @reactive-skills/axi dashboard --port 0', explanation: 'Omitted --port enables automatic fallback, an explicit port is strict, and port 0 requests an OS-assigned ephemeral port.' } },
        { type: 'text', text: 'The CLI output and telemetry responses report the actual selected port and URL. The browser viewer uses that reported URL and does not scan local ports automatically.' },
      ],
    },
    {
      id: 'output',
      heading: 'Token-lean output: TOON vs JSON',
      blocks: [
        { type: 'text', text: 'AXI outputs in TOON (Token-Oriented Object Notation) by default. TOON eliminates repetitive braces, quotes, and JSON syntax overhead, saving up to 80% on prompt context tokens while remaining unambiguous for LLM parsers.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi state my-feature-flow', explanation: 'Outputs active state, active path, and available transitions in concise TOON format.', expectedOutput: 'skill: my-feature-flow\nstate: RED_SPEC\npath: [INIT, RED_SPEC]\ntransitions: [TEST_RAN (guard: exit_code != 0) → GREEN_CODE]\nsuggestions: [emit: npx -y @reactive-skills/axi emit my-feature-flow TEST_RAN]' } },
      ],
    },
    {
      id: 'exit-codes',
      heading: 'Deterministic exit codes',
      blocks: [
        { type: 'text', text: 'Exit codes are strictly defined so host scripts and agent harnesses can branch reliably without fragile regex matching on stderr.' },
        { type: 'table', caption: 'AXI Exit Code Contract', columns: ['Code', 'Meaning', 'Recovery Action'], rows: [
          ['0', 'Success / Transition Accepted', 'Proceed to next turn or command.'],
          ['1', 'Usage / Option Error', 'Check CLI syntax via --help and re-run.'],
          ['2', 'Guard Invariant Rejection', 'Inspect GUARD_FAILED event payload, resolve context facts, and re-emit.'],
          ['3', 'Skill Manifest Missing', 'Check skill directory path or run init to scaffold.'],
          ['4', 'Event Store Lock / SQLite Busy', 'Check orphan processes or run migrate --replay.'],
        ] },
      ],
    },
    {
      id: 'errors',
      heading: 'Actionable recovery diagnostics',
      blocks: [
        { type: 'text', text: 'Errors never terminate with raw stack traces. Every error returns a structured failure explanation and concrete recovery instructions.' },
        { type: 'callout', variant: 'warn', title: 'Actionable recovery', text: 'Transition rejected: guard "exit_code == 0" evaluated to false on signal TEST_RAN — recovery: run test suite, correct failing assertions, and re-emit TEST_RAN.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'Quickstart', href: '/docs/quickstart' },
    { title: 'Multi-job telemetry', href: '/telemetry' },
    { title: 'Syncing & distributing skills', href: '/docs/syncing' },
    { title: 'Model Context Protocol (MCP)', href: '/docs/mcp' },
    { title: 'Troubleshooting guide', href: '/docs/troubleshooting' },
  ],
};
