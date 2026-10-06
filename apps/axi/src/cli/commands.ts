/**
 * Registry of every AXI subcommand. The CLI dispatches through this table, and
 * `tests/commands/help-cli.test.ts` runs `--help` and `-h` against every entry.
 */
export interface CommandSpec {
  /**
   * Printed for `--help` or `-h` before the command module is loaded, so help never does work.
   * Omit it only when the command prints its own help without side effects.
   */
  usage?: string;
  /** Runs the command. Returns text for stdout, or nothing when the command wrote its own output. */
  run: (args: string[]) => Promise<string | void>;
}

const BIN = 'reactive-skills-axi';

function usage(lines: string[]): string {
  return lines.join('\n');
}

const viewUsage = (name: string) => usage([
  `Usage: ${BIN} ${name} [skill-name] [--job <job-id>] [--port <number>] [--preferred-port <number>] [--host <host>] [--once]`,
  '',
  'Serve a live telemetry view for one skill run over HTTP and SSE.',
  `Example: ${BIN} ${name} my-skill --job feature-a`,
]);

const viewSpec: CommandSpec = {
  usage: viewUsage('view'),
  run: async (args) => (await import('../commands/view.js')).viewCommand(args),
};

export const COMMANDS: Record<string, CommandSpec> = {
  init: {
    run: async (args) => (await import('../commands/init.js')).initCommand(args),
  },
  upgrade: {
    usage: usage([
      `Usage: ${BIN} upgrade <path-to-legacy-skill>`,
      '',
      'Convert a legacy SKILL.md skill into the reactive skill format.',
      `Example: ${BIN} upgrade skills/my-legacy-skill`,
    ]),
    run: async (args) => (await import('../commands/upgrade.js')).upgradeCommand(args),
  },
  inspect: {
    usage: usage([
      `Usage: ${BIN} inspect <path>`,
      '',
      'Print the statechart, transitions, and guards of a skill.',
      `Example: ${BIN} inspect skills/my-skill`,
    ]),
    run: async (args) => (await import('../commands/inspect.js')).inspectCommand(args),
  },
  validate: {
    usage: usage([
      `Usage: ${BIN} validate [path-to-skill]`,
      '',
      'Validate one skill, or every skill under ./skills/ when no path is given.',
      `Example: ${BIN} validate skills/my-skill`,
    ]),
    run: async (args) => (await import('../commands/validate.js')).validateCommand(args),
  },
  vet: {
    usage: usage([
      `Usage: ${BIN} vet [path-to-skill-or-directory] [--fail-on <high|medium|low>] [--allowlist <file>] [--json] [--rules]`,
      '',
      'Statically scan one skill, or every skill in a directory, for risky code, prompt injection, hidden content, and download-and-execute steps.',
      'Skill code is read, never imported or run.',
      '--fail-on <severity>  Exit 1 when a finding is at or above this severity (default: high).',
      '--allowlist <file>    Suppress reviewed findings listed in a YAML file kept outside the skills.',
      '--json                Print machine-readable JSON.',
      '--rules               List the rules, their severities, and what they look for.',
      'Exit codes: 0 no finding at or above --fail-on, 1 at least one, 2 vet could not run.',
      `Example: ${BIN} vet skills/my-skill`,
      `Example: ${BIN} vet ./catalog --allowlist vet-allowlist.yaml --fail-on medium`,
    ]),
    run: async (args) => (await import('../commands/vet.js')).vetCommand(args),
  },
  preflight: {
    usage: usage([
      `Usage: ${BIN} preflight [path-to-skill] [--json]`,
      '',
      'Check that one skill, or every skill under ./skills/, is compatible with this runtime.',
      '--json  Print machine-readable JSON.',
      `Example: ${BIN} preflight skills/my-skill`,
    ]),
    run: async (args) => (await import('../commands/preflight.js')).preflightCommand(args),
  },
  capabilities: {
    usage: usage([
      `Usage: ${BIN} capabilities [--json]`,
      '',
      'Report the runtime capabilities available to this CLI.',
      '--json  Print machine-readable JSON.',
    ]),
    run: async (args) => (await import('../commands/capabilities.js')).capabilitiesCommand(args),
  },
  'context-route': {
    run: async (args) => (await import('../commands/context-route.js')).contextRouteCommand(args),
  },
  bootloader: {
    usage: usage([
      `Usage: ${BIN} bootloader <skill-name> [--json]`,
      '',
      'Print the reactive bootloader for a skill.',
      '--json  Print machine-readable JSON.',
    ]),
    run: async (args) => (await import('../commands/bootloader.js')).bootloaderCommand(args),
  },
  events: {
    usage: usage([
      `Usage: ${BIN} events [limit] [skill-name] [--job <job-id>]`,
      '',
      'Tail the event log of a skill run.',
      `Example: ${BIN} events 50 my-skill`,
    ]),
    run: async (args) => (await import('../commands/events.js')).eventsCommand(args),
  },
  invoke: {
    usage: usage([
      `Usage: ${BIN} invoke <skill-name-or-path> [--job <job-id>] [--parent <job-id>] [--payload <JSON|@file>]`,
      '',
      'Start a skill run and print its first state prompt.',
      '--payload takes a flat JSON object that becomes the run\'s initial context,',
      'e.g. \'{"mission":"ship"}\'. A {"contextUpdates":{...}} wrapper is rejected;',
      'that shape belongs to emit.',
      `Example: ${BIN} invoke my-skill --job feature-a`,
    ]),
    run: async (args) => (await import('../commands/invoke.js')).invokeCommand(args),
  },
  state: {
    usage: usage([
      `Usage: ${BIN} state <skill-name> [--job <job-id>]`,
      '',
      'Print the current state of a skill run.',
    ]),
    run: async (args) => (await import('../commands/state.js')).stateCommand(args),
  },
  emit: {
    usage: usage([
      `Usage: ${BIN} emit <skill-name> <signal-name> [<JSON|@file> | --payload <JSON|@file>] [--job <job-id>] [--idempotency-key <key>]`,
      `Or:    ${BIN} emit <skill-name> <event-id> <signal-name> [<JSON|@file> | --payload <JSON|@file>] [--job <job-id>] [--idempotency-key <key>]`,
      '',
      'Send a signal to a skill run.',
      '--payload is the signal payload. Put context changes under contextUpdates,',
      'e.g. \'{"contextUpdates":{"mission":"ship"}}\'; they are merged into the run context.',
      `Example: ${BIN} emit my-skill TEST_RAN --payload '{"exit_code":0}'`,
    ]),
    run: async (args) => (await import('../commands/emit.js')).emitCommand(args),
  },
  approve: {
    run: async (args) => (await import('../commands/approve.js')).approveCommand(args),
  },
  setup: {
    usage: usage([
      `Usage: ${BIN} setup [--client <id|all>] [--local] [--dry-run] [--force]`,
      '',
      'Register the Reactive Skills MCP server with installed agent clients.',
      'Entries use the scoped @reactive-skills/axi package pinned to this CLI\'s exact version',
      '(or the installed script path for a global install); existing entries that use the bare',
      'reactive-skills-axi name or an unpinned version are rewritten to that form.',
      '--client <id|all>  Configure one client only.',
      '--local            Point clients at this checkout\'s built CLI instead of the pinned npx package.',
      '--dry-run          Show what would change without writing.',
      '--force            Configure clients even when they are not detected.',
    ]),
    run: async (args) => (await import('../commands/setup.js')).setupCommand(args),
  },
  mcp: {
    usage: usage([
      `Usage: ${BIN} mcp`,
      '',
      'Run the Reactive Skills MCP server over stdio.',
    ]),
    run: async () => {
      const { runMcpServer } = await import('@reactive-skills/runtime');
      await runMcpServer();
    },
  },
  reset: {
    usage: usage([
      `Usage: ${BIN} reset <skill-name> [--job <job-id>] [--purge]`,
      '',
      'Clear the stored state of a skill run.',
      '--purge, -p  Also delete the run directories.',
    ]),
    run: async (args) => (await import('../commands/reset.js')).resetCommand(args),
  },
  'rebuild-sqlite': {
    usage: usage([
      `Usage: ${BIN} rebuild-sqlite <skill-name>`,
      '',
      'Rebuild the SQLite index of a skill from its event logs.',
    ]),
    run: async (args) => (await import('../commands/rebuild-sqlite.js')).rebuildSqliteCommand(args),
  },
  view: viewSpec,
  watch: { ...viewSpec, usage: viewUsage('watch') },
  jobs: {
    usage: usage([
      `Usage: ${BIN} jobs <skill-name>`,
      `       ${BIN} jobs list <skill-name>`,
      `       ${BIN} jobs switch <skill-name> <job-id>`,
      `       ${BIN} jobs archive <skill-name> [job-id]`,
      '',
      'List, switch, or archive the runs of a skill.',
    ]),
    run: async (args) => (await import('../commands/jobs.js')).jobsCommand(args),
  },
  sync: {
    run: async (args) => {
      const { syncCommand } = await import('../commands/sync.js');
      const result = await syncCommand(args);
      process.stdout.write(result.output + '\n');
      if (result.exitCode !== 0) process.exitCode = result.exitCode;
    },
  },
  dashboard: {
    usage: usage([
      `Usage: ${BIN} dashboard [--host 127.0.0.1] [--port <number>] [--once]`,
      '',
      'Serve the workspace telemetry dashboard over HTTP.',
    ]),
    run: async (args) => (await import('../commands/dashboard.js')).dashboardCommand(args),
  },
};

/** True when the arguments after the command name ask for help. */
export function wantsHelp(args: string[]): boolean {
  return args.includes('--help') || args.includes('-h');
}
