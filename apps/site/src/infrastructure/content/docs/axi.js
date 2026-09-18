/** @type {import('@/contracts/types').DocPage} */
export const axi = {
  slug: 'axi',
  title: 'Agent Experience Interface (AXI)',
  summary: 'The primary and preferred interface for Reactive Skills: zero daemon overhead, compact TOON formatting (~40% fewer tokens than JSON), deterministic exit codes, and actionable recovery hints on every turn.',
  category: 'Integrate',
  href: '/docs/axi',
  sections: [
    {
      id: 'why-preferred',
      heading: 'Why AXI is preferred over MCP for agents',
      blocks: [
        { type: 'text', text: 'Most agent harnesses execute shell commands natively. While MCP provides a tool bridge for GUI editors, AXI is engineered specifically for agent workflows: no background daemon processes, no socket or stdio lifecycle issues, and 40% to 80% lower token consumption through Token-Oriented Object Notation (TOON).' },
        { type: 'callout', variant: 'signal', title: 'AXI vs MCP comparison', text: 'AXI executes directly in subshells with zero background process footprint and token-lean TOON output. MCP requires maintaining a long-running stdio daemon and passes verbose JSON envelopes across every tool turn. Prefer AXI whenever shell tools are available.' },
      ],
    },
    {
      id: 'contract',
      heading: 'The public CLI contract',
      blocks: [
        { type: 'text', text: 'The CLI entrypoint is zero-install via npx, or installed globally with npm i -g @reactive-skills/axi.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi <command> [options]', explanation: 'Available commands: init, state, emit, events, inspect, reset, upgrade, view, sync, mcp.' } },
        { type: 'list', items: [
          'axi (dashboard) — lists registered skills, current states, and suggested next actions.',
          'axi state <skill> — outputs active state, hierarchical path, and allowed transitions.',
          'axi emit <skill> <signal> — dispatches a typed signal to evaluate guards and advance.',
          'axi inspect <path> — displays complete statechart hierarchy and guard rules.',
          'axi events <skill> [limit] — tails the immutable append-only event ledger.',
          'axi view <skill> — launches real-time telemetry server and live visual viewer.',
          'axi init <name> — scaffolds a modular reactive skill directory.',
          'axi reset <skill> — resets active execution run while preserving deliverables.',
          'axi sync [skill] — synchronizes skills across authoring workspaces and agent satellites via zero-drift junctions.',
          'axi mcp — launches stdio MCP server for GUI IDE host connectivity.',
        ] },
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
    { title: 'Syncing & distributing skills', href: '/docs/syncing' },
    { title: 'Model Context Protocol (MCP)', href: '/docs/mcp' },
    { title: 'Troubleshooting guide', href: '/docs/troubleshooting' },
  ],
};
