#!/usr/bin/env node
import { createRequire } from 'node:module';
import { AxiError, mapRuntimeError, exitCodeForError } from '../errors.js';
import { renderError } from '../toon.js';
import { COMMANDS, wantsHelp } from './commands.js';
import { WORKSPACE_COMMANDS, WORKSPACE_HELP } from '../workspace-context.js';

const require = createRequire(import.meta.url);
const packageMetadata = require('../../package.json') as { version?: string };
const VERSION = packageMetadata.version ?? 'unknown';

const DESCRIPTION = 'AXI-compliant CLI for Reactive Skills Architecture — state, emit, events in TOON format';

export const TOP_HELP = `usage: reactive-skills-axi [command] [args] [flags]
commands[31]:
  (none)=home, init, upgrade, inspect, validate, vet, preflight, capabilities, context-route, bootloader, events, invoke, state, emit, evidence, approve, park, abandon, guard, export-run, verify-change, setup, mcp, reset, rebuild-sqlite, view, watch, jobs, sync, dashboard, workspaces
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
  reactive-skills-axi vet skills/my-skill [--fail-on <high|medium|low>] [--allowlist <file>] [--json]
  reactive-skills-axi events 50
  reactive-skills-axi invoke my-skill [--job <alias>]
  reactive-skills-axi state my-skill [--job <alias>]
  reactive-skills-axi emit my-skill <signal> [--payload '{"key":"value"}'] [--job <alias>] [--idempotency-key <key>]
  reactive-skills-axi approve my-skill [--job <alias>] [--allow-self-reported | --revoke-self-reported]
  reactive-skills-axi park my-skill --reason "unrelated fix" [--job <run>] [--session <id>]
  reactive-skills-axi abandon my-skill --reason "superseded" [--job <run>]
  reactive-skills-axi setup --hooks
  reactive-skills-axi export-run my-skill
  reactive-skills-axi verify-change --base origin/main --head HEAD
  reactive-skills-axi jobs my-skill
  reactive-skills-axi jobs switch my-skill <alias-or-run-id>
  reactive-skills-axi reset my-skill
  reactive-skills-axi rebuild-sqlite my-skill
  reactive-skills-axi view my-skill [--job <alias-or-run-id>]
  reactive-skills-axi dashboard [--host 127.0.0.1] [--port <number>]
  reactive-skills-axi workspaces register --scan <parent> [--max-depth <n>] [--dry-run]
  reactive-skills-axi workspaces list
  reactive-skills-axi sync [my-skill | --skill <name>[,<name>...] [--skill <name>[,<name>...] ...]]
  reactive-skills-axi mcp
`;

/**
 * Dispatch a CLI command after help handling and workspace selection.
 * # Performance & Risk Budget
 * - Tier: P2 (<100ms target excluding command execution and process startup)
 * - Complexity: O(a + w * j + d), arguments, catalog roots, metadata lookup and path depth
 * - Cyclomatic Complexity (CC): target <=15
 * - Branch Coverage: target >=70%
 * - CRAP Score: target <=25
 */
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
    process.stdout.write(spec.usage + (WORKSPACE_COMMANDS.has(command) ? WORKSPACE_HELP : '') + '\n');
    return;
  }

  try {
    const { withWorkspaceBinding } = await import('../workspace-binding.js');
    const output = await withWorkspaceBinding(command, commandArgs, (boundArgs) => spec.run(boundArgs));
    if (typeof output === 'string') process.stdout.write(output + '\n');
  } catch (err) {
    const axiErr = err instanceof AxiError ? err : mapRuntimeError(err);
    process.stderr.write(renderError(axiErr.message, axiErr.code, axiErr.suggestions) + '\n');
    process.exit(exitCodeForError(axiErr.code));
  }
}

main();
