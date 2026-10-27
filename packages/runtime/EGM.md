# Runtime component contract

<!-- EGM:START -->

## Purpose and scope

`@reactive-skills/runtime` implements local hierarchical state machines, event persistence, judgments, projections, skill distribution, and runtime transports.
This document describes selected component boundaries observed on 2026-10-26, including current uncommitted source.
It is an orientation map, not an exhaustive API specification or proof that every invariant has been tested.

## Public interfaces and source map

| Surface | Source | Responsibility |
| --- | --- | --- |
| Package exports | [src/index.ts](src/index.ts), [package.json](package.json) | Root SDK exports, `./vet`, and `./sync` entry points |
| State execution | [fsm-engine.ts](src/core/fsm-engine.ts), [types.ts](src/core/types.ts) | Manifest schema, active state, prompt slices, signals, transitions, and rehydration |
| Persistence | [event-store.ts](src/core/event-store.ts), [job-manager.ts](src/core/job-manager.ts) | Skill-scoped ledger, run identifiers, aliases, snapshots, and query boundaries |
| Transition gates | [guard-evaluator.ts](src/core/guard-evaluator.ts), [judgment-engine.ts](src/core/judgment-engine.ts) | Guard expressions, custom functions, and configured judgment adapters |
| Human approval | [approval-grants.ts](src/core/approval-grants.ts) | Workspace-scoped permission for self-reported approval evidence |
| Context preparation | [context-router.ts](src/core/context-router.ts), [bootloader.ts](src/core/bootloader.ts) | Bounded routing and runtime execution instructions |
| Deliverables | [projection-engine.ts](src/core/projection-engine.ts) | Handlebars output derived from runtime events and context |
| MCP | [server.ts](src/mcp/server.ts) | Stdio tools exposing the runtime to agent hosts |
| Telemetry | [server.ts](src/telemetry/server.ts), [broker.ts](src/telemetry/broker.ts) | Run observation, SSE, and workspace job aggregation |
| Distribution | [engine.ts](src/sync/engine.ts), [distribution.ts](src/sync/distribution.ts) | Skill synchronization and source-to-destination distribution |
| Static vetting | [vet/index.ts](src/vet/index.ts) | Skill scanning without executing the scanned skill |

The package publishes `reactive-skills-mcp`, `reactive-skills-sync`, and `reactive-skills-dev` binaries.
The user-facing AXI command dispatcher belongs to [apps/axi](../../apps/axi/EGM.md).
Node.js 22.13 or newer is declared in package metadata; persistence uses `node:sqlite`.

## Execution and persistence contracts

1. A skill manifest defines nested states, prompt templates, transitions, and gate conditions.
2. `FSMEngine` resolves the current state and produces its scoped prompt slice.
3. A signal is evaluated at the active state and may bubble through ancestors.
4. Guards and judgments determine whether a candidate transition proceeds.
5. Accepted context updates, transition facts, and derived outputs support subsequent rehydration.

SQLite is canonical for normal persistent event-store operation.
JSONL is an audit projection; `rebuildFromJsonl()` is an explicit legacy import operation.
Do not treat manually edited JSONL as an automatic runtime state update.
Run identifiers separate executions within a skill ledger; callers must preserve the selected run across commands.
The store includes run-version checks, idempotency lookup, snapshots, and projection watermarks.

Guards observe the submitted event payload separately from persisted context.
Values submitted for the current signal belong under `payload.contextUpdates` when a guard needs those proposed updates.
Prompt slices and declared tool lists describe runtime intent; actual tool enforcement depends on the host integration.
Custom guard code and judgment adapters require separate trust assessment; static vetting does not make arbitrary code safe.

## Side effects and boundaries

Persistent execution can create SQLite databases, WAL files, JSONL audit files, run metadata, and projected deliverables under configured paths.
Projection destinations come from the skill configuration and are not necessarily confined to one documentation directory.
The projection engine rejects absolute outputs, workspace traversal, and existing links resolving outside the workspace.
Sync operations copy or link skills and can maintain backups and distribution metadata.
Telemetry starts local HTTP/SSE services when requested.
Judgment and routing adapters can contact configured model providers; credentials and provider choices remain configuration concerns.
The presence of an SDK export does not authorize any of these operations during a documentation task.

## Verification and maintenance

Run commands from repository root, with installed workspace dependencies:

```powershell
rtk pnpm nx run runtime:test
rtk pnpm nx run runtime:check:docs
rtk pnpm nx run runtime:build
```

These targets are declared in [project.json](project.json).
The test script runs Vitest followed by documentation and prose checks.
If Nx cannot initialize in a checkout, the package equivalents are `rtk pnpm --filter @reactive-skills/runtime test` and `rtk pnpm --filter @reactive-skills/runtime build`.
Command existence is distinct from a passing result; consult the [bootstrap report](../../.egm/01a177dd-db6c-702e-bc67-95e98f0e3eb3/bootstrap-report.md) for observed checks.
Performance budgets remain owned by [PERFORMANCE-STANDARDS.md](../../PERFORMANCE-STANDARDS.md).
Update this owned block when these component boundaries change, preserving prose outside the markers.

<!-- EGM:END -->
