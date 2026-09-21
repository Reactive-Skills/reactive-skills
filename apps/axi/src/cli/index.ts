#!/usr/bin/env node
import { createRequire } from 'node:module';
import { AxiError, mapRuntimeError, exitCodeForError } from '../errors.js';
import { renderError } from '../toon.js';

const require = createRequire(import.meta.url);
const packageMetadata = require('../../package.json') as { version?: string };
const VERSION = packageMetadata.version ?? 'unknown';

const DESCRIPTION = 'AXI-compliant CLI for Reactive Skills Architecture — state, emit, events in TOON format';

export const TOP_HELP = `usage: reactive-skills-axi [command] [args] [flags]
commands[18]:
  (none)=home, init, upgrade, inspect, validate, events, invoke, state, emit, setup, mcp, reset, rebuild-sqlite, view, watch, jobs, sync, dashboard
flags[2]:
  --help, --version
examples:
  reactive-skills-axi
  reactive-skills-axi setup
  reactive-skills-axi init my-skill
  reactive-skills-axi upgrade skills/my-legacy-skill
  reactive-skills-axi inspect skills/my-skill
  reactive-skills-axi validate skills/my-skill
  reactive-skills-axi events 50
  reactive-skills-axi invoke my-skill [--job <alias>]
  reactive-skills-axi state my-skill [--job <alias>]
  reactive-skills-axi emit my-skill <signal> [--payload '{"key":"value"}'] [--job <alias>] [--idempotency-key <key>]
  reactive-skills-axi jobs my-skill
  reactive-skills-axi jobs switch my-skill <alias-or-run-id>
  reactive-skills-axi reset my-skill
  reactive-skills-axi rebuild-sqlite my-skill
  reactive-skills-axi view my-skill [--job <alias-or-run-id>]
  reactive-skills-axi dashboard [--host 127.0.0.1] [--port <number>]
  reactive-skills-axi sync [my-skill]
  reactive-skills-axi mcp
`;

export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === '--version' || command === '-v') {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  if (!command || command === '--help' || command === 'help') {
    const { homeCommand } = await import('../commands/home.js');
    const output = await homeCommand();
    process.stdout.write(output + '\n');
    return;
  }

  try {
    let output: string;
    switch (command) {
      case 'dashboard': {
        const { dashboardCommand } = await import('../commands/dashboard.js');
        output = await dashboardCommand(args.slice(1));
        break;
      }
      case 'init': {
        const { initCommand } = await import('../commands/init.js');
        output = await initCommand(args.slice(1));
        break;
      }
      case 'upgrade': {
        const { upgradeCommand } = await import('../commands/upgrade.js');
        output = await upgradeCommand(args.slice(1));
        break;
      }
      case 'inspect': {
        const { inspectCommand } = await import('../commands/inspect.js');
        output = await inspectCommand(args.slice(1));
        break;
      }
      case 'validate': {
        const { validateCommand } = await import('../commands/validate.js');
        output = await validateCommand(args.slice(1));
        break;
      }
      case 'events': {
        const { eventsCommand } = await import('../commands/events.js');
        output = await eventsCommand(args.slice(1));
        break;
      }
      case 'invoke': {
        const { invokeCommand } = await import('../commands/invoke.js');
        output = await invokeCommand(args.slice(1));
        break;
      }
      case 'state': {
        const { stateCommand } = await import('../commands/state.js');
        output = await stateCommand(args.slice(1));
        break;
      }
      case 'reset': {
        const { resetCommand } = await import('../commands/reset.js');
        output = await resetCommand(args.slice(1));
        break;
      }
      case 'jobs': {
        const { jobsCommand } = await import('../commands/jobs.js');
        output = await jobsCommand(args.slice(1));
        break;
      }
      case 'rebuild-sqlite': {
        const { rebuildSqliteCommand } = await import('../commands/rebuild-sqlite.js');
        output = await rebuildSqliteCommand(args.slice(1));
        break;
      }
      case 'emit': {
        const { emitCommand } = await import('../commands/emit.js');
        output = await emitCommand(args.slice(1));
        break;
      }
      case 'setup': {
        const { setupCommand } = await import('../commands/setup.js');
        output = await setupCommand(args.slice(1));
        break;
      }
      case 'view':
      case 'watch': {
        const { viewCommand } = await import('../commands/view.js');
        output = await viewCommand(args.slice(1));
        break;
      }
      case 'mcp': {
        const { runMcpServer } = await import('@reactive-skills/runtime');
        await runMcpServer();
        return;
      }
      case 'sync': {
        const { syncCommand } = await import('../commands/sync.js');
        output = await syncCommand(args.slice(1));
        break;
      }
      default: {
        process.stderr.write(renderError('Unknown command: ' + command, 'UNKNOWN_COMMAND', ['Run `reactive-skills-axi` with no args for dashboard', 'Run `reactive-skills-axi --help` for command reference']) + '\n');
        process.exit(2);
        return;
      }
    }
    process.stdout.write(output + '\n');
  } catch (err) {
    const axiErr = err instanceof AxiError ? err : mapRuntimeError(err);
    process.stderr.write(renderError(axiErr.message, axiErr.code, axiErr.suggestions) + '\n');
    process.exit(exitCodeForError(axiErr.code));
  }
}

main();

