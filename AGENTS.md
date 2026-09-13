# AGENTS.md

> Operational guide for agents working within the Reactive Skills repository.

---

## ? System Overview

This repository houses the **Reactive Skills Architecture (RSA)**: a TypeScript runtime and modular packaging standard that transforms passive markdown agent skills into **Hierarchical State Machines (HSM)** with reactive **Signal Buses**, **Event-Sourced Deliverables**, and portable integration modes.

---

## 🛠️ Build & Verification Commands

- `pnpm install` — Install workspace dependencies.
- `pnpm run build` — Compile TypeScript source across `@reactive-skills/runtime` and `@reactive-skills/axi`.
- `pnpm test` — Run runtime Vitest suites (`packages/runtime/tests/`). **Mandatory gate before finishing any task.**
- `pnpm test:axi` — Run AXI CLI Vitest suites (`apps/axi/tests/`).
- `pnpm demo` — Run the end-to-end TDD refactor simulation.
- `npx -y @reactive-skills/axi mcp` — Run MCP stdio server.
- `npx -y @reactive-skills/axi <command>` (or `reactive-skills-axi <command>`):
  - `state <skill>`: Display active state slice, prompt instructions, and allowed tools.
  - `emit <skill> <signal>`: Dispatch a signal to evaluate guards and transition.
  - `inspect <path>`: Print statechart, transitions, and guards.
  - `events [limit]`: Tail `.reactive/skills/<skill>/events.jsonl`.
  - `init <name>`: Scaffold new modular reactive skill in `skills/<name>/`.
  - `reset <skill>`: Clear active execution run while preserving deliverables.

---

## ?? Architecture Invariants

1. **State Independence:** Each state's prompt slice in `states/*.md` must be self-contained. Never assume context from prior states unless bound to `context_keys` or recorded in the event stream.
2. **Deterministic Guarding:** State transitions must specify explicit, testable guard expressions (`exit_code == 0`, schema checks) or custom functions under `guards/`. Never allow transitions on subjective completion claims.
3. **Event Sourcing First:** Never mutate execution history. All signals, guard checks, and state transitions must append to skill-scoped `EventStore` files (`.reactive/skills/<skill>/events.jsonl` and `.reactive/skills/<skill>/events.db`).
4. **HSM Bubbling:** Unhandled events in leaf substates bubble up to ancestor states. Use ancestor transitions for global policies (e.g. `GLOBAL_ABORT`, `TIMEOUT`, `SECURITY_CRITICAL`).
5. **Read-Model Projections:** Deliverables (`.docs/*.md`, `.json`) are rendered from Handlebars templates in `templates/*.hbs` via `ProjectionEngine`. Never instruct the LLM to manually author summary files that the event stream already computes.
6. **Strict Runtime Execution (No Bypassing):** You MUST NOT manually bypass the reactive state machine. If tools are missing (e.g. `allowed_tools: none` because the MCP server is not attached), you MUST abort the run immediately and ask the user to restart their agent harness or fix the connection. Never "helpfully" guess the next states or manually scaffold the `.docs/` read models if the runtime is blocked.
7. **Lifecycle Management & Statecharts:** Never manually hand-author reactive skill structures. Always use the `skill-manager` skill to CREATE, UPDATE, or MIGRATE skills. Every reactive skill must maintain a synchronized `STATECHART.md` containing a Mermaid `stateDiagram-v2` visualization matching its `skill.yaml` topology.

---

## Integration Modes

Reactive skills can be consumed through three integration modes. The runtime itself has no dependency on any specific mode.

1. **MCP stdio (portable, universal)**
   The MCP server exposes `reactive_state`, `reactive_emit_signal`, `reactive_respond_human`, and other tools over stdio. Any MCP-compatible agent can use these tools directly. No harness-specific code required.

2. **AXI CLI (portable, shell-based)**
   The `reactive-skills-axi` CLI wraps the runtime with agent-ergonomic TOON output. Agents invoke via shell execution (`reactive-skills-axi init`, `inspect`, `events`, etc.). Works with any agent that can run shell commands.

3. **In-Harness Hooks (Claude Code only, optional)**
   `runtime-hooks.ts` provides `onBeforeAgentTurn`, `onAfterToolExecution`, and `onHumanResponse` for Claude Code's interceptor system. This is the least portable option and is not required for skill execution.

**Portable alternative to harness hooks:** State `on_enter`/`on_exit` lifecycle hooks in `skill.yaml` provide automatic context setup and signal emission. The skill's transition contract (defined in `transitions`) tells the agent which signals to emit at decision points. Agents running in any mode can drive a reactive skill by reading the transition contract and calling `engine.handleSignal()` or `reactive_emit_signal` at the appropriate moments.

---

## ?? Repository Map

- `packages/runtime/src/core/types.ts`: Zod schemas & TypeScript types for FSM, signals, and projections.
- `packages/runtime/src/core/event-store.ts`: Immutable append-only event ledger (JSONL + native SQLite driver).
- `packages/runtime/src/core/guard-evaluator.ts`: Sandbox evaluator for transition conditions.
- `packages/runtime/src/core/projection-engine.ts`: Handlebars deliverable generator.
- `packages/runtime/src/core/fsm-engine.ts`: State machine loader, state path resolver & bubbling engine.
- `packages/runtime/src/core/runtime-hooks.ts`: In-harness interceptor hooks (onBeforeAgentTurn, onAfterToolExecution, onHumanResponse).
- `packages/runtime/src/core/legacy-adapter.ts`: Backward compatibility wrapper and converter for `SKILL.md`.
- `packages/runtime/src/core/migration.ts`: Retroactive project migrator and schema upgrader.
- `packages/runtime/src/mcp/server.ts`: Stdio Model Context Protocol (MCP) server integration.
- `apps/axi/src/cli/index.ts`: AXI CLI entry point (`reactive-skills-axi`).
- `skills/`: Synthetic test and verification fixtures (`_test_fsm_skill`, `_test_hitl_skill`, `_test_hsm_skill`, `_test_legacy_skill`).
- `tests/`: Automated unit and integration test suites.

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

## Other

Please refer to `~\.agents\AGENTS.md` for more guidance.

<!-- nx configuration end-->
