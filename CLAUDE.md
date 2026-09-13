# Reactive Skills Architecture (RSA)

## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/ui-context.md`
4. `context/code-standards.md`
5. `context/ai-workflow-rules.md`
6. `context/progress-tracker.md`

Update `context/progress-tracker.md` after each meaningful implementation change.

---

## Quick Operational Commands

- `npm install` — Install dependencies.
- `npm run build` — Compile TypeScript source to `dist/`.
- `npm test` — Run all Vitest suites (`tests/`). **Mandatory gate before finishing tasks.**
- `npm run demo` — Run the end-to-end TDD refactor simulation.
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
