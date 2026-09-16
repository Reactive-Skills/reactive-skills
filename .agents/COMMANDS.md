# Build & Verification Commands

## Daily Workflow
- `pnpm install` — Install workspace dependencies.
- `pnpm run build` — Compile TypeScript source across `@reactive-skills/runtime` and `@reactive-skills/axi`.
- `pnpm test` — Run runtime Vitest suites (`packages/runtime/tests/`). **Mandatory gate before finishing any task.**
- `pnpm test:axi` — Run AXI CLI Vitest suites (`apps/axi/tests/`).
- `pnpm demo` — Run the end-to-end TDD refactor simulation.

## Development Tools
- `npx -y @reactive-skills/axi mcp` — Run MCP stdio server.
- `npx -y @reactive-skills/axi <command>` (or `reactive-skills-axi <command>`):
  - `state <skill>`: Display active state slice, prompt instructions, and allowed tools.
  - `emit <skill> <signal>`: Dispatch a signal to evaluate guards and transition.
  - `inspect <path>`: Print statechart, transitions, and guards.
  - `events [limit]`: Tail `.reactive/skills/<skill>/events.jsonl`.
  - `init <name>`: Scaffold new modular reactive skill in `skills/<name>/`.
  - `reset <skill>`: Clear active execution run while preserving deliverables.
  - `view <skill>`: Launch real-time telemetry viewer and SSE event stream.