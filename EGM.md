# Reactive Skills repository map

<!-- EGM:START -->

## Purpose and coverage

Reactive Skills turns declarative skill instructions into guarded hierarchical state-machine execution with event history and derived deliverables.
This bootstrap maps the runtime, AXI CLI, and site as observed on 2026-10-26.
It includes relevant uncommitted source and does not establish a release baseline.
Existing README files, agent instructions, architecture records, and generated documentation retain their ownership.

## Component contracts

| Component | Contract | Responsibility |
| --- | --- | --- |
| Runtime | [packages/runtime/EGM.md](packages/runtime/EGM.md) | State execution, event persistence, gates, projections, MCP, telemetry, distribution, and vetting |
| AXI | [apps/axi/EGM.md](apps/axi/EGM.md) | Agent-facing command parsing, runtime invocation, structured output, and errors |
| Site | [apps/site/EGM.md](apps/site/EGM.md) | Static content presentation and optional browser connections to local telemetry |

The AXI package depends on the runtime through a workspace dependency.
The site presents content through injected source contracts and connects to runtime telemetry through HTTP/SSE.
It does not serve as the canonical event store.
Skills are runtime inputs containing manifests, state prompts, guards, and optional projection templates.
Synthetic fixtures in this repository are not the distribution authoring source for every installed skill.

## Execution contract

An agent selects a compatible runtime, invokes a skill, retains its run UUID, reads the active state slice, performs that state's work, and emits evidence.
The runtime checks guards and judgments before changing state.
Unhandled signals can bubble from a leaf state to its ancestors.
SQLite persists canonical events for normal disk-backed operation; JSONL provides an audit projection.
Derived documentation and telemetry are read models rather than authority to rewrite execution history.
Human gates require the configured approval evidence, not a prose claim of completion.

## Authoritative supporting material

- [AGENTS.md](AGENTS.md) owns repository execution rules and context-reading order.
- [context/project-overview.md](context/project-overview.md) and [context/architecture.md](context/architecture.md) provide broader project context.
- [.agents/references/repository-map.md](.agents/references/repository-map.md) identifies runtime modules.
- [.agents/COMMANDS.md](.agents/COMMANDS.md) records daily verification commands.
- [PERFORMANCE-STANDARDS.md](PERFORMANCE-STANDARDS.md) owns operation budgets and annotations.
- [docs/adr](docs/adr) and [docs/specs](docs/specs) contain decisions and specifications; consult their status before treating proposals as current behavior.
- [context/progress-tracker.md](context/progress-tracker.md) records implementation progress separately from this documentation bootstrap.

Source and package configuration establish the behavior summarized here.
This document adds no architectural requirements beyond the existing contracts.

## Verification

From repository root, preferred Nx targets are:

```powershell
rtk pnpm nx run runtime:test
rtk pnpm nx run reactive-skills-axi:test
rtk pnpm nx run site:test
```

The runtime test target includes documentation and prose checks.
The root `rtk pnpm test` script is the package-script equivalent for the mandatory runtime gate.
An unavailable Nx configuration may require the package commands listed in each component contract.
Do not infer passing tests from this command list.
Observed results and unexecuted checks appear in the [bootstrap report](.egm/01a177dd-db6c-702e-bc67-95e98f0e3eb3/bootstrap-report.md).

## Maintenance boundary

Four `EGM.md` files summarize selected boundaries; the accompanying report records coverage and limitations.
Coverage is deliberately bounded to six documentation-scope directories: repository root, `packages`, `apps`, `packages/runtime`, `apps/axi`, and `apps/site`.
Source files were read within those components, but this is not a recursive per-directory documentation bootstrap.
Dependencies, build outputs, caches, runtime ledgers, and generated projections are excluded from authored documentation.
No product implementation, skill modification, synchronization, commit, push, or release is part of this bootstrap.
Future EGM edits belong inside `EGM:START` and `EGM:END` markers; preserve all prose outside those blocks.

<!-- EGM:END -->
