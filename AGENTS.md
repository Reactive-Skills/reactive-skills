# AGENTS.md

> Operational guide for agents working within the Reactive Skills repository.

---

## System Overview

This repository houses the **Reactive Skills Architecture (RSA)**: a TypeScript runtime and modular packaging standard that transforms passive markdown agent skills into **Hierarchical State Machines (HSM)** with reactive **Signal Buses**, **Event-Sourced Deliverables**, and portable integration modes.

---

## Build & Verification Commands

See `.agents/COMMANDS.md`

---

## Architecture Invariants

1. **State Independence:** Each state's prompt slice in `states/*.md` must be self-contained. Never assume context from prior states unless bound to `context_keys` or recorded in the event stream.
2. **Deterministic Guarding:** State transitions must specify explicit, testable guard expressions (`exit_code == 0`, schema checks) or custom functions under `guards/`. Never allow transitions on subjective completion claims.
3. **Event Sourcing:** See `.agents/references/event-sourcing.md`
4. **HSM Bubbling:** Unhandled events in leaf substates bubble up to ancestor states. Use ancestor transitions for global policies (e.g. `GLOBAL_ABORT`, `TIMEOUT`, `SECURITY_CRITICAL`).
5. **Read-Model Projections:** See `.agents/references/projections.md`
6. **Strict Runtime Execution:** See `.agents/references/runtime-execution.md`
7. **Lifecycle Management & Statecharts:** See `.agents/references/lifecycle-management.md`
8. **Release Ceremony:** See `.agents/references/release-ceremony.md`

---

## Integration Modes

See `.agents/references/integration-modes.md`

## Context Routing

Before loading full skill instructions or assembling prompt context, call `reactive_context_prepare` when MCP is available.
Pass the current user message and only bounded candidate metadata when candidates are known.
Load only the selected skill and honor returned `context_mode` and `context_budget_tokens`.
If the route is `none`, Jev is unavailable, or the wrapper fails, continue the directly requested runtime path without preloading unrelated skills.
Use `reactive-skills-axi context-route --message "..." --json` when MCP is unavailable; the CLI discovers local skill metadata when `--candidates` is omitted.
Pass `--candidates <JSON|@file>` only to restrict choices, using a JSON array of skill metadata records shaped as `[{"id":"...","skill":"...","summary":"..."}]`.

---

## Repository Map

See `.agents/references/repository-map.md`

---

## Nx Workspace

See `~/.agents/AGENTS.md#nx-workspace`

---

## Performance Standards

This project adheres to [PERFORMANCE-STANDARDS.md](PERFORMANCE-STANDARDS.md).
Keep it current in the same PR whenever work adds or changes an operation, tier, budget, or hot path.
Every new or materially changed function must carry the inline performance annotation in the format defined in that document.

---

## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/ui-context.md`
4. `context/code-standards.md`
5. `context/ai-workflow-rules.md`
6. `context/progress-tracker.md`
7. `PERFORMANCE-STANDARDS.md`

Update `context/progress-tracker.md` after each meaningful implementation change.

---

## Quick Operational Commands

- `npm install` — Install dependencies.
- `npm run build` — Compile TypeScript source to `dist/`.
- `npm test` — Run all Vitest suites (`tests/`). **Mandatory gate before finishing tasks.**
- `npm run demo` — Run the end-to-end TDD refactor simulation.
- `npm run bump:patch` (or `bump:minor`/`bump:major`) — Bump version across workspace packages.
- **Release Ceremony:** When releasing, update the `> 🚀 **What's New in vX.Y.Z:**` hero banner across `README.md`, `apps/axi/README.md`, and `packages/runtime/README.md`. Enforced by `npm test`.
- `node dist/cli/index.js <command>` — Run RSA CLI:
  - `init <name>`: Scaffold new modular reactive skill in `skills/<name>/`.
  - `upgrade <path>`: Convert legacy `SKILL.md` to reactive format.
  - `inspect <path>`: Print statechart, transitions, and guards.
  - `events [limit]`: Tail `.reactive/skills/<skill>/events.jsonl`.
  - `view <skill>`: Launch real-time telemetry viewer and SSE stream.

<!-- nx configuration start-->

<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
