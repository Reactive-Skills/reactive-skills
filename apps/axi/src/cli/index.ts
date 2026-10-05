#!/usr/bin/env node
import { createRequire } from 'node:module';
import { AxiError, mapRuntimeError, exitCodeForError } from '../errors.js';
import { renderError } from '../toon.js';
import { COMMANDS, wantsHelp } from './commands.js';

const require = createRequire(import.meta.url);
const packageMetadata = require('../../package.json') as { version?: string };
const VERSION = packageMetadata.version ?? 'unknown';

const DESCRIPTION = 'AXI-compliant CLI for Reactive Skills Architecture — state, emit, events in TOON format';

export const TOP_HELP = `usage: reactive-skills-axi [command] [args] [flags]
commands[23]:
  (none)=home, init, upgrade, inspect, validate, preflight, capabilities, context-route, bootloader, events, invoke, state, emit, approve, setup, mcp, reset, rebuild-sqlite, view, watch, jobs, sync, dashboard
flags[2]:
  --help, --version
examples:
  reactive-skills-axi
  reactive-skills-axi setup
  reactive-skills-axi capabilities
  reactive-skills-axi context-route --message "..." --json
  reactive-skills-axi context-route --message "..." --candidates '[{"id":"policy-review","skill":"policy-review","summary":"Review decisions against policy"}]' --json
  reactive-skills-axi context-route --help
  reactive-skills-axi bootloader my-skill --json
  reactive-skills-axi preflight skills/my-skill
  reactive-skills-axi init my-skill
  reactive-skills-axi upgrade skills/my-legacy-skill
  reactive-skills-axi inspect skills/my-skill
  reactive-skills-axi validate skills/my-skill
  reactive-skills-axi events 50
  reactive-skills-axi invoke my-skill [--job <alias>]
  reactive-skills-axi state my-skill [--job <alias>]
  reactive-skills-axi emit my-skill <signal> [--payload '{"key":"value"}'] [--job <alias>] [--idempotency-key <key>]
  reactive-skills-axi approve my-skill [--job <alias>] [--allow-self-reported | --revoke-self-reported]
  reactive-skills-axi jobs my-skill
  reactive-skills-axi jobs switch my-skill <alias-or-run-id>
  reactive-skills-axi reset my-skill
  reactive-skills-axi rebuild-sqlite my-skill
  reactive-skills-axi view my-skill [--job <alias-or-run-id>]
  reactive-skills-axi dashboard [--host 127.0.0.1] [--port <number>]
  reactive-skills-axi sync [my-skill | --skill <name>[,<name>...] [--skill <name>[,<name>...] ...]]
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

  const spec = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
  if (!spec) {
    process.stderr.write(renderError('Unknown command: ' + command, 'UNKNOWN_COMMAND', ['Run `reactive-skills-axi` with no args for dashboard', 'Run `reactive-skills-axi --help` for command reference']) + '\n');
    process.exit(2);
    return;
  }

  const commandArgs = args.slice(1);
  if (spec.usage && wantsHelp(commandArgs)) {
    process.stdout.write(spec.usage + '\n');
    return;
  }

  try {
    const output = await spec.run(commandArgs);
    if (typeof output === 'string') process.stdout.write(output + '\n');
  } catch (err) {
    const axiErr = err instanceof AxiError ? err : mapRuntimeError(err);
    process.stderr.write(renderError(axiErr.message, axiErr.code, axiErr.suggestions) + '\n');
    process.exit(exitCodeForError(axiErr.code));
  }
}

main();
