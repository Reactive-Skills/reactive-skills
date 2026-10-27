# AXI component contract

<!-- EGM:START -->

## Purpose and scope

`@reactive-skills/axi` is the agent-facing command interface to the runtime.
It publishes the `reactive-skills-axi` and `axi` executable names.
This document describes selected interfaces observed on 2026-10-26, including current uncommitted source.

## Source map and public interfaces

| Source | Responsibility |
| --- | --- |
| [cli/index.ts](src/cli/index.ts) | Executable entry point calling `main()` |
| [cli/main.ts](src/cli/main.ts) | Version handling, command dispatch, output, and top-level error mapping |
| [cli/commands.ts](src/cli/commands.ts) | Command registry, usage, and command loading |
| [args.ts](src/args.ts) | Skill path, workspace, job, and option resolution |
| [commands/invoke.ts](src/commands/invoke.ts) | Run creation or selection and initial context parsing |
| [commands/state.ts](src/commands/state.ts), [commands/emit.ts](src/commands/emit.ts) | State prompt retrieval and guarded signal submission |
| [commands/events.ts](src/commands/events.ts), [commands/jobs.ts](src/commands/jobs.ts) | Ledger observation and job selection |
| [commands/approve.ts](src/commands/approve.ts) | Human approval and self-report grant commands |
| [commands/validate.ts](src/commands/validate.ts), [commands/vet.ts](src/commands/vet.ts) | Manifest validation and static skill scanning |
| [toon.ts](src/toon.ts), [errors.ts](src/errors.ts) | Structured output and actionable error codes |

Execution delegates to [@reactive-skills/runtime](../../packages/runtime/EGM.md).
The executable entry point runs the dispatcher; importing the current `cli/main.ts` does not itself dispatch a command.
This split is present in the working tree and must not be assumed to exist in older installed versions.

## Runtime interaction contract

Use a stable skill identifier, preferably its absolute directory, and retain the returned run UUID for subsequent operations.
The runtime exposes `capabilities`, `preflight`, `bootloader`, and `context-route` to prepare execution.
The core loop is `invoke`, then repeated `state` and `emit` calls until the skill reaches its own terminal state.
Inspect each command's `--help` before selecting unfamiliar options.

`invoke --payload` accepts a flat initial-context object.
`emit --payload` accepts an event payload; proposed context changes belong under `contextUpdates`.
These payload shapes are different and are validated separately.
Payloads may be supplied through a JSON file using `@filepath.json`.
Use UTF-8 without a BOM for payload files consumed by `JSON.parse`.

```powershell
rtk reactive-skills-axi invoke C:\path\to\skill --job design
rtk reactive-skills-axi state C:\path\to\skill --job <returned-run-uuid>
rtk reactive-skills-axi emit C:\path\to\skill <signal> --payload @event.json --job <returned-run-uuid>
```

The paths, signals, and UUID above are placeholders, not executable project verification steps.
Read structured output as well as process status: some validation paths return rendered error text through command output.
A successful process exit alone does not establish that a requested transition happened.
Confirm the returned state and transition outcome.

## Side effects and authority

`invoke`, `emit`, approval, reset, and job operations can persist runtime records or metadata.
Scaffolding, setup, upgrade, rebuild, and synchronization commands have distinct filesystem effects.
`view`, `watch`, and dashboard operations can start observation services.
`mcp` exposes the stdio transport.
Command availability does not grant permission to configure hosts, change skills, approve a human gate, or distribute files.
Preserve runtime gate requirements and do not substitute a model's completion claim for human evidence.

## Verification and maintenance

Run from repository root:

```powershell
rtk pnpm nx run reactive-skills-axi:test
rtk pnpm nx run reactive-skills-axi:build
```

Targets are declared in [project.json](project.json), and the package test script invokes Vitest.
Package equivalents are `rtk pnpm --filter @reactive-skills/axi test` and `rtk pnpm --filter @reactive-skills/axi build` if Nx cannot initialize.
The [bootstrap report](../../.egm/01a177dd-db6c-702e-bc67-95e98f0e3eb3/bootstrap-report.md) records actual execution results.
Keep command semantics aligned with command implementations and help text rather than copying assumptions from an installed CLI.

<!-- EGM:END -->
