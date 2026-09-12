/** @type {import('@/contracts/types').DocPage} */
export const axi = {
  slug: 'axi',
  title: 'AXI',
  summary: 'AXI — the Agent Experience Interface — standardizes CLI and MCP ergonomics for AI agents: compact TOON output, deterministic exit codes, structured results, and actionable recovery.',
  category: 'Integrate',
  href: '/docs/axi',
  sections: [
    {
      id: 'what',
      heading: 'AXI is behaviour, not branding',
      blocks: [
        { type: 'text', text: 'AXI establishes strict interface guarantees because the primary consumer is often an LLM or autonomous agent harness. Every command produces token-efficient, highly parseable output that prevents hallucination.' },
      ],
    },
    {
      id: 'contract',
      heading: 'The public CLI contract',
      blocks: [
        { type: 'text', text: 'The public entry point is always zero-install via npx, or installed globally via npm.' },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi <command> [options]', explanation: 'Available commands: init, state, emit, events, inspect, reset, mcp.' } },
      ],
    },
    {
      id: 'output',
      heading: 'Output conventions: TOON & JSON',
      blocks: [
        { type: 'list', items: [
          'TOON format by default — Token-Oriented Object Notation cuts verbosity by up to 80% while retaining structural clarity.',
          'Structured on request — add --json to receive raw JSON payloads for programmatic consumers.',
          'Traceable — every state change and event records correlation_id and causation_id.',
        ] },
        { type: 'code', example: { language: 'bash', command: 'npx -y @reactive-skills/axi state my-feature-flow --toon', explanation: 'Outputs active state, active path, and available transitions in concise TOON format.', expectedOutput: 'skill: my-feature-flow\nstate: RED_SPEC\npath: [INIT, RED_SPEC]\ntransitions: [TEST_RAN (guard: exit_code != 0) → GREEN_CODE]' } },
      ],
    },
    {
      id: 'exit-codes',
      heading: 'Deterministic exit codes',
      blocks: [
        { type: 'text', text: 'Exit codes are strictly defined so host scripts and agents can branch reliably without fragile string matching.' },
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
      heading: 'Recovery-oriented diagnostics',
      blocks: [
        { type: 'text', text: 'Errors never terminate with bare stack traces. Every error returns a structured failure explanation and concrete recovery instructions.' },
        { type: 'callout', variant: 'warn', title: 'Actionable recovery', text: 'Transition rejected: guard "exit_code == 0" evaluated to false — recovery: run test suite, correct failing assertions, and re-emit TEST_RAN.' },
      ],
    },
  ],
  relatedPages: [
    { title: 'Set up MCP', href: '/docs/mcp' },
    { title: 'Review the concepts', href: '/docs/concepts' },
    { title: 'Troubleshooting guide', href: '/docs/troubleshooting' },
  ],
};
